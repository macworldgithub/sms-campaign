export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  try {
    const result = await fetch(
      `${process.env.BACKEND_URL || "http://127.0.0.1:4000"}/api/tracking/${encodeURIComponent(token)}`,
      { redirect: "manual", cache: "no-store" },
    );
    const location = result.headers.get("location");
    return location
      ? Response.redirect(location, 302)
      : new Response("This campaign link is unavailable.", { status: 404 });
  } catch {
    return new Response("Please try again shortly.", { status: 503 });
  }
}
