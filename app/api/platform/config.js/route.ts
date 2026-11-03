export async function GET() {
  if (process.env.APP_ROLE !== "public")
    return new Response("Not found", { status: 404 });
  try {
    const result = await fetch(
      "https://smhloyalty-ryreth7q.manus.space/api/platform/config.js",
      { signal: AbortSignal.timeout(15000) },
    );
    return new Response(result.body, {
      status: result.status,
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("", { status: 503 });
  }
}
