import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const url = new URL(request.url);
  const isHttps = request.headers.get("x-forwarded-proto") === "https" || url.protocol === "https:";
  const origin = `${isHttps ? "https:" : "http:"}//${request.headers.get("host") || url.host}`;
  if (request.method !== "GET" && request.headers.get("origin") && request.headers.get("origin") !== origin) {
    return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  }

  const { path } = await context.params;
  const endpoint = path.join("/");
  const aliases: Record<string, string> = {
    login: "auth/login",
    me: "auth/me",
    logout: "auth/logout",
    password: "auth/password",
  };

  if (
    !/^(login|me|logout|password|users|settings|kiasmorang(?:\/import)?|operations(?:\/[^/]+(?:\/[^/]+)?)?|portal|routing|sms\/(?:test|outbound|inbox(?:\/sync)?|activity\/[\w-]+\/customer)|leads\/[\w-]+\/customer|contacts\/import(?:-workbook)?|suppressions|campaigns(?:\/[\w-]+\/(?:approve|send|pause|resume))?|dealersocket(?:\/(?:check|login|sync))?|provider)$/.test(
      endpoint
    )
  ) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const jar = await cookies();
  const token = jar.get("portal_session")?.value;
  if (endpoint !== "login" && !token) {
    return NextResponse.json({ message: "Sign in to continue." }, { status: 401 });
  }

  const primaryUrl = process.env.BACKEND_URL || "http://127.0.0.1:4000";
  const targets = [primaryUrl];
  if (primaryUrl !== "http://127.0.0.1:4000") targets.push("http://127.0.0.1:4000");

  const requestBody = request.method !== "GET" ? await request.text() : undefined;

  for (const backend of targets) {
    try {
      const response = await fetch(`${backend}/api/${aliases[endpoint] || endpoint}${url.search}`, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          "X-Portal-Key": process.env.PORTAL_API_KEY || "",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(requestBody !== undefined ? { body: requestBody } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });

      const result = await response.json().catch(() => ({ message: response.statusText }));
      const nextResponse = NextResponse.json(
        endpoint === "login" && response.ok ? { ok: true, user: result.user } : result,
        { status: response.status, headers: { "Cache-Control": "no-store" } }
      );

      const cookieOpts = {
        httpOnly: true,
        sameSite: "strict" as const,
        secure: isHttps,
        maxAge: 28800,
        path: "/",
      };

      if (endpoint === "login" && response.ok && result.token) {
        nextResponse.cookies.set("portal_session", result.token, cookieOpts);
      }
      if (
        endpoint === "logout" ||
        (endpoint === "password" && response.ok) ||
        (response.status === 401 && endpoint === "me")
      ) {
        nextResponse.cookies.delete("portal_session");
      }
      return nextResponse;
    } catch {
      continue;
    }
  }

  // Logout should always succeed client-side even if backend is unreachable —
  // clear the cookie so the user is not stuck in a redirect loop.
  if (endpoint === "logout") {
    const resp = NextResponse.json({ ok: true }, { status: 200 });
    resp.cookies.delete("portal_session");
    return resp;
  }

  return NextResponse.json(
    { message: "Campaign service is unavailable. Please check the backend." },
    { status: 503 }
  );
}

export { handler as GET, handler as POST };
