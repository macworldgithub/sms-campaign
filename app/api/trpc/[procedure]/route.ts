import { cookies } from "next/headers";
const attempts = new Map<string, { at: number; count: number }>();
export async function POST(
  request: Request,
  context: { params: Promise<{ procedure: string }> },
) {
  const batch = new URL(request.url).searchParams.get("batch") === "1";
  const requestUrl = new URL(request.url);
  const expectedOrigin = `${request.headers.get("x-forwarded-proto") === "https" ? "https:" : requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
  function failure(message: string, status = 400) {
    const error = {
      error: {
        json: {
          message,
          code: -32600,
          data: {
            code: "BAD_REQUEST",
            httpStatus: status,
            path: "campaign.enquire",
          },
        },
      },
    };
    return Response.json(batch ? [error] : error, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (process.env.APP_ROLE !== "public")
    return failure("Public landing service only.", 404);
  if (request.headers.get("origin") !== expectedOrigin)
    return failure("Invalid form origin.", 403);
  const { procedure } = await context.params;
  if (procedure !== "campaign.enquire") return failure("Unknown form.", 404);
  const jar = await cookies(),
    session = jar.get("smh_loyalty_session")?.value,
    token = jar.get("smh_campaign_ref")?.value;
  if (!session || !/^[a-f0-9-]{36}$/i.test(session))
    return failure("Reload the loyalty page before submitting.");
  const attempt = attempts.get(session);
  const current =
    attempt && Date.now() - attempt.at < 300000
      ? attempt
      : { at: Date.now(), count: 0 };
  if (attempts.size >= 10000) {
    for (const [key, item] of attempts)
      if (Date.now() - item.at > 300000) attempts.delete(key);
    if (attempts.size >= 10000 && !attempts.has(session))
      return failure("Please try again shortly.", 429);
  }
  current.count++;
  attempts.set(session, current);
  if (current.count > 10)
    return failure("Please wait a few minutes before trying again.", 429);
  const raw = await request.text();
  if (raw.length > 20000) return failure("Form is too large.");
  let data: Record<string, unknown>;
  try {
    const input = JSON.parse(raw);
    data = (batch ? input["0"]?.json : input.json) || {};
  } catch {
    return failure("Invalid form data.");
  }
  const field = (name: string, max = 200) =>
    typeof data[name] === "string"
      ? String(data[name]).trim().slice(0, max)
      : "";
  const firstName = field("firstName", 100),
    lastName = field("lastName", 100),
    email = field("email", 320),
    phone = field("phone", 32);
  if (
    field("website") ||
    data.existingCustomer !== true ||
    data.contactConsent !== true
  )
    return failure(
      "Please confirm customer eligibility and permission to respond.",
    );
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email))
    return failure("Enter your name and a valid email address.");
  const mobile = phone.replace(/[\s().-]/g, "");
  const canonicalMobile = mobile.startsWith("04")
    ? "+61" + mobile.slice(1)
    : mobile.startsWith("+")
      ? mobile
      : "+" + mobile;
  if (!/^(?:04\d{8}|\+?614\d{8})$/.test(mobile))
    return failure(
      "Enter the Australian mobile number that received your invitation.",
    );
  if (!process.env.LEAD_WEBHOOK_KEY)
    return failure(
      "Registration is temporarily unavailable. Please call the dealership.",
      503,
    );
  try {
    const configResponse = await fetch(`${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/public/config`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!configResponse.ok) return failure("Offer configuration is temporarily unavailable.", 503);
    const offer = await configResponse.json();
    if (!offer.active) return failure("This loyalty offer is not active. Please contact the dealership.", 403);
    const response = await fetch(
      `${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/webhooks/leads`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Key": process.env.LEAD_WEBHOOK_KEY,
        },
        body: JSON.stringify({
          eventId: `loyalty:${token || session}:${canonicalMobile}`,
          firstName,
          lastName,
          email,
          mobile,
          token,
          requireActiveOffer: true,
          contactConsent: true,
          existingCustomer: true,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      return failure(
        "Your enquiry could not be registered. Please try again shortly.",
        503,
      );
    const lead = await response.json();
    const result = {
      result: {
        data: {
          json: {
            reference: `SMH-${String(lead.id).slice(0, 8).toUpperCase()}`,
          },
        },
      },
    };
    return Response.json(batch ? [result] : result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return failure(
      "Registration is temporarily unavailable. Please try again shortly.",
      503,
    );
  }
}
