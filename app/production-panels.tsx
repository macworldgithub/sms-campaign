"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
type Props = { tab: string; api: (path: string, body?: unknown) => Promise<any>; user: { id: string; role: string }; onUpdated: () => void };
export default function ProductionPanels({ tab, api, user, onUpdated }: Props) {
  const [data, setData] = useState<any>(null), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<any>({ username: "", name: "", role: "viewer", active: false });
  const manage = user.role !== "viewer", admin = user.role === "admin";
  const load = useCallback(async () => {
    try { setData(await api(tab === "Staff" ? "users" : tab === "Settings" ? "settings" : "operations")); }
    catch (error) { setNotice((error as Error).message); }
  }, [api, tab]);
  useEffect(() => { setData(null); setNotice(""); void load(); if(tab !== 'Operations') return; const t = setInterval(() => void load(), 10000); return () => clearInterval(t); }, [load, tab]);
  async function act(path: string, body: any = {}) {
    setBusy(true); setNotice("");
    try { const result = await api(path, body); setNotice(result.message || "Saved successfully."); await load(); onUpdated(); return result; }
    catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }
  if (!data) return <section className="panel"><p>{notice || "Loading workspace controls…"}</p></section>;
  return <div className="production-panels">
    {notice && <p className="notice" role="status">{notice}</p>}
    {tab === "Settings" && <section className="panel"><h2>Client-approved offer</h2><p>Set the final offer, eligibility and expiry. Sending remains blocked until approval and the other launch checks are complete.</p>
      <form onSubmit={async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); await act('settings', { offerName: f.get('offerName'), offerDetails: f.get('offerDetails'), eligibility: f.get('eligibility'), expiresAt: f.get('expiresAt'), clientApprovalConfirmed: f.get('approved') === 'on' }); }}>
        <label>Offer name<input name="offerName" required defaultValue={data.offerName || ''} disabled={!admin} /></label>
        <label>Approved offer details<textarea name="offerDetails" required maxLength={2000} defaultValue={data.offerDetails || ''} disabled={!admin} /></label>
        <label>Customer eligibility<textarea name="eligibility" required maxLength={2000} defaultValue={data.eligibility || ''} disabled={!admin} /></label>
        <label>Expiry date · end of day in Melbourne<input name="expiresAt" type="date" required defaultValue={data.expiresAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(new Date(data.expiresAt)) : ''} disabled={!admin} /></label>
        <label className="check-row"><input name="approved" type="checkbox" defaultChecked={data.clientApprovalConfirmed === true} disabled={!admin} /> Client has approved these offer terms and expiry</label>
        <p className="muted">Keep the supplied landing-page creative consistent with these approved terms. Each campaign's final SMS copy still requires its own approval.</p>
        <button className="btn btn-primary" disabled={busy || !admin}>Save offer configuration</button>
      </form></section>}
    {tab === "Staff" && admin && <>
      <section className="panel"><h2>Staff accounts and permissions</h2><p>The supplied names are staff records. They are not the campaign audience. New accounts require a temporary password and must change it on first sign-in.</p>
        <div className="table-container"><table><thead><tr><th>NAME</th><th>USERNAME</th><th>ROLE</th><th>ACCESS</th><th /></tr></thead><tbody>{data.map((u: any) => <tr key={u.id}><td>{u.name}<small>{u.businessRole}</small></td><td>{u.username}</td><td>{u.role.replaceAll('_', ' ')}</td><td>{u.active ? 'Active' : 'Disabled'}</td><td><button className="text-button" onClick={() => setEdit({ ...u })}>Manage</button></td></tr>)}</tbody></table></div>
      </section>
      <section className="panel"><h2>{edit.id ? 'Manage account' : 'Create account'}</h2>
        <form key={edit.id || 'new'} onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); const result = await act('users', { username: f.get('username'), name: f.get('name'), role: f.get('role'), active: f.get('active') === 'on', password: f.get('password') || undefined }); if(result) setEdit({ username: '', name: '', role: 'viewer', active: false }); }}>
          <label>Name<input name="name" defaultValue={edit.name} required /></label>
          <label>Username<input name="username" defaultValue={edit.username} readOnly={Boolean(edit.id)} required /></label>
          <label>Permission<select name="role" defaultValue={edit.role}><option value="viewer">Viewer · read only</option><option value="campaign_manager">Campaign Manager · audience and campaigns</option><option value="admin">Administrator · all settings and accounts</option></select></label>
          <label>Temporary password · required when creating or activating<input name="password" type="password" minLength={6} maxLength={256} autoComplete="new-password" required={!edit.id} /></label>
          <label className="check-row"><input name="active" type="checkbox" defaultChecked={edit.active} /> Enable this person's access</label>
          <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button className="btn btn-primary" disabled={busy}>Save account</button>
            <button className="btn btn-secondary" type="button" onClick={() => setEdit({ username: '', name: '', role: 'viewer', active: false })}>New account</button>
          </div>
        </form></section>
    </>}
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
        <button className="btn btn-secondary" disabled={busy || !admin} onClick={async () => { setBusy(true); try { const result = await api('operations/provider'); setNotice(`Sender approved: ${result.approvedSender ? 'yes' : 'no'}. Provider signing secret: ${result.providerSigningSecretConfigured ? 'configured' : 'missing'}. Status callback matches configured URL: ${result.callbackMatches ? 'yes' : 'no'}. ${result.note}`); } catch(error) { setNotice((error as Error).message); } finally { setBusy(false); } }}>Check provider setup</button>
      </section>
    </>}
  </div>;
}
