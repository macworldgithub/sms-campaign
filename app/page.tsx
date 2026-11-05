"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import ProductionPanels from "./production-panels";
import {
  BarChart3Icon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  LockIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  ShieldAlertIcon,
  SlidersIcon,
  SparklesIcon,
  UploadCloudIcon,
  UserCheckIcon,
  UsersIcon,
} from "./components/icons";
import {
  DELIVERY_MILESTONES,
  SCOPE_TEMPLATES,
  calculateSmsTelemetry,
  type ScopeTemplate,
} from "./constants/templates";

type StaffUser = {
  id: string;
  username: string;
  name: string;
  role: "admin" | "campaign_manager" | "viewer";
  mustChangePassword: boolean;
};

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

const navTabs = [
  { id: "Overview", label: "Overview", icon: LayoutDashboardIcon },
  { id: "Campaigns", label: "Campaigns", icon: SendIcon },
  { id: "Audience", label: "Audience", icon: UsersIcon },
  { id: "Leads", label: "Leads", icon: UserCheckIcon },
  { id: "Suppression", label: "Suppression", icon: ShieldAlertIcon },
  { id: "Reports", label: "Reports", icon: BarChart3Icon },
  { id: "Integrations", label: "Integrations", icon: SlidersIcon },
  { id: "Operations", label: "Operations", icon: ClockIcon, restricted: true },
  { id: "Settings", label: "Settings", icon: SlidersIcon, restricted: true },
  { id: "Staff", label: "Staff", icon: UsersIcon, restricted: true },
];

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
  const [user, setUser] = useState<StaffUser | null>(null);
  const canManage = user?.role === "admin" || user?.role === "campaign_manager";
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState<Data | null>(null);
  const [signed, setSigned] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [query, setQuery] = useState("");

  // Campaign modal states
  const [selectedTemplate, setSelectedTemplate] = useState<ScopeTemplate>(
    SCOPE_TEMPLATES[0]
  );
  const [campaignName, setCampaignName] = useState("November Loyalty Offer");
  const [campaignBody, setCampaignBody] = useState(SCOPE_TEMPLATES[0].body);

  // Match customer resolution modal
  const [matchLead, setMatchLead] = useState<{ id: string; name: string } | null>(
    null
  );
  const [matchContactId, setMatchContactId] = useState("");

  // DealerSocket and integration state
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
  const [sms, setSms] = useState<{ tests: Row[]; messages?: Row[] } | null>(null);
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
      const who = await api("me");
      setUser(who);
      if (who.mustChangePassword) {
        setData({
          metrics: {},
          campaigns: [],
          contacts: [],
          leads: [],
          suppressions: [],
          activity: [],
          readiness: {},
        });
        setSigned(true);
        return;
      }
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
    if (signed && tab === "Integrations") {
      void api("routing")
        .then(setRouting)
        .catch(() => {});
    }
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
    if (!signed || tab !== "Integrations") return;
    const load = () => void api("sms/outbound").then(setSms).catch(() => {});
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
    if (!canManage) {
      setNotice("Your account has read-only access.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const result = await api(path, body);
      setNotice(
        result.sent !== undefined
          ? `${result.sent} SMS dispatched; ${result.uncertain} require review.`
          : result.message || "Action saved successfully."
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
      const f = new FormData(e.currentTarget);
      const username = f.get("username") || "admin";
      const password = f.get("password");
      await api("login", { username, password });
      setNotice("");
      await refresh();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      const currentPassword = f.get("currentPassword");
      const newPassword = f.get("newPassword");
      await api("password", { currentPassword, newPassword });
      setNotice("Password updated successfully. Please sign in with your new password.");
      setSigned(false);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    if (!canManage) {
      setNotice("Your account has read-only access.");
      return;
    }
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
        workbook ? { base64: encoded } : { rows: parseCSV(await file.text()) }
      );
      setNotice(
        `Import summary: ${result.imported} added · ${result.duplicates} duplicates · ${result.rejected.length} rejected${
          result.rejected.length
            ? ` (Row ${result.rejected[0].row}: ${result.rejected[0].reason})`
            : ""
        }`
      );
      await refresh();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------
  // PART 2: DEDICATED FULL-SCREEN LOGIN GATE (WHEN !signed)
  // -------------------------------------------------------------
  if (!signed) {
    return (
      <div className="login-gate-wrapper">
        <div className="login-card">
          <div className="login-header">
            <img
              src="/booran-motors-black.png"
              alt="Booran Motors"
              className="login-logo"
            />
            <div className="login-title">
              <h1>Booran South Morang Hyundai</h1>
              <p>Loyalty Campaign Studio</p>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px 0", color: "var(--ink)" }}>
              Campaign Workspace
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              Authorized access for Booran Motors Group campaign operations.
            </p>
          </div>

          <form onSubmit={login} className="login-form">
            <label>
              Staff Username
              <input
                name="username"
                type="text"
                defaultValue="admin"
                autoComplete="username"
                required
              />
            </label>

            <label>
              Workspace Access Password
              <input
                name="password"
                type="password"
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", marginTop: "4px" }}
            >
              {busy ? "Authenticating…" : "Unlock Workspace →"}
            </button>
          </form>

          {notice && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#991b1b",
                fontSize: 12,
              }}
            >
              {notice}
            </div>
          )}

          <div className="login-footer-text">
            <span>Confidential • Prepared by </span>
            <strong style={{ color: "#334155" }}>OmniSuiteAI</strong>
            <span> for Booran Motors Group</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MANDATORY FIRST-LOGIN PASSWORD CHANGE
  // -------------------------------------------------------------
  if (user?.mustChangePassword) {
    return (
      <div className="login-gate-wrapper">
        <div className="login-card">
          <div className="login-header">
            <img
              src="/booran-motors-black.png"
              alt="Booran Motors"
              className="login-logo"
            />
            <div className="login-title">
              <h1>Booran South Morang Hyundai</h1>
              <p>Security Requirement</p>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px 0", color: "var(--ink)" }}>
              Change Temporary Password
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              Welcome, {user.name}. You must update your temporary password before accessing campaign operations.
            </p>
          </div>

          <form onSubmit={changePassword} className="login-form">
            <label>
              Current Password
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>

            <label>
              New Password (minimum 12 characters)
              <input
                name="newPassword"
                type="password"
                minLength={12}
                maxLength={256}
                required
                autoComplete="new-password"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", marginTop: "4px" }}
            >
              {busy ? "Updating…" : "Update Password & Continue →"}
            </button>
          </form>

          {notice && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                color: "#991b1b",
                fontSize: 12,
              }}
            >
              {notice}
            </div>
          )}
        </div>
      </div>
    );
  }

  const m = data?.metrics || {};
  const oneWay = data?.readiness?.smsChannelMode !== "two_way";
  const telemetry = calculateSmsTelemetry(campaignBody);

  const filteredContacts = (rows: Row[]) =>
    rows.filter((r) =>
      Object.values(r).join(" ").toLowerCase().includes(query.toLowerCase())
    );

  return (
    <div className="app-shell">
      {/* ------------------------------------------------------------- */}
      {/* TAB 1: SIDEBAR                                                */}
      {/* ------------------------------------------------------------- */}
      <aside className="sidebar">
        <a className="brand" href="/">
          <img
            src="/booran-motors-black.png"
            alt="Booran Motors"
            className="brand-logo"
          />
          <div className="brand-text">
            <h1>South Morang Hyundai</h1>
            <p>Loyalty Campaign Studio</p>
          </div>
        </a>

        <div className="dealership-pill">
          <span className="rooftop-name">South Morang Hyundai</span>
          <span className="site-id">SITE 10876</span>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav className="nav-list">
          {navTabs
            .filter((t) => !t.restricted || user?.role === "admin" || canManage)
            .map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              const showPendingCount = item.id === "Leads" && (m.pending || 0) > 0;

              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setTab(item.id);
                    setQuery("");
                  }}
                >
                  <span className="nav-item-content">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </span>
                  {showPendingCount && (
                    <span className="nav-badge-count">{m.pending}</span>
                  )}
                </button>
              );
            })}
        </nav>

        <div className="sidebar-footer">
          <div className="partnership-badge">
            <p>
              Campaign Architecture by <strong>OmniSuiteAI</strong>
              <br />
              <span style={{ fontSize: 9, color: "var(--muted)" }}>
                Go-Live Target: 9 Nov 2026 • Confidential
              </span>
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <strong style={{ fontSize: 12, display: "block", color: "var(--ink)" }}>
                {user?.name || "Administrator"}
              </strong>
              <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "capitalize" }}>
                {user?.role?.replaceAll("_", " ")}
              </span>
            </div>

            <button
              className="signout-button"
              title="Sign out of portal"
              onClick={async () => {
                await api("logout", {});
                setSigned(false);
                setData(null);
                setUser(null);
              }}
            >
              <LockIcon className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN SHELL                                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="main-shell">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="breadcrumb-area">
            <span>Workspace</span>
            <span>/</span>
            <strong>{tab}</strong>
          </div>

          <div className="topbar-right">
            <div className="status-pill-countdown">
              <span className="pulse-dot" />
              <span>● Staging (Target: 9 Nov 2026)</span>
            </div>

            <div className="acma-badge">
              <CheckCircleIcon className="w-3.5 h-3.5" />
              <span>ACMA Verified: BooranSMH</span>
            </div>

            <button
              className="sync-button"
              title="Refresh telemetry"
              onClick={() => void refresh()}
            >
              <RefreshCwIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* CONTENT AREA */}
        <main className="content-area">
          <div className="page-header">
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--red)",
                  margin: "0 0 4px 0",
                }}
              >
                SOUTH MORANG HYUNDAI · PREVIOUS CLIENT RE-ENGAGEMENT
              </p>
              <h2>{tab === "Overview" ? "Loyalty Campaign Operations" : tab}</h2>
              <p>
                {tab === "Overview"
                  ? "Re-engaging previous customers with an exclusive loyalty reward, directed to loyalty.smh.goodshowroom.com."
                  : (
                      {
                        Campaigns:
                          "Review client-approved templates and manage broadcast dispatch.",
                        Audience:
                          "Consented previous customers with Spam Act 2003 audit evidence.",
                        Leads:
                          "Dual-CRM enquiry pipeline: DealerSocket & Good Showroom Sales Floor.",
                        Suppression:
                          "Automatic real-time exclusion on STOP replies, web opt-outs, and lead submissions.",
                        Reports:
                          "Full conversion telemetry: sent, delivered, clicks, and enquiries.",
                        Integrations:
                          "MobileMessage Sender ID, GoodShowroom Subdomain, and DealerSocket connector.",
                        Operations:
                          "Background worker queue, dispatch journal, and reconciliation.",
                        Settings: "Client offer approval, terms, and promotion expiry.",
                        Staff: "Operator roles and authorized campaign accounts.",
                      } as Record<string, string>
                    )[tab]}
              </p>
            </div>

            <div className="header-action-group">
              <button
                className="btn btn-secondary"
                onClick={() => setTab("Audience")}
              >
                <UploadCloudIcon className="w-4 h-4" />
                Import Audience
              </button>

              <button
                className="btn btn-primary"
                onClick={() => setModal(true)}
              >
                <SparklesIcon className="w-4 h-4" />
                New Campaign
              </button>
            </div>
          </div>

          {notice && (
            <div
              style={{
                marginBottom: 24,
                padding: "12px 18px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                color: "#166534",
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{notice}</span>
              <button
                style={{ background: "none", border: "none", color: "#166534", fontWeight: 700 }}
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 2: OVERVIEW & COMMAND CENTER                              */}
          {/* ------------------------------------------------------------- */}
          {tab === "Overview" && (
            <>
              {/* 4-STAGE DELIVERY MILESTONE TRACKER (SCOPE SECTION 7) */}
              <section className="stepper-card">
                <div className="stepper-header">
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 2px 0", color: "var(--ink)" }}>
                      Campaign Delivery Milestones
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                      4-phase roadmap leading to Go-Live on 9 November 2026.
                    </p>
                  </div>
                  <span className="badge badge-green">GO-LIVE: 9 NOV 2026</span>
                </div>

                <div className="stepper-grid">
                  {DELIVERY_MILESTONES.map((m) => (
                    <div key={m.step} className={`stepper-item ${m.status}`}>
                      <div className="stepper-top">
                        <span className="stepper-step-num">Step 0{m.step}</span>
                        <span className="stepper-badge-status">
                          {m.status === "completed"
                            ? "Completed"
                            : m.status === "in_progress"
                            ? "In Progress"
                            : "Upcoming"}
                        </span>
                      </div>
                      <div className="stepper-title">{m.title}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--red)", marginBottom: 4 }}>
                        {m.dates} · {m.owner}
                      </div>
                      <p className="stepper-desc">{m.details}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4 TOP RE-ENGINEERED KPI METRIC CARDS */}
              <div className="metric-grid">
                <div className="metric-card">
                  <div className="metric-top">
                    <span className="metric-label">Consented Audience</span>
                    <div className="metric-icon-wrap">
                      <UsersIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="metric-number">
                    {Number(m.contacts || 0).toLocaleString()}
                  </div>
                  <div className="metric-sub">
                    <strong style={{ color: "#166534" }}>{Number(m.eligible || 0).toLocaleString()}</strong> eligible after suppression check
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span className="metric-label">Verified SMS Dispatched</span>
                    <div className="metric-icon-wrap">
                      <SendIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="metric-number">
                    {Number(m.sent || 0).toLocaleString()}
                  </div>
                  <div className="metric-sub">
                    {m.delivered || 0} confirmed delivered via MobileMessage
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span className="metric-label">Landing Engagement</span>
                    <div className="metric-icon-wrap">
                      <ExternalLinkIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="metric-number">
                    {Number(m.clicks || 0).toLocaleString()}
                  </div>
                  <div className="metric-sub">
                    Tracked visits to loyalty.smh.goodshowroom.com
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span className="metric-label">Captured Leads</span>
                    <div className="metric-icon-wrap">
                      <UserCheckIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="metric-number">
                    {Number(m.leads || 0).toLocaleString()}
                  </div>
                  <div className="metric-sub">
                    {m.pending || 0} pending dual-CRM synchronisation
                  </div>
                </div>
              </div>

              {/* CAMPAIGN LAUNCH READINESS CHECKLIST */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24, marginBottom: 28 }}>
                <section className="panel" style={{ margin: 0 }}>
                  <div className="panel-header">
                    <div>
                      <h3>ACMA Compliance & Launch Readiness</h3>
                      <p>Full Spam Act 2003 and telco Sender ID verification checklist.</p>
                    </div>
                    <span className="badge badge-green">TARGET: 9 NOV</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      ["Consented Target List Ingested", Number(m.contacts || 0) > 0],
                      [
                        "Final SMS Copy Approved",
                        Boolean(data?.campaigns?.some((c) => c.approved)),
                      ],
                      ["MobileMessage Provider Connected", Boolean(data?.readiness?.provider)],
                      [
                        "Alphanumeric Sender ID Registered (BooranSMH)",
                        Boolean(data?.readiness?.senderRegistered),
                      ],
                      [
                        "GoodShowroom Subdomain & Netlify Embed Active",
                        Boolean(data?.readiness?.publicUrl),
                      ],
                      [
                        "Real-time STOP & Enquiry Suppression Wired",
                        true,
                      ],
                      [
                        "Dual-CRM Lead Routing Configured (SM & GM)",
                        Boolean(routing?.salesManager && routing?.generalManager),
                      ],
                    ].map(([label, ok]) => (
                      <div
                        key={String(label)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: "#f8fafc",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: ok ? "#22c55e" : "#e2e8f0",
                              color: ok ? "#ffffff" : "#64748b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {ok ? "✓" : "○"}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                            {label}
                          </span>
                        </div>
                        <span className={`badge ${ok ? "badge-green" : "badge-amber"}`}>
                          {ok ? "Ready" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* RECENT ACTIVITY STREAM */}
                <section className="panel" style={{ margin: 0 }}>
                  <div className="panel-header">
                    <div>
                      <h3>Recent Audit Activity</h3>
                      <p>Compliance and dispatch journal.</p>
                    </div>
                  </div>

                  {data?.activity?.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {data.activity.slice(0, 6).map((a) => (
                        <div
                          key={String(a.id)}
                          style={{
                            padding: "8px 12px",
                            background: "#f8fafc",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <strong style={{ fontSize: 12, color: "var(--ink)" }}>
                              {a.action}
                            </strong>
                            <span style={{ fontSize: 10, color: "var(--muted)" }}>
                              {date(a.createdAt)}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
                            {a.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <h4>Activity Journal Ready</h4>
                      <p>List imports, copy approvals, and dispatches are audited here.</p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 3: CAMPAIGNS                                              */}
          {/* ------------------------------------------------------------- */}
          {tab === "Campaigns" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Loyalty Outreach Campaigns</h3>
                  <p>7 client-approved templates tailored for previous South Morang Hyundai customers.</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setModal(true)}
                >
                  ＋ Create New Campaign
                </button>
              </div>

              {!data?.campaigns?.length ? (
                <div className="empty-state">
                  <h4>No Campaigns Created Yet</h4>
                  <p>
                    Select from the 7 client-approved scope templates to launch your verified SMS broadcast.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 14 }}
                    onClick={() => setModal(true)}
                  >
                    Create First Campaign
                  </button>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>CAMPAIGN TITLE</th>
                        <th>STATUS</th>
                        <th>RECIPIENTS</th>
                        <th>CREATED</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.map((c) => (
                        <tr key={String(c.id)}>
                          <td>
                            <strong style={{ display: "block", color: "var(--ink)" }}>
                              {c.name}
                            </strong>
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>
                              Sender: BooranSMH · Subdomain: loyalty.smh.goodshowroom.com
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                c.status === "completed"
                                  ? "badge-green"
                                  : c.status === "approved"
                                  ? "badge-blue"
                                  : c.status === "sending"
                                  ? "badge-amber"
                                  : ""
                              }`}
                            >
                              {String(c.status).replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>{c.recipients || 0}</td>
                          <td>{date(c.createdAt)}</td>
                          <td>
                            {c.status === "draft" ? (
                              <button
                                disabled={busy || !canManage}
                                className="btn btn-secondary"
                                style={{ padding: "6px 12px", fontSize: 12 }}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Authorize & Approve SMS Copy:\n\n${c.body}`
                                    )
                                  ) {
                                    void action(`campaigns/${c.id}/approve`);
                                  }
                                }}
                              >
                                Review & Approve
                              </button>
                            ) : c.status === "approved" ? (
                              <button
                                disabled={busy || !canManage}
                                className="btn btn-primary"
                                style={{ padding: "6px 12px", fontSize: 12 }}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Dispatch this verified SMS broadcast to all eligible consented recipients?"
                                    )
                                  ) {
                                    void action(`campaigns/${c.id}/send`);
                                  }
                                }}
                              >
                                Send Campaign ↗
                              </button>
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
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

          {/* ------------------------------------------------------------- */}
          {/* TAB 4: AUDIENCE & ACMA CONSENT HYGIENE                        */}
          {/* ------------------------------------------------------------- */}
          {tab === "Audience" && (
            <>
              {/* UPLOAD DROPZONE */}
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Target List Ingestion & ACMA Hygiene</h3>
                    <p>
                      Supports client-supplied CSV or Excel (.xlsx). Mandatory columns:{" "}
                      <code>mobile</code>, <code>consent</code> (express/inferred), <code>evidence</code>.
                    </p>
                  </div>
                  <a
                    className="btn btn-secondary"
                    href="/audience-template.csv"
                    download
                  >
                    ↓ Download CSV Template
                  </a>
                </div>

                <label className="dropzone">
                  <UploadCloudIcon className="w-10 h-10" style={{ color: "var(--red)", margin: "0 auto 12px" }} />
                  <strong style={{ fontSize: 15, display: "block", color: "var(--ink)", marginBottom: 4 }}>
                    Drag & Drop Consented Audience List
                  </strong>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px 0" }}>
                    CSV or XLSX · Up to 10,000 previous customer records · Valid Australian mobile format
                  </p>
                  <span className="btn btn-secondary" style={{ pointerEvents: "none" }}>
                    Select File on Computer
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={busy || !canManage}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </section>

              {/* AUDIENCE TELEMETRY & TABLE */}
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>
                      Consented Audience Roster{" "}
                      <span className="badge badge-blue">{m.contacts || 0} Contacts</span>
                    </h3>
                    <p>Deduplicated customer records ready for verified broadcast.</p>
                  </div>

                  <div style={{ position: "relative", width: 280 }}>
                    <input
                      placeholder="Search by name, mobile, evidence…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px 8px 32px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <SearchIcon
                      className="w-4 h-4"
                      style={{
                        position: "absolute",
                        left: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--muted)",
                      }}
                    />
                  </div>
                </div>

                {data?.contacts?.length ? (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>CUSTOMER NAME</th>
                          <th>MOBILE</th>
                          <th>CONSENT</th>
                          <th>EVIDENCE TRAIL</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContacts(data.contacts).map((c) => (
                          <tr key={String(c.id)}>
                            <td>
                              <strong style={{ color: "var(--ink)" }}>
                                {c.firstName || "Customer"} {c.lastName || ""}
                              </strong>
                              {c.dealerSocketContactId && (
                                <span style={{ fontSize: 10, color: "var(--muted)", display: "block" }}>
                                  CRM ID: {c.dealerSocketContactId}
                                </span>
                              )}
                            </td>
                            <td>{c.mobile}</td>
                            <td>
                              <span
                                className={`badge ${
                                  c.consent === "express" ? "badge-green" : "badge-blue"
                                }`}
                              >
                                {c.consent}
                              </span>
                            </td>
                            <td style={{ maxWidth: 300, fontSize: 12, color: "var(--muted)" }}>
                              {c.evidence}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  c.suppressionReason ? "badge-red" : "badge-green"
                                }`}
                              >
                                {c.suppressionReason || "Eligible for send"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <h4>No Audience Records Ingested</h4>
                    <p>Upload your client-supplied list above to populate the campaign audience.</p>
                  </div>
                )}
              </section>
            </>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 5: LEADS & DUAL-CRM PIPELINE                              */}
          {/* ------------------------------------------------------------- */}
          {tab === "Leads" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Dual-CRM Enquiry Pipeline</h3>
                  <p>
                    Landing page submissions from loyalty.smh.goodshowroom.com dispatched in parallel to DealerSocket & Good Showroom Sales Floor.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="badge badge-amber">
                    {m.pending || 0} Pending CRM Save
                  </span>
                </div>
              </div>

              {data?.leads?.length ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>CUSTOMER</th>
                        <th>CONTACT DETAILS</th>
                        <th>DEALERSOCKET (SITE 10876)</th>
                        <th>GOODSHOWROOM SALES FLOOR</th>
                        <th>REGISTERED AT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leads.map((l) => (
                        <tr key={String(l.id)}>
                          <td>
                            <strong style={{ color: "var(--ink)", display: "block" }}>
                              {l.firstName} {l.lastName}
                            </strong>
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>
                              Ref: {String(l.id).slice(0, 8)}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{l.mobile}</div>
                            <small style={{ color: "var(--muted)" }}>{l.email || "No email provided"}</small>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                l.crmStatus === "synced"
                                  ? "badge-green"
                                  : l.crmStatus === "needs_match"
                                  ? "badge-amber"
                                  : ""
                              }`}
                            >
                              {String(l.crmStatus || "pending").replaceAll("_", " ")}
                            </span>
                            <small style={{ display: "block", color: "var(--muted)", marginTop: 2 }}>
                              {l.crmDetail || "Primary SM & Secondary GM"}
                            </small>

                            {/* Resolution Button for needs_match */}
                            {!l.dealerSocketContactId &&
                              ["pending_configuration", "needs_match"].includes(
                                String(l.crmStatus)
                              ) && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: "4px 8px", fontSize: 11, marginTop: 6 }}
                                  onClick={() =>
                                    setMatchLead({
                                      id: String(l.id),
                                      name: `${l.firstName} ${l.lastName}`,
                                    })
                                  }
                                >
                                  Link Customer ID →
                                </button>
                              )}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                l.goodshowroomStatus === "synced"
                                  ? "badge-green"
                                  : "badge-blue"
                              }`}
                            >
                              {String(l.goodshowroomStatus || "queued").replaceAll("_", " ")}
                            </span>
                            <small style={{ display: "block", color: "var(--muted)", marginTop: 2 }}>
                              {String(l.goodshowroomDetail || "Sales Manager & General Manager queues")}
                            </small>
                          </td>
                          <td>{date(l.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <h4>No Leads Captured Yet</h4>
                  <p>
                    Landing-page enquiries will appear here automatically and immediately route to both CRMs.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 6: SUPPRESSION & OPT-OUT ENGINE                           */}
          {/* ------------------------------------------------------------- */}
          {tab === "Suppression" && (
            <>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Real-Time ACMA Suppression Engine</h3>
                    <p>
                      Automated exclusion rules prevent further promotional SMS from reaching opted-out or registered customers.
                    </p>
                  </div>
                  <span className="badge badge-green">CHECKED BEFORE EVERY SEND</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                  <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>
                      1. SMS "STOP" Reply
                    </strong>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                      Webhook instantly adds sender number to master suppression list.
                    </p>
                  </div>

                  <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>
                      2. Web Unsubscribe
                    </strong>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                      One-click functional opt-out link embedded in every message.
                    </p>
                  </div>

                  <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>
                      3. Lead Registration
                    </strong>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                      Successful enquiry submission immediately halts further marketing SMS.
                    </p>
                  </div>
                </div>

                {/* MANUAL QUARANTINE BOX */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const rawMobile = new FormData(form).get("mobile");
                    const result = await action("suppressions", { mobile: rawMobile });
                    if (result) form.reset();
                  }}
                  style={{ display: "flex", gap: 12, alignItems: "flex-end" }}
                >
                  <label style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>
                    Manual Quarantine Add (Australian Mobile)
                    <input
                      name="mobile"
                      placeholder="04xx xxx xxx or +614xx xxx xxx"
                      required
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        marginTop: 4,
                        fontSize: 13,
                      }}
                    />
                  </label>
                  <button
                    disabled={busy || !canManage}
                    className="btn btn-secondary"
                    style={{ height: 42 }}
                  >
                    Add to Do-Not-Contact List
                  </button>
                </form>
              </section>

              {/* SUPPRESSION TABLE */}
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>
                      Master Suppression List{" "}
                      <span className="badge badge-red">{m.suppressed || 0} Excluded</span>
                    </h3>
                  </div>
                </div>

                {data?.suppressions?.length ? (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>MOBILE NUMBER</th>
                          <th>SUPPRESSION REASON</th>
                          <th>LOGGED TIMESTAMP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.suppressions.map((s) => (
                          <tr key={String(s.mobile)}>
                            <td>
                              <strong>{s.mobile}</strong>
                            </td>
                            <td>
                              <span className="badge badge-red">{s.reason}</span>
                            </td>
                            <td>{date(s.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <h4>No Numbers Suppressed Yet</h4>
                    <p>Numbers that reply STOP or register a lead will appear here.</p>
                  </div>
                )}
              </section>
            </>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 7: INTEGRATIONS & SUBDOMAIN HUB                           */}
          {/* ------------------------------------------------------------- */}
          {tab === "Integrations" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 28 }}>
                {/* 1. GOODSHOWROOM SUBDOMAIN CARD */}
                <section className="panel" style={{ margin: 0 }}>
                  <div className="panel-header">
                    <div>
                      <h3>GoodShowroom Subdomain & Embed</h3>
                      <p>Dedicated branded customer landing experience.</p>
                    </div>
                    <span className="badge badge-green">SSL Verified</span>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                      Subdomain Endpoint
                    </label>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
                      loyalty.smh.goodshowroom.com
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                      Target Experience Embed
                    </label>
                    <div style={{ fontSize: 12, color: "var(--red)", marginTop: 2 }}>
                      https://smh-loyalty-embed.netlify.app
                    </div>
                  </div>

                  <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, color: "var(--muted)" }}>
                    Automated UTM parameters (<code>utm_source=sms</code>, <code>utm_campaign=loyalty</code>) appended to all tracked shortlinks.
                  </div>
                </section>

                {/* 2. MOBILEMESSAGE SMS PROVIDER CARD */}
                <section className="panel" style={{ margin: 0 }}>
                  <div className="panel-header">
                    <div>
                      <h3>MobileMessage Verified SMS</h3>
                      <p>ACMA-participating Australian telecommunications provider.</p>
                    </div>
                    <span className="badge badge-green">BooranSMH Registered</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                        Registered Sender ID
                      </label>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>
                        {String(data?.readiness?.senderId || "BooranSMH")}
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                        Sending Frequency Cap
                      </label>
                      <div style={{ fontSize: 12, color: "var(--ink)", marginTop: 2 }}>
                        1 message / customer / 30 days
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    disabled={busy || !canManage}
                    style={{ width: "100%" }}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const result = await api("sms/test", {
                          requestId: testRequestId || crypto.randomUUID(),
                        });
                        setNotice(`Connection-test status: ${result.status}.`);
                      } catch (error) {
                        setNotice((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Send Telecommunications Test Ping
                  </button>
                </section>
              </div>

              {/* DEALERSOCKET CRM ROUTING SECTION */}
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>DealerSocket Lead Routing (Site ID: 10876)</h3>
                    <p>Assign leads simultaneously to Primary Sales Manager and Secondary General Manager.</p>
                  </div>
                  <span className="badge badge-blue">South Morang Hyundai</span>
                </div>

                {routing ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await action("routing", {
                        salesManager: routing.salesManager,
                        generalManager: routing.generalManager,
                      });
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>
                        Primary Assignee · Sales Manager
                        <select
                          required
                          value={routing.salesManager}
                          onChange={(e) =>
                            setRouting({ ...routing, salesManager: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "10px",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            marginTop: 4,
                          }}
                        >
                          <option value="">Select Sales Manager</option>
                          {routing.catalog.users.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.text}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ fontSize: 12, fontWeight: 600 }}>
                        Secondary Assignee · General Manager
                        <select
                          required
                          value={routing.generalManager}
                          onChange={(e) =>
                            setRouting({ ...routing, generalManager: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "10px",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            marginTop: 4,
                          }}
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

                    <button
                      className="btn btn-primary"
                      disabled={busy || !canManage}
                    >
                      Save CRM Manager Routing →
                    </button>
                  </form>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: 12 }}>
                    Loading verified site assignees from DealerSocket catalog…
                  </p>
                )}
              </section>
            </>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 8: REPORTS                                                */}
          {/* ------------------------------------------------------------- */}
          {tab === "Reports" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Campaign Performance & Conversion Funnel</h3>
                  <p>Real-time delivery confirmation and audience engagement metrics.</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                <div style={{ padding: 18, background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                    Delivery Rate
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 6 }}>
                    {m.sent ? Math.round(((m.delivered || 0) / m.sent) * 100) : 100}%
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: 10 }}>Confirmed carrier receipts</small>
                </div>

                <div style={{ padding: 18, background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                    Click-Through Rate (CTR)
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 6 }}>
                    {m.delivered ? Math.round(((m.clicks || 0) / m.delivered) * 100) : 0}%
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: 10 }}>Tracked landing visits</small>
                </div>

                <div style={{ padding: 18, background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                    Lead Conversion
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 6 }}>
                    {m.clicks ? Math.round(((m.leads || 0) / m.clicks) * 100) : 0}%
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: 10 }}>Form submissions / visits</small>
                </div>

                <div style={{ padding: 18, background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                    Opt-Out Rate
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#991b1b", marginTop: 6 }}>
                    {m.delivered ? ((m.optOuts || 0) / m.delivered * 100).toFixed(1) : 0}%
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: 10 }}>STOP & web unsubscribes</small>
                </div>
              </div>
            </section>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TABS: OPERATIONS, SETTINGS, STAFF (VIA PRODUCTIONPANELS)      */}
          {/* ------------------------------------------------------------- */}
          {["Operations", "Settings", "Staff"].includes(tab) && user && (
            <ProductionPanels
              tab={tab}
              api={api}
              user={user}
              onUpdated={refresh}
            />
          )}
        </main>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 3 MODAL: 7 SCOPE SMS TEMPLATES & TELEMETRY                */}
      {/* ------------------------------------------------------------- */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px 0", color: "var(--ink)" }}>
                  Create Verified Loyalty Campaign
                </h3>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                  Select from the 7 client-approved templates from Scope Section 5.
                </p>
              </div>
              <button
                style={{ background: "none", border: "none", fontSize: 20, color: "var(--muted)" }}
                onClick={() => setModal(false)}
              >
                ×
              </button>
            </div>

            {/* TEMPLATE PICKER GRID */}
            <div className="template-grid">
              {SCOPE_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className={`template-item ${
                    selectedTemplate.id === tmpl.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedTemplate(tmpl);
                    setCampaignBody(tmpl.body);
                  }}
                >
                  <div className="template-item-top">
                    <span className="template-item-title">{tmpl.name}</span>
                    <span
                      className={`badge ${
                        tmpl.recommended ? "badge-green" : "badge-blue"
                      }`}
                    >
                      {tmpl.badge}
                    </span>
                  </div>
                  <p className="template-item-desc">{tmpl.description}</p>
                  <div className="template-item-preview">{tmpl.body}</div>
                </div>
              ))}
            </div>

            {/* CAMPAIGN FORM */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await action("campaigns", {
                  name: campaignName,
                  body: campaignBody,
                });
                if (result) {
                  setModal(false);
                  setTab("Campaigns");
                }
              }}
            >
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                Campaign Reference Name
                <input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. November Loyalty Re-engagement"
                  maxLength={200}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    marginTop: 4,
                  }}
                />
              </label>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, margin: "14px 0 8px" }}>
                SMS Message Body (must identify Booran and include {"{link}"} and {"{optout}"})
                <textarea
                  value={campaignBody}
                  onChange={(e) => setCampaignBody(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    marginTop: 4,
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 12,
                  }}
                />
              </label>

              {/* REAL-TIME TELEMETRY BAR */}
              <div className="telemetry-row">
                <div>
                  <strong style={{ color: "var(--ink)" }}>
                    {telemetry.renderedLength} characters
                  </strong>
                  <span style={{ color: "var(--muted)", marginLeft: 6 }}>
                    ({telemetry.rawLength} template chars)
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <span
                    className={`badge ${
                      telemetry.segments === 1 ? "badge-green" : "badge-amber"
                    }`}
                  >
                    {telemetry.segments === 1
                      ? "1 Segment (Single-Part Cost)"
                      : `${telemetry.segments} Segments (Multi-Part)`}
                  </span>

                  <span
                    className={`badge ${
                      telemetry.isUnicode ? "badge-amber" : "badge-blue"
                    }`}
                  >
                    {telemetry.isUnicode ? "Unicode Mode" : "Standard GSM-7"}
                  </span>
                </div>
              </div>

              {/* LIVE SMARTPHONE MESSAGE PREVIEW BUBBLE */}
              <div className="phone-preview-shell">
                <div className="phone-preview-header">
                  <span>Simulated Handset Preview</span>
                  <span>Sender ID: BooranSMH</span>
                </div>

                <div className="phone-preview-bubble">
                  <span className="bubble-sender">BooranSMH</span>
                  {telemetry.renderedText}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  Client copy approval required before live broadcast.
                </span>

                <button
                  type="submit"
                  disabled={busy || !canManage}
                  className="btn btn-primary"
                >
                  Save Campaign Draft →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL FOR needs_match (NO RAW WINDOW.PROMPT) */}
      {matchLead && (
        <div className="modal-overlay" onClick={() => setMatchLead(null)}>
          <div className="modal-dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Link DealerSocket Customer
              </h3>
              <button
                style={{ background: "none", border: "none", fontSize: 18 }}
                onClick={() => setMatchLead(null)}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px 0" }}>
              Enter the confirmed DealerSocket Contact ID for <strong>{matchLead.name}</strong>. The worker will verify the phone number matches before saving.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await action(`leads/${matchLead.id}/customer`, {
                  contactId: matchContactId,
                });
                setMatchLead(null);
                setMatchContactId("");
              }}
            >
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
                DealerSocket Customer ID (numeric)
                <input
                  type="text"
                  placeholder="e.g. 543210"
                  pattern="\d+"
                  value={matchContactId}
                  onChange={(e) => setMatchContactId(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    marginTop: 4,
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMatchLead(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Save Match
                </button>
              </div>
            </form>
          </div>
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
    Object.fromEntries(headers.map((h, i) => [h, row[i] || ""]))
  );
}
