"use client";

import { useEffect, useState } from "react";

type Prospect = { site: string; id: string; name: string; franchise: string; status: string; assignee: string; vehicle: string };
type Snapshot = { capturedAt: string | null; total: number; all: number; page: number; pages: number; rows: Prospect[] };

export default function SouthMorangProspects() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/portal/south-morang-prospects?page=${page}&search=${encodeURIComponent(search)}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load South Morang prospects.");
        const snapshot: Snapshot = await response.json();
        if (!controller.signal.aborted) {
          setData(snapshot);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) setError("Could not load South Morang prospects.");
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, search]);

  return <section className="panel">
    <h2>South Morang active prospects</h2>
    <p>DealerSocket saved queues for Kia and Chery new vehicles, South Morang used vehicles, and Hyundai new vehicle prospects without follow-up.</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading prospects…</p>}
    {data && !data.capturedAt && <p>Waiting for the first DealerSocket sync.</p>}
    {data?.capturedAt && <>
      <p>{data.all.toLocaleString()} opportunities · Synced {new Date(data.capturedAt).toLocaleString("en-AU", { timeZone: "Australia/Melbourne" })} Melbourne time</p>
      <label>Search prospects <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
      <div className="table-container"><table>
        <thead><tr><th>Prospect</th><th>Franchise</th><th>Opportunity</th><th>Status</th><th>Assigned to</th><th>Vehicle</th></tr></thead>
        <tbody>{data.rows.map(row => <tr key={row.site + "|" + row.id}>
          <td>{row.name || "—"}</td><td>{row.franchise || (row.site === "10755" ? "South Morang Kia" : "South Morang Hyundai")}</td>
          <td>{row.id}</td><td>{row.status || "—"}</td><td>{row.assignee || "—"}</td><td>{row.vehicle || "—"}</td>
        </tr>)}</tbody>
      </table></div>
      <p>{data.total.toLocaleString()} matches · Page {data.page} of {data.pages}</p>
      <button className="btn btn-secondary" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Previous</button>
      <button className="btn btn-secondary" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Next</button>
    </>}
  </section>;
}
