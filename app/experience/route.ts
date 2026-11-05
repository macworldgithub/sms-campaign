import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (process.env.APP_ROLE !== "public")
    return new Response("Public landing service only", { status: 404 });
  try {
    const configResponse = await fetch(`${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/public/config`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!configResponse.ok) throw new Error("Offer configuration unavailable");
    const offer = await configResponse.json();
    if (!offer.active) return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booran Hyundai Loyalty</title><style>body{font:18px/1.6 Arial,sans-serif;background:#f8f9fb;color:#24262c;margin:0;min-height:100vh;display:grid;place-items:center}main{max-width:520px;padding:32px;margin:20px;background:white;border-top:5px solid #e22837;border-radius:10px}</style></head><body><main><h1>South Morang Hyundai loyalty</h1><p>This offer is not currently active. Please contact the dealership for current offers.</p></main></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'" } });
    const upstream = await fetch("https://smhloyalty-ryreth7q.manus.space/", {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!upstream.ok) throw new Error("Experience unavailable");
    let html = await upstream.text();
    // Campaign reporting is first party; omit the supplied host's analytics loaders.
    html = html.replace(
      /<script\b[^>]*src=["']https:\/\/(?:plausible\.io|manus-analytics\.com)\/[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
      "",
    );
    const response = new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": `frame-ancestors 'self' ${process.env.ADMIN_PORTAL_ORIGIN || "http://localhost:3000 http://127.0.0.1:3000"}`,
      },
    });
    const previous = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)smh_loyalty_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
    if (!previous)
      response.cookies.set("smh_loyalty_session", randomUUID(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 28800,
        path: "/",
      });
    const token = new URL(request.url).searchParams.get("ref");
    if (token && /^[a-f0-9-]{36}$/i.test(token))
      response.cookies.set("smh_campaign_ref", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 28800,
        path: "/",
      });
    return response;
  } catch {
    return new Response(
      "The loyalty experience is temporarily unavailable. Please try again shortly.",
      { status: 503 },
    );
  }
}
