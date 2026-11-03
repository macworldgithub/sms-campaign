import { Suspense } from "react";

async function Experience({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    query = new URLSearchParams();
  for (const key of [
    "ref",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ])
    if (typeof params[key] === "string")
      query.set(key, params[key].slice(0, 200));
  const base =
    process.env.APP_ROLE === "public"
      ? ""
      : process.env.PUBLIC_LOYALTY_ORIGIN || "http://localhost:3001";
  return (
    <iframe
      title="South Morang Hyundai loyalty experience"
      src={`${base}/?${query}`}
      style={{ width: "100%", height: "100vh", border: 0, display: "block" }}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
export default function LoyaltyExperience({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, color: "#e22837" }}>
          Opening your Hyundai loyalty experience…
        </div>
      }
    >
      <Experience searchParams={searchParams} />
    </Suspense>
  );
}
