import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function signature(payload: string) {
  return createHmac("sha256", process.env.PORTAL_API_KEY || "")
    .update(`portal:${process.env.PORTAL_PASSWORD || ""}:${payload}`)
    .digest("hex");
}
let failedAttempts = 0,
  retryAfter = 0;
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const requestUrl = new URL(request.url);
  const expectedOrigin = `${request.headers.get("x-forwarded-proto") === "https" ? "https:" : requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
  if (process.env.APP_ROLE === "public")
    return Response.json(
      {
        message:
          "Operator access is unavailable on the public landing service.",
      },
      { status: 403 },
    );
  const jar = await cookies();
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== expectedOrigin
  )
    return Response.json({ message: "Invalid origin." }, { status: 403 });
  if (path.join("/") === "login" && request.method === "POST") {
    if (Date.now() < retryAfter)
      return Response.json(
        { message: "Too many sign-in attempts. Try again shortly." },
        { status: 429 },
      );
    const input = await request.json(),
      expected = process.env.PORTAL_PASSWORD;
    if (
      !expected ||
      typeof input.password !== "string" ||
      Buffer.byteLength(input.password) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(input.password), Buffer.from(expected))
    ) {
      failedAttempts++;
      if (failedAttempts >= 10) {
        retryAfter = Date.now() + 60000;
        failedAttempts = 0;
      }
      return Response.json(
        { message: "Incorrect portal password." },
        { status: 401 },
      );
    }
    failedAttempts = 0;
    const payload = `${Date.now()}.${randomBytes(16).toString("hex")}`;
    jar.set("portal_session", `${payload}.${signature(payload)}`, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 28800,
      path: "/",
    });
    return Response.json({ ok: true });
  }
  const cookie = jar.get("portal_session")?.value || "";
  const [issued, nonce, mac] = cookie.split(".");
  const expected = signature(`${issued}.${nonce}`);
  if (
    !process.env.PORTAL_API_KEY ||
    !/^\d{13}$/.test(issued || "") ||
    !/^[a-f0-9]{32}$/.test(nonce || "") ||
    !/^[a-f0-9]{64}$/.test(mac || "") ||
    Number(issued) > Date.now() ||
    Date.now() - Number(issued) > 28800000 ||
    !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  )
    return Response.json({ message: "Sign in to continue." }, { status: 401 });
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== expectedOrigin
  )
    return Response.json({ message: "Invalid origin." }, { status: 403 });
  if (path.join("/") === "logout") {
    jar.delete("portal_session");
    return Response.json({ ok: true });
  }
  const endpoint = path.join("/");
  if (
    !/^(portal|routing|leads\/[\w-]+\/customer|contacts\/import(?:-workbook)?|suppressions|campaigns(?:\/[\w-]+\/(?:approve|send))?|dealersocket(?:\/(?:check|login|sync))?|provider)$/.test(
      endpoint,
    )
  )
    return Response.json({ message: "Not found" }, { status: 404 });
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/${endpoint}`,
      {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          "X-Portal-Key": process.env.PORTAL_API_KEY,
        },
        ...(request.method !== "GET" ? { body: await request.text() } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(
          endpoint.endsWith("/send") ? 600000 : 30000,
        ),
      },
    );
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { message: "Campaign service is unavailable. Please check the backend." },
      { status: 503 },
    );
  }
}
export { handler as GET, handler as POST };
