"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
type Row = Record<string, string | number | null>;
type Data = {
  metrics: Record<string, number>;
  campaigns: Row[];
  contacts: Row[];
  leads: Row[];
  suppressions: Row[];
  activity: Row[];
  readiness: Record<string, string | boolean>;
};
const tabs = [
  "Overview",
  "Campaigns",
  "Audience",
  "Leads",
  "Suppression",
  "Reports",
  "Integrations",
];
const icons = ["◫", "↗", "♙", "▤", "⊘", "▥", "◇"];
const initialCopy =
  "Booran South Morang Hyundai: An exclusive loyalty offer for valued customers. Explore yours: {link} {optout}";
function Badge({
  children,
  green = false,
}: {
  children: React.ReactNode;
  green?: boolean;
}) {
  return <span className={`badge ${green ? "green" : ""}`}>{children}</span>;
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <span>◇</span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function date(v: unknown) {
  return v
    ? new Date(String(v)).toLocaleString("en-AU", {
        timeZone: "Australia/Melbourne",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}
export default function Home() {
  const [tab, setTab] = useState("Overview"),
    [data, setData] = useState<Data | null>(null),
    [signed, setSigned] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(false),
    [copy, setCopy] = useState(initialCopy),
    [query, setQuery] = useState("");
  const [dealer, setDealer] = useState<{
    session?: { state?: string; message?: string };
    snapshot?: {
      state?: string;
      records?: Row[];
      fetchedAt?: string;
      coverageNote?: string;
    };
  } | null>(null);
  const [routing, setRouting] = useState<{
    salesManager: string;
    generalManager: string;
    catalog: { observedAt?: string; users: { value: string; text: string }[] };
  } | null>(null);
  const [senders, setSenders] = useState<
    { sender: string; label?: string; type: string }[]
  >([]);
  const [sms, setSms] = useState<{ results: Row[]; tests: Row[]; activities: Row[] } | null>(null);
  const [testRequestId, setTestRequestId] = useState<string | null>(null);
  const api = useCallback(async (path: string, body?: unknown) => {
    const response = await fetch(`/api/portal/${path}`, {
      method: body === undefined ? "GET" : "POST",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    const result = await response.json();
    if (response.status === 401) setSigned(false);
    if (!response.ok) throw new Error(result.message || "Request failed");
    return result;
  }, []);
  const refresh = useCallback(async () => {
    try {
      setData(await api("portal"));
      setSigned(true);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }, [api]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (signed && tab === "Integrations")
      void api("routing")
        .then(setRouting)
        .catch(() => {});
  }, [signed, tab, api]);
  useEffect(() => {
    if (!signed || tab !== "Integrations") return;
    const load = () =>
      void api("dealersocket")
        .then(setDealer)
        .catch(() => {});
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [signed, tab, api]);
  useEffect(() => {
    if (!signed) return;
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [signed, refresh]);
  async function action(path: string, body: unknown = {}) {
    setBusy(true);
    setNotice("");
    try {
      const result = await api(path, body);
      setNotice(
        result.sent !== undefined
          ? `${result.sent} accepted; ${result.uncertain} require review.`
          : "Saved successfully.",
      );
      await refresh();
      return result;
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("login", {
        password: new FormData(e.currentTarget).get("password"),
      });
      setNotice("");
      await refresh();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const m = data?.metrics || {};
  const filtered = (rows: Row[]) =>
    rows.filter((r) =>
      Object.values(r).join(" ").toLowerCase().includes(query.toLowerCase()),
    );
  async function importFile(file: File) {
    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Choose a file smaller than 5 MB.");
      const workbook = file.name.toLowerCase().endsWith(".xlsx");
      const encoded = workbook
        ? await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
        : "";
      const result = await api(
        workbook ? "contacts/import-workbook" : "contacts/import",
        workbook ? { base64: encoded } : { rows: parseCSV(await file.text()) },
      );
      setNotice(
        `${result.imported} imported · ${result.duplicates} duplicates · ${result.rejected.length} rejected${result.rejected.length ? `: row ${result.rejected[0].row} — ${result.rejected[0].reason}` : ""}`,
      );
      await refresh();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            b<i>•</i>
          </span>
          <div>
            BOORAN<small>LOYALTY STUDIO</small>
          </div>
        </a>
        <div className="workspace">
          <span className="workspace-icon">H</span>
          <div>
            <strong>South Morang Hyundai</strong>
            <small>Booran Motors Group</small>
          </div>
          <span>⌄</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {tabs.map((name, i) => (
            <button
              className={tab === name ? "active" : ""}
              key={name}
              onClick={() => {
                setTab(name);
                setQuery("");
              }}
            >
              <span className="nav-icon">{icons[i]}</span>
              {name}
              {name === "Leads" && m.pending > 0 && (
                <span className="nav-count">{m.pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span>✧</span>
            <strong>
              A little loyalty.
              <br />A lasting connection.
            </strong>
            <p>Bring your customers back to what moves them.</p>
          </div>
          <div className="user">
            <span className="avatar">SM</span>
            <div>
              <strong>Campaign workspace</strong>
              <small>South Morang Hyundai</small>
            </div>
          </div>
          <span className="powered">
            Powered by <b>OmniSuiteAI</b>
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <i>/</i> <strong>{tab}</strong>
          </span>
          <div className="top-actions">
            <span>◷ &nbsp; Melbourne time</span>
            <button
              className="icon-button"
              title="Refresh data"
              onClick={() => void refresh()}
            >
              ↻
            </button>
            <span className="avatar small">SM</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                SOUTH MORANG HYUNDAI · LOYALTY PROGRAMME
              </p>
              <h1>{tab === "Overview" ? "Every connection counts." : tab}</h1>
              <p>
                {tab === "Overview"
                  ? "Your loyalty campaign, from first message to the next conversation."
                  : (
                      {
                        Campaigns:
                          "Thoughtful messages. Meaningful customer connections.",
                        Audience:
                          "Consented customers, organised and ready to reconnect.",
                        Leads: "New conversations, ready for your sales team.",
                        Suppression:
                          "Respect every preference. Keep your do-not-contact list up to date.",
                        Reports:
                          "The results behind every customer connection.",
                        Integrations: "Connect your campaign from end to end.",
                      } as Record<string, string>
                    )[tab]}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={() => setTab("Audience")}
              >
                ↑ &nbsp; Import audience
              </button>
              <button className="button primary" onClick={() => setModal(true)}>
                ＋ &nbsp; New campaign
              </button>
            </div>
          </div>
          {!signed ? (
            <div className="login-wrap">
              <section className="panel login">
                <p className="eyebrow">BOORAN / LOYALTY STUDIO</p>
                <h2>Welcome to your workspace.</h2>
                <p>Sign in to manage campaigns and customer connections.</p>
                <form onSubmit={login}>
                  <label>
                    Portal password
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <button className="button primary" disabled={busy}>
                    {busy ? "Signing in…" : "Sign in →"}
                  </button>
                </form>
                {notice && (
                  <p className="error" role="alert">
                    {notice}
                  </p>
                )}
              </section>
            </div>
          ) : (
            <>
              {notice && (
                <div className="notice" role="status">
                  {notice}
                  <button aria-label="Dismiss" onClick={() => setNotice("")}>
                    ×
                  </button>
                </div>
              )}
              {(tab === "Overview" || tab === "Reports") && (
                <>
                  <div className="metrics">
                    {[
                      [
                        "Eligible audience",
                        m.eligible,
                        "Consented & ready to reach",
                        "♙",
                      ],
                      [
                        "Messages sent",
                        m.sent,
                        `${m.delivered || 0} confirmed delivered`,
                        "↗",
                      ],
                      ["Link visits", m.clicks, "Tracked campaign visits", "⌁"],
                      [
                        "Leads captured",
                        m.leads,
                        `${m.pending || 0} awaiting CRM delivery`,
                        "⚑",
                      ],
                    ].map(([title, value, sub, icon]) => (
                      <section className="metric" key={String(title)}>
                        <div>
                          <span>{title}</span>
                          <span className="metric-icon">{icon}</span>
                        </div>
                        <strong>{Number(value || 0).toLocaleString()}</strong>
                        <small>{sub}</small>
                      </section>
                    ))}
                  </div>
                  <div className="overview-grid">
                    <section className="hero-card">
                      <div className="hero-content">
                        <span className="hero-tag">
                          CUSTOMER LOYALTY, REIMAGINED
                        </span>
                        <h2>
                          The next chapter
                          <br />
                          starts with a message.
                        </h2>
                        <p>
                          Invite your Hyundai customers back with a personal
                          offer and a seamless loyalty experience.
                        </p>
                        <button
                          className="button white"
                          onClick={() => setModal(true)}
                        >
                          Build your campaign <span>↗</span>
                        </button>
                      </div>
                      <div className="hero-art" aria-hidden="true">
                        <div className="orbit one" />
                        <div className="orbit two" />
                        <div className="message-art">
                          <span className="art-logo">H</span>
                          <b>
                            A little thank you.
                            <br />
                            Just for you.
                          </b>
                          <span>Your Hyundai loyalty reward awaits.</span>
                          <i>Explore your offer ↗</i>
                        </div>
                        <div className="floating-check">✓</div>
                      </div>
                      <span className="hero-foot">
                        BOORAN SOUTH MORANG HYUNDAI
                      </span>
                    </section>
                    <section className="panel readiness">
                      <div className="section-heading">
                        <h2>Launch readiness</h2>
                        <Badge>9 NOV TARGET</Badge>
                      </div>
                      <p>Everything in place for a confident launch.</p>
                      {[
                        ["Audience uploaded", m.contacts > 0],
                        [
                          "Campaign copy approved",
                          data!.campaigns.some((c) => c.approved),
                        ],
                        ["Mobile Message configured", data!.readiness.provider],
                        [
                          "Sender ID confirmed",
                          data!.readiness.senderRegistered,
                        ],
                        ["Public tracking URL", data!.readiness.publicUrl],
                      ].map(([label, ready]) => (
                        <div className="check-row" key={String(label)}>
                          <span className={`check ${ready ? "done" : ""}`}>
                            {ready ? "✓" : "○"}
                          </span>
                          <span>{label}</span>
                          <small>{ready ? "Ready" : "Pending"}</small>
                        </div>
                      ))}
                      <button
                        className="text-button"
                        onClick={() => setTab("Integrations")}
                      >
                        View integrations <span>→</span>
                      </button>
                    </section>
                  </div>
                </>
              )}
              {(tab === "Overview" || tab === "Campaigns") && (
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>
                        Your campaigns{" "}
                        <span className="count">{data!.campaigns.length}</span>
                      </h2>
                      <p>Meaningful outreach, managed in one place.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setModal(true)}
                    >
                      Create campaign ＋
                    </button>
                  </div>
                  {!data!.campaigns.length ? (
                    <Empty
                      title="Your next connection starts here"
                      detail="Create your first loyalty campaign, import your consented audience, and prepare your message."
                    />
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>CAMPAIGN</th>
                            <th>STATUS</th>
                            <th>RECIPIENTS</th>
                            <th>CREATED</th>
                            <th>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.campaigns.map((c) => (
                            <tr key={c.id}>
                              <td>
                                <strong>{c.name}</strong>
                                <small>South Morang Hyundai · SMS</small>
                              </td>
                              <td>
                                <Badge green={c.status === "completed"}>
                                  {String(c.status).replaceAll("_", " ")}
                                </Badge>
                              </td>
                              <td>{c.recipients}</td>
                              <td>{date(c.createdAt)}</td>
                              <td>
                                {c.status === "draft" ? (
                                  <button
                                    disabled={busy}
                                    className="text-button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Approve the final copy?\n\n${c.body}`,
                                        )
                                      )
                                        void action(
                                          `campaigns/${c.id}/approve`,
                                        );
                                    }}
                                  >
                                    Review & approve
                                  </button>
                                ) : c.status === "approved" ? (
                                  <button
                                    disabled={busy}
                                    className="text-button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          "Send this campaign to every eligible recipient? This sends real SMS.",
                                        )
                                      )
                                        void action(`campaigns/${c.id}/send`);
                                    }}
                                  >
                                    Send campaign ↗
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
                  )}
                </section>
              )}
              {tab === "Audience" && (
                <>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Import your audience</h2>
                        <p>
                          CSV or XLSX columns: mobile, consent, evidence.
                          Optional: firstName, lastName.
                        </p>
                      </div>
                      <a
                        className="button secondary"
                        href="/audience-template.csv"
                        download
                      >
                        ↓ CSV template
                      </a>
                    </div>
                    <label className="upload-zone">
                      <span>↑</span>
                      <strong>Choose a customer list</strong>
                      <small>
                        CSV or XLSX · up to 10,000 records · Australian mobile
                        numbers
                      </small>
                      <input
                        type="file"
                        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void importFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>
                        Customer audience{" "}
                        <span className="count">{m.contacts}</span>
                      </h2>
                      <input
                        className="search"
                        aria-label="Search customers"
                        placeholder="Search customers…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    {data!.contacts.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>CUSTOMER</th>
                              <th>MOBILE</th>
                              <th>CONSENT</th>
                              <th>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered(data!.contacts).map((c) => (
                              <tr key={c.id}>
                                <td>
                                  <strong>
                                    {c.firstName} {c.lastName}
                                  </strong>
                                  <small>{c.evidence}</small>
                                </td>
                                <td>{c.mobile}</td>
                                <td>{c.consent}</td>
                                <td>
                                  <Badge green={!c.suppressionReason}>
                                    {c.suppressionReason || "Eligible"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        title="A fresh start for your audience"
                        detail="Upload your consented list. Duplicate and invalid mobile numbers are checked automatically."
                      />
                    )}
                  </section>
                </>
              )}
              {tab === "Leads" && (
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Captured leads</h2>
                      <p>
                        Registration immediately suppresses further campaign
                        messages.
                      </p>
                    </div>
                    <Badge>{m.pending || 0} PENDING CRM</Badge>
                  </div>
                  {data!.leads.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>CUSTOMER</th>
                            <th>CONTACT</th>
                            <th>CRM DELIVERY</th>
                            <th>REGISTERED</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data!.leads.map((l) => (
                            <tr key={l.id}>
                              <td>
                                <strong>
                                  {l.firstName} {l.lastName}
                                </strong>
                              </td>
                              <td>
                                {l.mobile}
                                <small>{l.email}</small>
                              </td>
                              <td>
                                <Badge>
                                  {String(l.crmStatus).replaceAll("_", " ")}
                                </Badge>
                                <small>{l.crmDetail}</small>
                                {!l.dealerSocketContactId &&
                                  [
                                    "pending_configuration",
                                    "needs_match",
                                  ].includes(String(l.crmStatus)) && (
                                    <button
                                      className="text-button"
                                      style={{ marginTop: 10 }}
                                      onClick={() => {
                                        const contactId = window.prompt(
                                          "Matching DealerSocket customer ID. The customer mobile will be checked before any save.",
                                        );
                                        if (contactId)
                                          void action(
                                            `leads/${l.id}/customer`,
                                            { contactId },
                                          );
                                      }}
                                    >
                                      Link existing customer →
                                    </button>
                                  )}
                              </td>
                              <td>{date(l.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="Ready for the first conversation"
                      detail="Leads appear here when the loyalty experience submits a registration to the campaign webhook."
                    />
                  )}
                </section>
              )}
              {tab === "Suppression" && (
                <>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Protect customer preferences</h2>
                        <p>
                          STOP replies and registrations are suppressed
                          automatically.
                        </p>
                      </div>
                      <Badge green>CHECKED BEFORE EVERY SEND</Badge>
                    </div>
                    <form
                      className="inline-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const result = await action("suppressions", {
                          mobile: new FormData(form).get("mobile"),
                        });
                        if (result) form.reset();
                      }}
                    >
                      <label>
                        Australian mobile
                        <input
                          name="mobile"
                          placeholder="04xx xxx xxx"
                          required
                        />
                      </label>
                      <button disabled={busy} className="button primary">
                        Add to suppression list
                      </button>
                    </form>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>
                        Suppressed numbers{" "}
                        <span className="count">{m.suppressed}</span>
                      </h2>
                    </div>
                    {data!.suppressions.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>MOBILE</th>
                              <th>REASON</th>
                              <th>ADDED</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data!.suppressions.map((s) => (
                              <tr key={s.mobile}>
                                <td>{s.mobile}</td>
                                <td>{s.reason}</td>
                                <td>{date(s.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        title="No suppressed numbers yet"
                        detail="Opt-outs and lead registrations are retained across every campaign."
                      />
                    )}
                  </section>
                </>
              )}
              {tab === "Integrations" && (
                <>
                  <div className="integration-grid">
                    <section className="panel integration">
                      <span className="integration-logo red">M•</span>
                      <Badge green={Boolean(data!.readiness.provider)}>
                        {data!.readiness.provider
                          ? "Configured"
                          : "Needs credentials"}
                      </Badge>
                      <h2>Mobile Message</h2>
                      <p>
                        Verified SMS, automatic opt-out instructions and
                        delivery receipts.
                      </p>
                      <small>
                        {String(data!.readiness.frequencyPolicy || "")}
                      </small>
                      <dl>
                        <div>
                          <dt>Sender</dt>
                          <dd>{String(data!.readiness.senderId)}</dd>
                        </div>
                        <div>
                          <dt>Live sending</dt>
                          <dd>
                            {data!.readiness.sendingEnabled
                              ? "Enabled"
                              : "Disabled"}
                          </dd>
                        </div>
                      </dl>
                      <p>Test recipient: {String(data!.readiness.testRecipient || 'Not configured')}. Test messages do not launch a campaign.</p>
                      <button className="button secondary" disabled={busy || !data!.readiness.testSendingEnabled}
                        onClick={async () => {
                          if (!window.confirm(`Send one connection-test SMS to ${data!.readiness.testRecipient}?`)) return;
                          setBusy(true);
                          const requestId = testRequestId || crypto.randomUUID();
                          setTestRequestId(requestId);
                          try {
                            const result = await api('sms/test', { requestId });
                            setNotice(`Test SMS status: ${result.status}. Unknown means check with the provider before another attempt.`);
                            setSms(await api('sms/inbox'));
                          } catch (error) { setNotice((error as Error).message); }
                          finally { setBusy(false); }
                        }}>Send connection test</button>
                      <button className="button secondary" disabled={busy} onClick={async () => {
                        setBusy(true);
                        try { const result = await api('sms/inbox/sync', {}); setSms(result); setNotice(result.truncated ? 'Showing a bounded reply history; additional records remain with the provider.' : 'Replies refreshed for the configured sender.'); }
                        catch (error) { setNotice((error as Error).message); }
                        finally { setBusy(false); }
                      }}>Refresh SMS replies</button>
                      {sms && <div style={{ marginTop: 16 }}>
                        <h3>Recent test messages</h3>
                        {sms.tests.length === 0 && <p>No test messages yet.</p>}
                        {sms.tests.map(row => <p key={String(row.id)}>{String(row.recipient)} · {String(row.status)} · {date(row.createdAt)}</p>)}
                        <h3>SMS replies</h3>
                        {sms.results.length === 0 && <p>No replies received for this sender.</p>}
                        {sms.results.map(row => <p key={String(row.id)}><strong>{String(row.mobile)}</strong> · {date(row.receivedAt)}<br />{String(row.body)}</p>)}
                        <h3>DealerSocket SMS activity</h3>
                        <p>Only conversations linked to this portal's campaigns enter the CRM queue.</p>
                        {sms.activities?.length === 0 && <p>No SMS activity jobs yet.</p>}
                        {sms.activities?.map(row => <div key={String(row.id)}><p>{String(row.mobile)} · {String(row.direction)} · {String(row.status)}<br />{String(row.detail || '')}</p>
                          {row.status === 'needs_match' && <button className="button secondary" disabled={busy} onClick={async () => {
                            const contactId = window.prompt('Verified DealerSocket customer ID');
                            if (!contactId) return;
                            const opportunityId = window.prompt('Verified opportunity ID for that customer');
                            if (!opportunityId) return;
                            setBusy(true);
                            try { await api(`sms/activity/${row.id}/customer`, { contactId, opportunityId }); setSms(await api('sms/inbox')); }
                            catch (error) { setNotice((error as Error).message); }
                            finally { setBusy(false); }
                          }}>Link customer and opportunity</button>}
                        </div>)}
                      </div>}
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={async () => {
                          try {
                            const result = await api("provider");
                            setSenders(result.results || []);
                            setNotice(
                              "Mobile Message connection verified. Available senders are shown below.",
                            );
                          } catch (error) {
                            setNotice((error as Error).message);
                          }
                        }}
                      >
                        Check approved senders ↗
                      </button>
                      {senders.length > 0 && (
                        <label style={{ marginTop: 18 }}>
                          Available account senders
                          <select
                            aria-label="Available account senders"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              View approved senders
                            </option>
                            {senders.map((s) => (
                              <option key={s.sender} value={s.sender}>
                                {s.label || s.sender} · {s.type}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </section>
                    <section className="panel integration">
                      <span className="integration-logo dark">DS</span>
                      <Badge>
                        {dealer?.session?.state ||
                          (data!.readiness.dealerSocket
                            ? "Configured"
                            : "Not connected")}
                      </Badge>
                      <h2>DealerSocket</h2>
                      <p>
                        {dealer?.session?.message ||
                          "Read CRM leads using your existing authenticated browser connector."}
                      </p>
                      <div className="integration-actions">
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={async () => {
                            try {
                              setDealer(await api("dealersocket"));
                            } catch (error) {
                              setNotice((error as Error).message);
                            }
                          }}
                        >
                          Check connection
                        </button>
                        {data!.readiness.dealerSocketMode !== "chrome" && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => void action("dealersocket/login")}
                          >
                            Sign in
                          </button>
                        )}
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => void action("dealersocket/sync")}
                        >
                          Refresh leads ↻
                        </button>
                      </div>
                      <small>
                        Sales Manager and General Manager routing is configured
                        below. Live CRM writes remain disabled until tested.
                      </small>
                    </section>
                    <section className="panel integration">
                      <span className="integration-logo cream">G</span>
                      <Badge>Coming soon</Badge>
                      <h2>Goodshowroom</h2>
                      <p>It will be integrated soon</p>
                    </section>
                  </div>
                  {routing && (
                    <section className="panel">
                      <div className="section-heading">
                        <div>
                          <h2>Lead routing · South Morang Hyundai</h2>
                          <p>
                            One opportunity, shared with both managers.
                            DealerSocket uses Primary and Secondary assignees.
                          </p>
                        </div>
                        <Badge>DEALERSHIP 10876</Badge>
                      </div>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await action("routing", {
                            salesManager: routing.salesManager,
                            generalManager: routing.generalManager,
                          });
                        }}
                      >
                        <div className="routing-fields">
                          <label>
                            Sales Manager · Primary
                            <select
                              required
                              value={routing.salesManager}
                              onChange={(e) =>
                                setRouting({
                                  ...routing,
                                  salesManager: e.target.value,
                                })
                              }
                            >
                              <option value="">Select Sales Manager</option>
                              {routing.catalog.users.map((u) => (
                                <option key={u.value} value={u.value}>
                                  {u.text}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            General Manager · Secondary
                            <select
                              required
                              value={routing.generalManager}
                              onChange={(e) =>
                                setRouting({
                                  ...routing,
                                  generalManager: e.target.value,
                                })
                              }
                            >
                              <option value="">Select General Manager</option>
                              {routing.catalog.users.map((u) => (
                                <option key={u.value} value={u.value}>
                                  {u.text}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="modal-footer">
                          <span className="muted">
                            Assignee options verified from the live South Morang
                            Hyundai form.
                          </span>
                          <button className="button primary" disabled={busy}>
                            Save routing →
                          </button>
                        </div>
                      </form>
                    </section>
                  )}
                  {dealer?.snapshot && (
                    <section className="panel">
                      <div className="section-heading">
                        <h2>DealerSocket snapshot</h2>
                        <Badge>{dealer.snapshot.state || "No snapshot"}</Badge>
                      </div>
                      <p className="muted">
                        Observed {date(dealer.snapshot.fetchedAt)} ·{" "}
                        {dealer.snapshot.records?.length || 0} records. CRM
                        records do not establish SMS consent.
                      </p>
                      <p>{dealer.snapshot.coverageNote}</p>
                      {dealer.snapshot.records?.length ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>CUSTOMER</th>
                                <th>ROOFTOP</th>
                                <th>ASSIGNED TO</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dealer.snapshot.records
                                .slice(0, 100)
                                .map((r, i) => (
                                  <tr key={i}>
                                    <td>
                                      {r.first_name ||
                                        r.customer_name ||
                                        "Customer"}{" "}
                                      {r.last_name}
                                    </td>
                                    <td>{r.rooftop}</td>
                                    <td>{r.assigned_salesperson || "—"}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </section>
                  )}
                </>
              )}
              {(tab === "Overview" || tab === "Reports") && (
                <div className="bottom-grid">
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Recent activity</h2>
                      <span className="muted">Campaign audit trail</span>
                    </div>
                    {data!.activity.length ? (
                      <div className="activity-list">
                        {data!.activity.slice(0, 8).map((a) => (
                          <div className="activity-item" key={a.id}>
                            <span className="activity-dot" />
                            <div>
                              <strong>{a.action}</strong>
                              <p>{a.detail}</p>
                            </div>
                            <time>{date(a.createdAt)}</time>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="A clear trail, from the start"
                        detail="Imports, approvals, registrations and sends will be recorded here."
                      />
                    )}
                  </section>
                  <section className="panel journey">
                    <p className="eyebrow">BUILT FOR BETTER CONNECTIONS</p>
                    <h2>
                      A simple path back
                      <br />
                      to your showroom.
                    </h2>
                    {[
                      "Reach your consented audience",
                      "Explore the loyalty experience",
                      "Register interest",
                      "Start the next conversation",
                    ].map((step, i) => (
                      <div className="journey-step" key={step}>
                        <span>0{i + 1}</span>
                        {step}
                      </div>
                    ))}
                  </section>
                </div>
              )}
              {tab === "Reports" && (
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>Campaign performance</h2>
                      <p>
                        Actual campaign totals. Link visits include repeat
                        visits.
                      </p>
                    </div>
                  </div>
                  <div className="report-grid">
                    {[
                      ["Delivered", m.delivered || 0],
                      ["Opt-outs", m.optOuts || 0],
                      ["Leads registered", m.leads || 0],
                      ["Suppressed numbers", m.suppressed || 0],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <footer>
                <span>© {new Date().getFullYear()} Booran Motors Group</span>
                <span>Customer loyalty, thoughtfully connected.</span>
                <button
                  className="text-button"
                  onClick={async () => {
                    await api("logout", {});
                    setSigned(false);
                    setData(null);
                  }}
                >
                  Sign out ↗
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
      {modal && signed && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-heading">
              <h2 id="campaign-title">Create a loyalty campaign</h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal(false)}
              >
                ×
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await action("campaigns", {
                  name: new FormData(e.currentTarget).get("name"),
                  body: copy,
                });
                if (result) {
                  setModal(false);
                  setTab("Campaigns");
                }
              }}
            >
              <label>
                Campaign name
                <input
                  name="name"
                  placeholder="November loyalty invitation"
                  maxLength={200}
                  required
                />
              </label>
              <label>
                Message
                <textarea
                  value={copy}
                  onChange={(e) => setCopy(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  required
                />
              </label>
              <p className="field-help">
                Use {"{firstName}"} to personalise, {"{link}"} for tracking, and{" "}
                {"{optout}"} for unsubscribe instructions. Unicode can increase
                SMS parts.
              </p>
              <div className="sms-preview">
                <span>MESSAGE PREVIEW</span>
                <p>
                  {copy
                    .replaceAll("{firstName}", "Alex")
                    .replaceAll("{link}", "https://your-domain/r/…")
                    .replaceAll("{optout}", "Opt out: [provider instructions]")}
                </p>
              </div>
              <div className="modal-footer">
                <span className="muted">
                  {copy.length} template characters · draft only
                </span>
                <button disabled={busy} className="button primary">
                  Save campaign →
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function parseCSV(source: string) {
  const records: string[][] = [];
  let record: string[] = [],
    field = "",
    quoted = false;
  const value = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') {
      if (quoted && value[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      record.push(field.trim());
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && value[i + 1] === "\n") i++;
      record.push(field.trim());
      if (record.some(Boolean)) records.push(record);
      record = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  record.push(field.trim());
  if (record.some(Boolean)) records.push(record);
  const headers = records.shift() || [];
  if (!["mobile", "consent", "evidence"].every((h) => headers.includes(h)))
    throw new Error("CSV requires mobile, consent and evidence columns.");
  return records.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] || ""])),
  );
}
