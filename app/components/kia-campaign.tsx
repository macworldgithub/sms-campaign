"use client";

import { useEffect, useState } from "react";

type Row = { mobile: string; firstName: string; lastName: string; email: string; year: string; make: string; model: string; rego: string; suppressed: boolean; consentStatus: string; sendStatus: string };
type Data = {
  apiVersion?: number;
  campaign: { name: string; expectedSender: string; bookingUrl: string; sourceTemplate: string } | null;
  audience: { sourceRows: number; unique: number; duplicates: number; suppressed: number; invalidRows: { row: number; reason: string }[]; source: string; consentDocumentation: string } | null;
  rows: Row[]; total: number; page: number; pageCount: number;
  sms?: { body: string; preview?: string; characters: number; estimatedSegments: number; estimatedAudienceSegments: number; revision: number; editable: boolean; encoding: string };
  holds?: string[];
  ready: boolean;
  dispatch?: { eligible: number; top150: number; top500?: number; ranges?: { scope: string; start: number; end: number; eligible: number }[]; counts: Record<string, number>; jobStatus: string | null; lastError: string };
};

export default function KiaCampaign({ api, canManage = false }: { api: (path: string, body?: unknown) => Promise<Data>; canManage?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [choosing, setChoosing] = useState(false);
  const [scope, setScope] = useState("");
  const [review, setReview] = useState<{ scope: string; label: string; count: number; credits: number; revision: number; preview: string } | null>(null);
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editRevision, setEditRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const value = await api(`kiasmorang?page=${page}&search=${encodeURIComponent(search)}`);
        if (active) { setData(value); setError(""); }
        if (active && canManage && ["queued", "running"].includes(value.dispatch?.jobStatus || "")) {
          const progress = await api("kiasmorang/process", { page: String(page), search });
          if (active) setData(progress);
        }
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "Could not refresh dispatch."); }
      finally { loading = false; }
    };
    const timer = setTimeout(load, 200);
    const poll = setInterval(load, 5000);
    return () => { active = false; clearTimeout(timer); clearInterval(poll); };
  }, [api, page, search, canManage]);
  if (!data) return <section className="panel"><p role={error ? "alert" : "status"}>{error || "Loading the Kia campaign…"}</p></section>;
  if (!data.campaign || !data.audience) return <section className="panel"><h2>KIASMORANG</h2><p>The Kia owners workbook has not been imported yet.</p></section>;
  if (data.apiVersion !== 2) return <section className="panel"><h2>Backend update required</h2><p>The frontend is connected to an older Kia API. Restart the backend locally, or deploy the updated backend and refresh this page. Sending and SMS editing are unavailable until both versions match.</p></section>;
  const range = data.dispatch?.ranges?.find(item => item.scope === scope);
  const count = range?.eligible ?? 0;
  const label = range ? `Workbook positions ${range.start}–${range.end}` : "";
  const creditsPerRecipient = data.sms?.estimatedSegments ?? 0;
  let reviewBlockedReason = "";
  if (!canManage) reviewBlockedReason = "Campaign manager access is required.";
  else if (busy) reviewBlockedReason = "A campaign action is in progress.";
  else if (editing) reviewBlockedReason = "Save or cancel your message edits before reviewing.";
  else if (error) reviewBlockedReason = "Campaign refresh failed. " + error;
  else if (!count) reviewBlockedReason = "Choose a range with eligible recipients.";
  else if (!data.ready) reviewBlockedReason = data.holds?.join(" ") || "The backend reports that this campaign is not ready to send.";
  const submit = async () => {
    if (busy || !review?.count) return;
    setBusy(true); setNotice("");
    try {
      const result = await api("kiasmorang/send", { scope: review.scope, expectedCount: review.count, expectedRevision: review.revision, requestId }) as unknown as { selected: number };
      setNotice(`${result.selected} recipients queued for sending from KIASMORANG. Progress updates below.`);
      setChoosing(false);
      setData(await api(`kiasmorang?page=${page}&search=${encodeURIComponent(search)}`));
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : "Could not confirm dispatch. Check progress before trying again.");
      try { setData(await api(`kiasmorang?page=${page}&search=${encodeURIComponent(search)}`)); } catch { /* Retain the last known status. */ }
    } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setNotice("");
    try {
      await api("kiasmorang/sms", { body: draft, expectedRevision: editRevision });
      setData(await api(`kiasmorang?page=${page}&search=${encodeURIComponent(search)}`));
      setEditing(false); setNotice("SMS saved. No messages have been queued or sent.");
    } catch (failure) { setNotice(failure instanceof Error ? failure.message : "Could not save the SMS."); }
    finally { setBusy(false); }
  };
  return <>
    <section className="panel">
      <div className="panel-header"><div><h2>{data.campaign.name}</h2><p>South Morang Kia · Seltos Launch Party · 12–14 November 2026</p></div><span className="badge badge-amber">{data.dispatch?.jobStatus?.replaceAll("_", " ") || (data.ready ? "Ready to send" : "Sending unavailable")}</span></div>
      <p>Sender requested: <strong>{data.campaign.expectedSender}</strong> · <a href={data.campaign.bookingUrl} target="_blank" rel="noopener noreferrer">Book a test drive</a></p>
      <p>This workbook belongs only to the Kia Seltos campaign. Its records are separate from Hyundai and the general Audience list.</p>
      <div className="notice" role="status">{data.holds?.map(hold => <p key={hold}>{hold}</p>)}</div>
    </section>
    <section className="panel">
      <h3>Campaign SMS</h3>
      {editing ? <div>
        <label htmlFor="kia-sms-editor">Edit campaign message</label>
        <textarea id="kia-sms-editor" value={draft} onChange={event => setDraft(event.target.value)} disabled={busy} maxLength={1000} rows={7} style={{ display: "block", width: "100%", padding: 16, margin: "12px 0", lineHeight: 1.6, resize: "vertical", border: "1px solid #d8dee7", borderRadius: 8 }} />
        <p>{draft.length} characters. Messages must fit within four SMS parts; Unicode punctuation uses more parts. Keep the {"{{unsubscribeUrl}}"} placeholder: it becomes a private opt-out link for each recipient. Saving does not send anything.</p>
        <button className="btn btn-primary" disabled={busy || !draft.trim()} onClick={() => void save()}>{busy ? "Saving…" : "Save SMS"}</button>{" "}<button className="btn btn-secondary" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
      </div> : <><div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: 20, background: "#f8fafc", border: "1px solid #e1e5eb", borderRadius: 10, lineHeight: 1.8 }}>{data.sms?.preview || data.sms?.body}</div><button className="btn btn-secondary" disabled={!canManage || !data.sms?.editable || busy} onClick={() => { setDraft(data.sms?.body || ""); setEditRevision(data.sms?.revision || 0); setEditing(true); setNotice(""); }}>Edit SMS</button></>}
      {/reply\s+stop/i.test(data.sms?.body || "") && <p role="note">The saved copy says “Reply STOP”, but a named sender such as KIASMORANG cannot receive SMS replies. <a href="https://help.mobilemessage.com.au/sending-receiving-sms/how-unsubscribes-work" target="_blank" rel="noopener noreferrer">Mobile Message recommends a web opt-out for this sender.</a></p>}
      <p>{data.sms?.characters} characters · {data.sms?.encoding} · approximately {data.sms?.estimatedSegments} parts per recipient · {data.sms?.estimatedAudienceSegments.toLocaleString()} estimated credits for all eligible recipients. Balance is checked before queuing.</p>
      <p>{data.dispatch?.eligible.toLocaleString()} unsent eligible recipients. Ranges use fixed positions in the original workbook order; search and pagination do not change this selection. Suppressed, previously selected and frequency-limited numbers are excluded.</p>
      <fieldset disabled={busy || editing || !canManage} style={{ border: "1px solid #d8dee7", borderRadius: 8, padding: 16, margin: "16px 0" }}>
        <legend>Choose a recipient range</legend>
        {data.dispatch?.ranges ? (
          <select aria-label="Recipient range" value={scope} onChange={event => setScope(event.target.value)}>
            <option value="">Select a range</option>
            {data.dispatch.ranges.map(item => (
              <option key={item.scope} value={item.scope} disabled={!item.eligible}>
                {item.start.toLocaleString()}–{item.end.toLocaleString()} ({item.eligible.toLocaleString()} eligible)
              </option>
            ))}
          </select>
        ) : <p>Update the backend to enable recipient ranges.</p>}
        <p>Estimated {creditsPerRecipient} credits per recipient. Selected: <strong>{count.toLocaleString()} recipients</strong> · approximately {(creditsPerRecipient * count).toLocaleString()} credits.</p>
      </fieldset>
      <button className="btn btn-primary" disabled={!!reviewBlockedReason} aria-describedby={reviewBlockedReason ? "kia-review-blocked" : undefined} onClick={() => { setRequestId(crypto.randomUUID()); setReview({ scope, label, count, credits: count * (data.sms?.estimatedSegments || 0), revision: data.sms?.revision || 0, preview: data.sms?.preview || data.sms?.body || "" }); setChoosing(true); setNotice(""); }}>Review send to {count.toLocaleString()}</button>
      {reviewBlockedReason && <p id="kia-review-blocked" role="status">{reviewBlockedReason}</p>}
      {notice && <p role="status">{notice}</p>}
      {data.dispatch?.jobStatus && <p role="status">Queued: {data.dispatch.counts.queued || 0} · Sending: {data.dispatch.counts.sending || 0} · Sent: {data.dispatch.counts.sent || 0} · Delivered: {data.dispatch.counts.delivered || 0} · Failed: {data.dispatch.counts.failed || 0} · Unknown: {data.dispatch.counts.unknown || 0} · Suppressed/skipped: {(data.dispatch.counts.suppressed || 0) + (data.dispatch.counts.frequency_limited || 0)}</p>}
      {data.dispatch?.jobStatus && <p>Keep this tab open while sending on a serverless host. A continuously running backend worker can continue without the browser.</p>}
      {data.dispatch?.lastError && <p role="alert">{data.dispatch.lastError} Check Operations for recovery.</p>}
    </section>
    <section className="panel">
      <h3>Kia campaign audience</h3>
      <p>{data.audience.sourceRows.toLocaleString()} source rows · <strong>{data.audience.unique.toLocaleString()} valid unique mobiles</strong> · {data.audience.duplicates} duplicates · {data.audience.invalidRows.length} invalid rows · {data.audience.suppressed} suppressed</p>
      <p>Source: {data.audience.source}</p><p>{data.audience.consentDocumentation}</p>
      <details><summary>Invalid source rows ({data.audience.invalidRows.length})</summary>{data.audience.invalidRows.map(row => <p key={row.row}>Excel row {row.row}: {row.reason}</p>)}</details>
      <label style={{ display: "block", margin: "16px 0" }}>Search Kia audience<input aria-label="Search Kia audience" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Name or mobile" style={{ display: "block", width: "100%", marginTop: 8, padding: 12, border: "1px solid #d8dee7", borderRadius: 7 }} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="table-container"><table><thead><tr><th>NAME</th><th>CONTACT</th><th>AUDIENCE</th><th>STATUS</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.mobile}><td>{row.firstName} {row.lastName}</td><td>{row.mobile}<small style={{ display: "block" }}>{row.email}</small></td><td>KIASMORANG</td><td>{row.sendStatus?.replaceAll("_", " ") || (row.suppressed ? "Suppressed · excluded" : "Staged · not sent")}<small style={{ display: "block" }}>Consent: {row.consentStatus}</small></td></tr>)}</tbody></table></div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18 }}><span>{data.total.toLocaleString()} matches · page {data.page} of {data.pageCount}</span><button className="btn btn-secondary" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Previous</button><button className="btn btn-secondary" disabled={data.page >= data.pageCount} onClick={() => setPage(data.page + 1)}>Next</button></div>
    </section>
    {choosing && review && <div className="modal-overlay"><section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="kia-send-title">
      <h2 id="kia-send-title">Confirm campaign send</h2>
      <p>Selection: {review.label}. Cancel to change your selection.</p>
      <p><strong>Send from KIASMORANG to {review.count.toLocaleString()} recipients.</strong> Estimated credits: {review.credits.toLocaleString()}.</p>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{review.preview}</p>
      <p>This sends real SMS. Previously selected customers will not be sent this campaign again.</p>
      {notice && <p role="alert">{notice}</p>}
      <div className="modal-footer"><button className="btn btn-secondary" disabled={busy} onClick={() => setChoosing(false)}>Cancel</button><button className="btn btn-primary" disabled={busy || !canManage || !data.ready || !review.count} onClick={() => void submit()}>{busy ? "Queueing…" : `Confirm send to ${review.count.toLocaleString()}`}</button></div>
    </section></div>}
  </>;
}
