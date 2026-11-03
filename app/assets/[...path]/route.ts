export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  if (process.env.APP_ROLE !== "public")
    return new Response("Not found", { status: 404 });
  const { path } = await context.params;
  if (
    !path.length ||
    path.some((p) => !/^[-\w.]+$/.test(p) || p === "." || p === "..")
  )
    return new Response("Not found", { status: 404 });
  try {
    const result = await fetch(
      `https://smhloyalty-ryreth7q.manus.space/assets/${path.map(encodeURIComponent).join("/")}`,
      { signal: AbortSignal.timeout(20000) },
    );
    return new Response(result.body, {
      status: result.status,
      headers: {
        "Content-Type":
          result.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Asset unavailable", { status: 503 });
  }
}
