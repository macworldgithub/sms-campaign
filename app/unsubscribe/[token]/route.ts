const headers = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function page(title: string, detail: string, confirm = false, status = 200) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Booran Loyalty</title><style>body{margin:0;background:#f7f8fa;color:#182131;font:16px/1.6 Arial,sans-serif;display:grid;min-height:100vh;place-items:center}main{background:white;border:1px solid #e5e7eb;border-top:5px solid #e22837;border-radius:12px;padding:36px;max-width:440px;margin:24px}small{color:#697386;letter-spacing:2px}h1{font-size:28px;line-height:1.2}button{background:#e22837;color:white;border:0;border-radius:7px;padding:14px 22px;font-size:16px;cursor:pointer}p{color:#536074}</style></head><body><main><small>BOORAN · SOUTH MORANG HYUNDAI</small><h1>${escape(title)}</h1><p>${escape(detail)}</p>${confirm ? '<form method="post"><button type="submit">Confirm unsubscribe</button></form>' : ''}</main></body></html>`, { status, headers });
}
async function tokenFor(context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  return /^[a-f0-9-]{36}$/i.test(token) ? token : null;
}
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const token = await tokenFor(context);
  if (!token) return page("Link unavailable", "Please check the unsubscribe link in your message.", false, 404);
  try {
    const response = await fetch(`${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/unsubscribe/${token}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) return page("Link unavailable", "Please check the unsubscribe link in your message.", false, response.status >= 500 ? 503 : 404);
    const data = await response.json();
    // Link previews and security scanners must never unsubscribe a recipient on GET.
    return page("Stop loyalty messages?", `Confirm below to stop further loyalty SMS for the mobile ending ${String(data.maskedMobile).slice(-4)}.`, true);
  } catch { return page("Please try again", "We could not process your request right now. Please try again shortly.", false, 503); }
}
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const url = new URL(request.url);
  const origin = `${request.headers.get("x-forwarded-proto") === "https" ? "https:" : url.protocol}//${request.headers.get("host") || url.host}`;
  if (request.headers.get("origin") !== origin) return page("Request unavailable", "Open the unsubscribe link and confirm using the button.", false, 403);
  const token = await tokenFor(context);
  if (!token) return page("Link unavailable", "Please check the unsubscribe link in your message.", false, 404);
  try {
    const response = await fetch(`${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/unsubscribe/${token}`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) return page("Please try again", "We could not complete your request. Please check the link and try again.", false, response.status >= 500 ? 503 : 404);
    return page("You're unsubscribed", "No further loyalty campaign SMS will be sent to this mobile. You can close this page.");
  } catch { return page("Please try again", "We could not process your request right now. Please try again shortly.", false, 503); }
}
