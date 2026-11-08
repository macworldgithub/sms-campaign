import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const upstream = await fetch(`${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/public/config`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!upstream.ok) throw new Error("Offer unavailable");
    const config = await upstream.json();
    // Public responses contain offer fields only, never staff credentials or permissions.
    const response = NextResponse.json({ active: config.active === true, offerName: config.offerName || "", offerDetails: config.offerDetails || "", eligibility: config.eligibility || "", expiresAt: config.expiresAt || "" }, { headers: { "Cache-Control": "no-store" } });
    const jar = await cookies();
    const previous = jar.get("smh_loyalty_session")?.value;
    const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 28800, path: "/" };
    if (!previous || !/^[a-f0-9-]{36}$/i.test(previous)) response.cookies.set("smh_loyalty_session", randomUUID(), options);
    const ref = new URL(request.url).searchParams.get("ref") || "";
    if (/^[a-f0-9-]{36}$/i.test(ref)) response.cookies.set("smh_campaign_ref", ref, options);
    else response.cookies.delete("smh_campaign_ref");
    return response;
  } catch {
    return NextResponse.json({ message: "The loyalty experience is temporarily unavailable. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
