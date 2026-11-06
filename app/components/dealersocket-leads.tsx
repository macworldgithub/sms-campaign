"use client";

import { useEffect, useState } from "react";

type RecordRow = {
  record_key: string; dealership_id: string; customer_id: string; opportunity_id: string;
  customer_name?: string; customer_phone?: string; customer_email?: string;
  assigned_salesperson?: string; opportunity_status?: string; rooftop_raw?: string;
  detail_extracted?: boolean;
};
type Capture = {
  scope?: string; fetchedAt?: string; coverageNote?: string; records?: RecordRow[];
  coverage?: { filterId: string; filterName: string; loadedCount: number }[];
};
type Dealer = { session?: { state?: string; message?: string }; snapshot?: Capture };
type Props = { api: (path: string, body?: unknown) => Promise<Dealer>; canManage: boolean };
const observed = (value?: string) => value ? new Date(value).toLocaleString("en-AU", { timeZone: "Australia/Melbourne" }) : "Not synced yet";

export default function DealerSocketLeads({ api, canManage }: Props) {
  const [data, setData] = useState<Dealer | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const result = await api("dealersocket"); if (active) { setData(result); setError(""); } }
      catch (failure) { if (active) setError((failure as Error).message); }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [api]);
  const snapshot = data?.snapshot;
  const rows = snapshot?.scope === "south_morang_hyundai"
    ? (snapshot.records || []).filter(row => row.dealership_id === "10876") : [];
  const matches = rows.filter(row => [row.customer_name, row.customer_phone, row.customer_email, row.customer_id, row.opportunity_id, row.assigned_salesperson, row.opportunity_status].some(value => String(value || "").toLowerCase().includes(query.trim().toLowerCase())));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matches.length / 25) - 1));
  return <section className="panel">
    <div className="panel-header"><div><h3>DealerSocket · South Morang Hyundai</h3><p>Existing CRM opportunities, separate from campaign registrations and the consented SMS audience.</p></div><span className="badge badge-blue">{rows.length} synced opportunities</span></div>
    <p>Last captured: {observed(snapshot?.fetchedAt)} · Melbourne time. Worker: {data?.session?.state?.replaceAll("_", " ") || "Checking"}.</p>
    {data?.session?.state !== "connected" && data?.session?.message && <p role="status" className="notice">{data.session.message} Saved records remain visible.</p>}
    <p className="muted">{snapshot?.coverageNote || "Waiting for the first South Morang Hyundai snapshot."}</p>
    <p className="muted">A CRM record is not proof of marketing consent. These records are not added to Audience or sent SMS automatically.</p>
    {snapshot?.coverage?.length ? <p className="muted">Queues: {snapshot.coverage.map(item => `${item.filterName} (${item.loadedCount})`).join(" · ")}. Records appearing in multiple queues are deduplicated.</p> : null}
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <input aria-label="Search DealerSocket opportunities" placeholder="Search name, mobile, CRM ID or salesperson…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} style={{ flex: 1, minWidth: 220, padding: 10, border: "1px solid var(--border)", borderRadius: 7 }} />
      <button className="btn btn-secondary" disabled={!canManage || refreshing} onClick={async () => {
        setRefreshing(true); setNotice("");
        try { await api("dealersocket/sync", {}); setNotice("Refresh requested. The running Chrome worker will capture the configured Hyundai queues; this view checks for updates automatically."); }
        catch (failure) { setNotice((failure as Error).message); }
        finally { setRefreshing(false); }
      }}>{refreshing ? "Requesting…" : "Refresh from DealerSocket"}</button>
    </div>
    {error && <p role="alert" className="notice">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
    <div className="table-container"><table><thead><tr><th>CUSTOMER</th><th>CONTACT DETAILS</th><th>CRM REFERENCES</th><th>STATUS / ASSIGNEE</th></tr></thead><tbody>
      {matches.slice(currentPage * 25, currentPage * 25 + 25).map(row => <tr key={row.record_key}><td><strong>{row.customer_name || "Customer"}</strong><small style={{ display: "block" }}>{row.rooftop_raw || "South Morang Hyundai"}</small></td><td>{row.customer_phone || "Mobile not captured"}<small style={{ display: "block" }}>{row.customer_email || "Email not captured"}</small>{!row.detail_extracted && <small style={{ display: "block" }}>Contact details not verified in this capture</small>}</td><td>Customer {row.customer_id}<small style={{ display: "block" }}>Opportunity {row.opportunity_id}</small><a href={`https://bb.dealersocket.com/#/crm/view/contact/${encodeURIComponent(row.customer_id)}`} target="_blank" rel="noopener noreferrer">Open DealerSocket ↗</a></td><td>{row.opportunity_status || "Not captured"}<small style={{ display: "block" }}>{row.assigned_salesperson || "Unassigned / not captured"}</small></td></tr>)}
    </tbody></table></div>
    {!matches.length && <p>{data ? "No DealerSocket opportunities match this view." : "Loading DealerSocket records…"}</p>}
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}><span>{matches.length} matches · Page {currentPage + 1} of {Math.max(1, Math.ceil(matches.length / 25))}</span><button className="btn btn-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="btn btn-secondary" disabled={(currentPage + 1) * 25 >= matches.length} onClick={() => setPage(currentPage + 1)}>Next</button></div>
  </section>;
}
