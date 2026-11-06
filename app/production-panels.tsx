"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Spinner, TabLoader } from "./components/spinner";
import StaffAccounts from "./components/staff-accounts";
type Props = { tab: string; api: (path: string, body?: unknown) => Promise<any>; user: { id: string; role: string }; onUpdated: () => void };
export default function ProductionPanels({ tab, api, user, onUpdated }: Props) {
  const [data, setData] = useState<any>(null), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [expiry, setExpiry] = useState<string | null>(null);
  const manage = user.role !== "viewer", admin = user.role === "admin";
  const load = useCallback(async () => {
    try { setData(await api(tab === "Staff" ? "users" : tab === "Settings" ? "settings" : "operations")); }
    catch (error) { setNotice((error as Error).message); }
  }, [api, tab]);
  useEffect(() => { setData(null); setNotice(""); setExpiry(null); void load(); if(tab !== 'Operations') return; const t = setInterval(() => void load(), 10000); return () => clearInterval(t); }, [load, tab]);
  async function act(path: string, body: any = {}) {
    setBusy(true); setNotice("");
    try { const result = await api(path, body); setNotice(result.message || "Saved successfully."); await load(); onUpdated(); return result; }
    catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }
  if (!data) {
    return (
      <TabLoader
        title={tab === "Staff" ? "Loading Staff Accounts & Permissions…" : tab === "Settings" ? "Loading Offer & Campaign Settings…" : "Loading Operations & Dispatch Queue…"}
        subtitle="Verifying administrative access and synchronizing cluster records"
      />
    );
  }
  return <div className="production-panels">
    {notice && <p className="notice" role="status">{notice}</p>}
    {tab === "Settings" && <section className="panel"><h2>Client-approved offer</h2><p>Set the final offer, eligibility and expiry. Sending remains blocked until approval and the other launch checks are complete.</p>
      <form onSubmit={async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); await act('settings', { offerName: f.get('offerName'), offerDetails: f.get('offerDetails'), eligibility: f.get('eligibility'), expiresAt: f.get('expiresAt'), clientApprovalConfirmed: f.get('approved') === 'on' }); }}>
        <label>Offer name<input name="offerName" required defaultValue={data.offerName || ''} disabled={!admin} /></label>
        <label>Approved offer details<textarea name="offerDetails" required maxLength={2000} defaultValue={data.offerDetails || ''} disabled={!admin} /></label>
        <label>Customer eligibility<textarea name="eligibility" required maxLength={2000} defaultValue={data.eligibility || ''} disabled={!admin} /></label>
        <label>Expiry date · end of day in Melbourne<input name="expiresAt" type="date" lang="en-AU" required min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(new Date())} value={expiry ?? (data.expiresAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(new Date(data.expiresAt)) : '')} onChange={event => setExpiry(event.target.value)} disabled={!admin} /></label>
        <p className="muted" aria-live="polite">{(expiry ?? data.expiresAt) ? `Selected expiry: ${new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(expiry ? `${expiry}T12:00:00Z` : data.expiresAt))}, at the end of the day in Melbourne.` : 'Choose the date using the calendar. Your browser may display month/day/year.'}</p>
        <label className="check-row"><input name="approved" type="checkbox" defaultChecked={data.clientApprovalConfirmed === true} disabled={!admin} /> Client has approved these offer terms and expiry</label>
        <p className="muted">These approved terms will appear in the customer loyalty view. Each campaign's final SMS copy still requires its own approval.</p>
        <button className="btn btn-primary" disabled={busy || !admin} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {busy ? <><Spinner size="xs" color="#ffffff" trackColor="rgba(255,255,255,0.3)" /> Saving offer…</> : "Save offer configuration"}
        </button>
      </form></section>}
    {tab === "Staff" && admin && <StaffAccounts users={data} currentUserId={user.id} onSave={async input => { await api('users', input); setNotice('Account saved. Enabled users can sign in with their username and password.'); await load(); onUpdated(); }} />}
    {tab === "Operations" && <>
      <section className="panel"><h2>Background campaign dispatch</h2><p>Queued jobs continue independently of this page. Pause stops after any current provider attempt; resuming processes only unsent queued recipients.</p>
        <div className="table-container"><table><thead><tr><th>CAMPAIGN</th><th>STATUS</th><th>ACCEPTED</th><th>UNCERTAIN</th><th>REMAINING</th><th /></tr></thead><tbody>{data.jobs.map((job: any) => <tr key={job.id}><td>{job.campaignId}<small>Requested by {job.requestedBy?.username || 'system'}</small></td><td>{job.status}<small>{job.lastError}</small></td><td>{job.sent || 0}</td><td>{job.uncertain || 0}</td><td>{job.remaining ?? 'In progress'}</td><td>{['queued','running'].includes(job.status) ? <button className="text-button" disabled={busy || !manage} onClick={() => void act(`campaigns/${job.campaignId}/pause`)}>Pause</button> : ['paused','needs_review'].includes(job.status) ? <button className="text-button" disabled={busy || !manage} onClick={() => { if(window.confirm('Resume only queued recipients? No uncertain message will be retried.')) void act(`campaigns/${job.campaignId}/resume`); }}>Resume queued</button> : '—'}</td></tr>)}</tbody></table></div>
        {!data.jobs.length && <p>No dispatch jobs yet.</p>}
      </section>
      <section className="panel"><h2>SMS recovery</h2><p>Check the provider's recorded result before deciding what happened. Reconciliation never sends another SMS.</p>
        {data.messages.map((m: any) => <div className="check-row" key={m.id} style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{m.id} · {m.status}</span><button className="btn btn-secondary btn-sm" disabled={busy || !manage} onClick={() => void act(`operations/messages/${m.id}`)}>Check provider result</button></div>)}
        {!data.messages.length && <p>No messages require review.</p>}
      </section>
      <section className="panel"><h2>DealerSocket recovery</h2><p>Verify the customer and opportunity in DealerSocket before recording an outcome. Confirmed missing records can be queued again; existing records are linked without another save.</p>
        {data.crm.map((job: any) => <div key={job.id} className="check-row" style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{job.customer || job.leadId} · {job.status}<small>{job.detail}</small></span>{job.status === 'needs_review' && <button className="btn btn-secondary btn-sm" disabled={busy || !manage} onClick={() => { const id = window.prompt('Enter the verified saved opportunity ID, or NOT SAVED only after confirming no record was created.'); if(!id) return; const evidence = window.prompt('Record the CRM evidence or support reference for this decision.'); if(!evidence) return; void act(`operations/crm/${job.leadId}`, { outcome: id.trim().toUpperCase() === 'NOT SAVED' ? 'confirmed_not_saved' : 'confirmed_saved', opportunityId: id.trim(), evidence }); }}>Record verified outcome</button>}</div>)}
        {!data.crm.length && <p>No CRM jobs require recovery.</p>}
      </section>
      <section className="panel"><h2>Provider callbacks and worker health</h2><p>Chrome worker: {data.worker?.state}. Callback signing secret: {data.callbacks?.signingSecretConfigured ? 'Configured' : 'Missing'}.</p><p>Last valid signed SMS callback: {data.callbacks?.lastVerifiedAt || 'Not received yet'}.</p>
        <button className="btn btn-secondary" disabled={busy || !admin} style={{ display: "inline-flex", alignItems: "center", gap: 8 }} onClick={async () => { setBusy(true); try { const result = await api('operations/provider'); setNotice(`Sender approved: ${result.approvedSender ? 'yes' : 'no'}. Provider signing secret: ${result.providerSigningSecretConfigured ? 'configured' : 'missing'}. Status callback matches configured URL: ${result.callbackMatches ? 'yes' : 'no'}. ${result.note}`); } catch(error) { setNotice((error as Error).message); } finally { setBusy(false); } }}>
          {busy ? <><Spinner size="xs" /> Checking setup…</> : "Check provider setup"}
        </button>
      </section>
    </>}
  </div>;
}
