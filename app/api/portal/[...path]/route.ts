import { cookies } from "next/headers";

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const url = new URL(request.url);
  const origin = `${request.headers.get("x-forwarded-proto") === "https" ? "https:" : url.protocol}//${request.headers.get("host") || url.host}`;
  if (request.method !== "GET" && request.headers.get("origin") !== origin) return Response.json({ message: "Invalid origin." }, { status: 403 });
  const { path } = await context.params, endpoint = path.join("/");
  const aliases: Record<string, string> = { login: "auth/login", me: "auth/me", logout: "auth/logout", password: "auth/password" };
  if (!/^(login|me|logout|password|users|settings|operations(?:\/[^/]+(?:\/[^/]+)?)?|portal|routing|sms\/(?:test|outbound|inbox(?:\/sync)?|activity\/[\w-]+\/customer)|leads\/[\w-]+\/customer|contacts\/import(?:-workbook)?|suppressions|campaigns(?:\/[\w-]+\/(?:approve|send|pause|resume))?|dealersocket(?:\/(?:check|login|sync))?|provider)$/.test(endpoint)) return Response.json({ message: "Not found" }, { status: 404 });
  const jar = await cookies();
  const token = jar.get("portal_session")?.value;
  if (endpoint !== "login" && !token) return Response.json({ message: "Sign in to continue." }, { status: 401 });
  try {
    const response = await fetch(`${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/${aliases[endpoint] || endpoint}`, {
      method: request.method,
      headers: { "Content-Type": "application/json", "X-Portal-Key": process.env.PORTAL_API_KEY || "", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(request.method !== "GET" ? { body: await request.text() } : {}),
      cache: "no-store", signal: AbortSignal.timeout(30000),
    });
    const result = await response.json();
    if (endpoint === "login" && response.ok) {
      jar.set("portal_session", result.token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 28800, path: "/" });
      return Response.json({ ok: true, user: result.user }, { headers: { "Cache-Control": "no-store" } });
    }
    if (endpoint === "logout" || (endpoint === "password" && response.ok) || response.status === 401) jar.delete("portal_session");
    return Response.json(result, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ message: "Campaign service is unavailable. Please check the backend." }, { status: 503 }); }
}
export { handler as GET, handler as POST };
