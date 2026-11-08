"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Spinner, TabLoader } from "./components/spinner";
import StaffAccounts from "./components/staff-accounts";

type Props = {
  tab: string;
  api: (path: string, body?: unknown) => Promise<any>;
  user: { id: string; role: string };
  onUpdated: () => void;
};

export default function ProductionPanels({ tab, api, user, onUpdated }: Props) {
  const [data, setData] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [expiry, setExpiry] = useState<string | null>(null);

  // Controlled form state for Client-approved offer
  const [offerName, setOfferName] = useState("");
  const [offerDetails, setOfferDetails] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [approved, setApproved] = useState(false);

  const manage = user.role !== "viewer";
  const admin = user.role === "admin";

  const load = useCallback(async () => {
    try {
      setData(await api(tab === "Staff" ? "users" : tab === "Settings" ? "settings" : "operations"));
    } catch (error) {
      setNotice((error as Error).message);
    }
  }, [api, tab]);

  useEffect(() => {
    setData(null);
    setNotice("");
    setExpiry(null);
    void load();
    if (tab !== "Operations") return;
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, [load, tab]);

  useEffect(() => {
    if (data && tab === "Settings") {
      setOfferName(data.offerName || "");
      setOfferDetails(data.offerDetails || "");
      setEligibility(data.eligibility || "");
      setApproved(data.clientApprovalConfirmed === true);
      setExpiry(
        data.expiresAt
          ? new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(
              new Date(data.expiresAt)
            )
          : null
      );
    }
  }, [data, tab]);

  async function act(path: string, body: any = {}) {
    setBusy(true);
    setNotice("");
    try {
      const result = await api(path, body);
      setNotice(
        result.message ||
          "Saved successfully to database (settings -> campaign-settings). Customer portal updated."
      );
      await load();
      onUpdated();
      return result;
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <TabLoader
        title={
          tab === "Staff"
            ? "Loading Staff Accounts & Permissions…"
            : tab === "Settings"
            ? "Loading Offer & Campaign Settings…"
            : "Loading Operations & Dispatch Queue…"
        }
        subtitle="Verifying administrative access and synchronizing cluster records"
      />
    );
  }

  const isOfferActive =
    Boolean(data.offerName) &&
    data.clientApprovalConfirmed === true &&
    Boolean(data.expiresAt) &&
    new Date(data.expiresAt).getTime() > Date.now();

  const isOfferExpired =
    Boolean(data.expiresAt) && new Date(data.expiresAt).getTime() <= Date.now();

  return (
    <div className="production-panels">
      {notice && (
        <p className="notice" role="status" style={{ fontWeight: 500 }}>
          {notice}
        </p>
      )}

      {tab === "Settings" && (
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                Client-Approved Offer Configuration
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0 0" }}>
                Set the verified client offer, customer eligibility criteria, and promotion expiry.
              </p>
            </div>
            <a
              href="/?view=customer"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, textDecoration: "none" }}
            >
              Preview Live Customer Page ↗
            </a>
          </div>

          {/* PERSISTENCE & DATA STORAGE TRANSPARENCY CARD */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "18px 20px",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <strong style={{ fontSize: 13, color: "var(--ink)" }}>Live Database Status:</strong>
                {isOfferActive ? (
                  <span className="badge badge-green">● Published & Active on /loyalty</span>
                ) : isOfferExpired ? (
                  <span className="badge" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                    ■ Offer Expired
                  </span>
                ) : data.offerName && !data.clientApprovalConfirmed ? (
                  <span className="badge badge-amber">▲ Pending Client Approval</span>
                ) : (
                  <span className="badge" style={{ background: "#e2e8f0", color: "#475569" }}>
                    ○ No Active Offer Saved
                  </span>
                )}
              </div>

              {data.updatedAt && (
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  Last updated {new Date(data.updatedAt).toLocaleString("en-AU", { timeZone: "Australia/Melbourne" })}
                  {data.updatedBy ? ` by ${data.updatedBy}` : ""}
                </span>
              )}
            </div>

            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
              <strong>Where is this data saved?</strong> Saved permanently in the MongoDB <strong>settings</strong> collection under key <code>campaign-settings</code>. It immediately updates the public Customer Loyalty landing page (<code>/loyalty</code>) and satisfies the broadcast sending safety check.
            </div>

            {data.offerName && (
              <div
                style={{
                  marginTop: 14,
                  background: "#ffffff",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "14px 16px",
                  display: "grid",
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  <strong style={{ color: "var(--ink-secondary)" }}>Saved Offer Title:</strong>{" "}
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{data.offerName}</span>
                </div>
                <div>
                  <strong style={{ color: "var(--ink-secondary)" }}>Approved Terms:</strong>{" "}
                  <span style={{ color: "var(--ink-secondary)", whiteSpace: "pre-line" }}>{data.offerDetails}</span>
                </div>
                <div>
                  <strong style={{ color: "var(--ink-secondary)" }}>Eligibility:</strong>{" "}
                  <span style={{ color: "var(--ink-secondary)", whiteSpace: "pre-line" }}>{data.eligibility}</span>
                </div>
                <div>
                  <strong style={{ color: "var(--ink-secondary)" }}>Melbourne Expiry:</strong>{" "}
                  <span style={{ color: "var(--ink-secondary)", fontWeight: 500 }}>
                    {data.expiresAt
                      ? new Intl.DateTimeFormat("en-AU", {
                          timeZone: "Australia/Melbourne",
                          dateStyle: "full",
                          timeStyle: "short",
                        }).format(new Date(data.expiresAt))
                      : "Not set"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              await act("settings", {
                offerName,
                offerDetails,
                eligibility,
                expiresAt: expiry,
                clientApprovalConfirmed: approved,
              });
            }}
          >
            <label>
              Offer name
              <input
                name="offerName"
                required
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
                disabled={!admin}
                placeholder="e.g. November Loyalty Programme Offer"
              />
            </label>

            <label>
              Approved offer details
              <textarea
                name="offerDetails"
                required
                maxLength={2000}
                value={offerDetails}
                onChange={(e) => setOfferDetails(e.target.value)}
                disabled={!admin}
                rows={4}
                placeholder="Provide detailed description of the offer terms..."
              />
            </label>

            <label>
              Customer eligibility
              <textarea
                name="eligibility"
                required
                maxLength={2000}
                value={eligibility}
                onChange={(e) => setEligibility(e.target.value)}
                disabled={!admin}
                rows={3}
                placeholder="Specify who is eligible to claim this offer..."
              />
            </label>

            <label>
              Expiry date · end of day in Melbourne
              <input
                name="expiresAt"
                type="date"
                lang="en-AU"
                required
                min={new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date())}
                value={expiry ?? ""}
                onChange={(event) => setExpiry(event.target.value)}
                disabled={!admin}
              />
            </label>

            <p className="muted" aria-live="polite">
              {expiry || data.expiresAt
                ? `Selected expiry: ${new Intl.DateTimeFormat("en-AU", {
                    timeZone: "Australia/Melbourne",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(expiry ? `${expiry}T12:00:00Z` : data.expiresAt))}, at the end of the day in Melbourne.`
                : "Choose the date using the calendar. Your browser may display month/day/year."}
            </p>

            <label className="check-row" style={{ marginTop: 12, marginBottom: 12 }}>
              <input
                name="approved"
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                disabled={!admin}
              />{" "}
              Client has approved these offer terms and expiry
            </label>

            <p className="muted" style={{ marginBottom: 20 }}>
              These approved terms will appear on the customer loyalty landing page (<code>/loyalty</code>).
            </p>

            <button
              className="btn btn-primary"
              disabled={busy || !admin}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              {busy ? (
                <>
                  <Spinner size="xs" color="#ffffff" trackColor="rgba(255,255,255,0.3)" /> Saving offer…
                </>
              ) : (
                "Save offer configuration"
              )}
            </button>
          </form>
        </section>
      )}

      {tab === "Staff" && admin && (
        <StaffAccounts
          users={data}
          currentUserId={user.id}
          onSave={async (input) => {
            await api("users", input);
            setNotice("Account saved. Enabled users can sign in with their username and password.");
            await load();
            onUpdated();
          }}
        />
      )}

      {tab === "Operations" && (
        <>
          <section className="panel">
            <h2>Background campaign dispatch</h2>
            <p>
              Queued jobs continue independently of this page. Pause stops after any current provider attempt; resuming processes only unsent queued recipients.
            </p>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>CAMPAIGN</th>
                    <th>STATUS</th>
                    <th>ACCEPTED</th>
                    <th>UNCERTAIN</th>
                    <th>REMAINING</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.jobs?.map((job: any) => (
                    <tr key={job.id}>
                      <td>
                        {job.campaignId}
                        <small>Requested by {job.requestedBy?.username || "system"}</small>
                      </td>
                      <td>
                        {job.status}
                        <small>{job.lastError}</small>
                      </td>
                      <td>{job.sent || 0}</td>
                      <td>{job.uncertain || 0}</td>
                      <td>{job.remaining ?? "In progress"}</td>
                      <td>
                        {["queued", "running"].includes(job.status) ? (
                          <button
                            className="text-button"
                            disabled={busy || !manage}
                            onClick={() => void act(`campaigns/${job.campaignId}/pause`)}
                          >
                            Pause
                          </button>
                        ) : ["paused", "needs_review"].includes(job.status) ? (
                          <button
                            className="text-button"
                            disabled={busy || !manage}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Resume only queued recipients? No uncertain message will be retried."
                                )
                              )
                                void act(`campaigns/${job.campaignId}/resume`);
                            }}
                          >
                            Resume queued
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.jobs?.length && <p>No dispatch jobs yet.</p>}
          </section>

          <section className="panel">
            <h2>SMS recovery</h2>
            <p>
              Check the provider's recorded result before deciding what happened. Reconciliation never sends another SMS.
            </p>
            {data.messages?.map((m: any) => (
              <div
                className="check-row"
                key={m.id}
                style={{
                  marginBottom: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  {m.id} · {m.status}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={busy || !manage}
                  onClick={() => void act(`operations/messages/${m.id}`)}
                >
                  Check provider result
                </button>
              </div>
            ))}
            {!data.messages?.length && <p>No messages require review.</p>}
          </section>

          <section className="panel">
            <h2>DealerSocket recovery</h2>
            <p>
              Verify the customer and opportunity in DealerSocket before recording an outcome. Confirmed missing records can be queued again; existing records are linked without another save.
            </p>
            {data.crm?.map((job: any) => (
              <div
                key={job.id}
                className="check-row"
                style={{
                  marginBottom: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  {job.customer || job.leadId} · {job.status}
                  <small>{job.detail}</small>
                </span>
                {job.status === "needs_review" && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy || !manage}
                    onClick={() => {
                      const id = window.prompt(
                        "Enter the verified saved opportunity ID, or NOT SAVED only after confirming no record was created."
                      );
                      if (!id) return;
                      const evidence = window.prompt(
                        "Record the CRM evidence or support reference for this decision."
                      );
                      if (!evidence) return;
                      void act(`operations/crm/${job.leadId}`, {
                        outcome:
                          id.trim().toUpperCase() === "NOT SAVED"
                            ? "confirmed_not_saved"
                            : "confirmed_saved",
                        opportunityId: id.trim(),
                        evidence,
                      });
                    }}
                  >
                    Record verified outcome
                  </button>
                )}
              </div>
            ))}
            {!data.crm?.length && <p>No CRM jobs require recovery.</p>}
          </section>

          <section className="panel">
            <h2>Provider callbacks and worker health</h2>
            <p>
              Chrome worker: {data.worker?.state}. Callback signing secret:{" "}
              {data.callbacks?.signingSecretConfigured ? "Configured" : "Missing"}.
            </p>
            <p>
              Last valid signed SMS callback: {data.callbacks?.lastVerifiedAt || "Not received yet"}.
            </p>
            <button
              className="btn btn-secondary"
              disabled={busy || !admin}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api("operations/provider");
                  setNotice(
                    `Sender approved: ${result.approvedSender ? "yes" : "no"}. Provider signing secret: ${
                      result.providerSigningSecretConfigured ? "configured" : "missing"
                    }. Status callback matches configured URL: ${result.callbackMatches ? "yes" : "no"}. ${
                      result.note
                    }`
                  );
                } catch (error) {
                  setNotice((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <><Spinner size="xs" /> Checking setup…</> : "Check provider setup"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
