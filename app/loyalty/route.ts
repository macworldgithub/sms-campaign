// Preserve previously shared links while keeping one customer/staff page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/";
  url.searchParams.set("view", "customer");
  return Response.redirect(url, 307);
}
