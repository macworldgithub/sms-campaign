"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
const KiaCampaign = dynamic(() => import("./kia-campaign"));
const SouthMorangProspects = dynamic(() => import("./south-morang-prospects"));
const HyundaiCampaign = dynamic(() => import("./hyundai-campaign"));
const ProductionPanels = dynamic(() => import("../production-panels"));
const DealerSocketLeads = dynamic(() => import("./dealersocket-leads"));
import { Spinner, TabLoader, FullscreenSplash } from "./spinner";
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
} from "./icons";
import {
  SCOPE_TEMPLATES,
  calculateSmsTelemetry,
  type ScopeTemplate,
} from "../constants/templates";

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
  { id: "KIASMORANG", label: "KIASMORANG", icon: SendIcon },
  { id: "HYUNDSMORA", label: "HYUNDSMORA", icon: SendIcon },
  { id: "Leads", label: "Leads", icon: UserCheckIcon },
  { id: "Suppression", label: "Suppression", icon: ShieldAlertIcon },
  { id: "Reports", label: "Reports", icon: BarChart3Icon },
  { id: "Integrations", label: "Integrations", icon: SlidersIcon },
  { id: "Operations", label: "Operations", icon: ClockIcon, restricted: true },
  { id: "Settings", label: "Settings", icon: SlidersIcon, restricted: true },
  { id: "Staff", label: "Staff", icon: UsersIcon, restricted: true },
  { id: "Account", label: "My account", icon: LockIcon },
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

const TAB_SUBTITLES: Record<string, string> = {
  Overview: "Synthesizing campaign performance, delivery telemetry, and live pipeline KPIs…",
  Campaigns: "Loading verified broadcast records, dispatch queues, and Scope SMS templates…",
  Audience: "Verifying customer consent audit records and mobile numbers…",
  Leads: "Syncing dual-CRM enquiry pipeline for DealerSocket & Good Showroom…",
  Suppression: "Compiling real-time opt-out registers, STOP replies, and exclusions…",
  Integrations: "Querying MobileMessage sender ID and DealerSocket connector heartbeat…",
  Reports: "Calculating conversion funnel, delivery rates, and UTM attribution…",
  Operations: "Querying background worker status, dispatch journal, and reconciliation…",
  Settings: "Retrieving client-approved offer terms, eligibility, and campaign expiry…",
  Staff: "Verifying authorized operator permissions and security profiles…",
};

export default function StaffWorkspace({ viewSwitch }: { viewSwitch: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const canManage = user?.role === "admin" || user?.role === "campaign_manager";
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState<Data | null>(null);
  const [signed, setSigned] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tabLoading, startTabTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [query, setQuery] = useState("");
  const refreshing = useRef(false);

  const switchTab = (targetTab: string) => {
    if (targetTab === tab) return;
    startTabTransition(() => {
      setTab(targetTab);
      setQuery("");
    });
  };

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
  const [kiaTestRequestId, setKiaTestRequestId] = useState<string | null>(null);
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
    if (path === "me" && response.status === 401) {
      setSigned(false);
      setUser(null);
    }
    if (!response.ok) throw new Error(result.message || "Request failed");
    return result;
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setSyncing(true);
    try {
      const who = await api("me");
      if (who && who.id) {
        setUser(who);
        setSigned(true);
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
          return;
        }
        try {
          const portalData = await api("portal");
          setData(portalData);
        } catch (portalErr) {
          console.warn("Portal dashboard data fetch failed:", portalErr);
        }
      } else {
        setSigned(false);
        setUser(null);
      }
    } catch {
      setSigned(false);
      setUser(null);
    } finally {
      refreshing.current = false;
      setSyncing(false);
      setInitialLoading(false);
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
    let loading = false;
    const load = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try { setDealer(await api("dealersocket")); }
      catch { /* Retain the latest successful snapshot. */ }
      finally { loading = false; }
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [signed, tab, api]);

  useEffect(() => {
    if (!signed || tab !== "Integrations") return;
    let loading = false;
    const load = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try { setSms(await api("sms/outbound")); }
      catch { /* Retain the latest successful snapshot. */ }
      finally { loading = false; }
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [signed, tab, api]);

  useEffect(() => {
    if (!signed) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
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
    setLoginBusy(true);
    setNotice("");
    try {
      const f = new FormData(e.currentTarget);
      const username = f.get("username") || "admin";
      const password = f.get("password");
      const res = await api("login", { username, password });
      if (res.user) {
        setUser(res.user);
        setSigned(true);
      }
      setNotice("");
      await refresh();
    } catch (error) {
      setNotice((error as Error).message || "Sign in failed. Check credentials.");
    } finally {
      setLoginBusy(false);
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

      let rows: Record<string, string>[];

      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const XLSX = await import("xlsx");
        // ── Parse XLSX in the browser — no Python / backend dependency ──────────
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          raw: false,
        });
        if (rawRows.length === 0) throw new Error("Workbook is empty.");

        // Normalise headers to lowercase for format detection
        const headers = Object.keys(rawRows[0]).map((h) => h.toLowerCase().trim());
        const isStandard = ["mobile", "consent", "evidence"].every((h) => headers.includes(h));
        const dealerMobileAliases = ["mobile number", "mobile", "phone", "cell", "mobile no", "phone number"];
        const dealerMobileHeader = dealerMobileAliases.find((a) => headers.includes(a));

        if (!isStandard && !dealerMobileHeader) {
          throw new Error(
            "Workbook requires either: (a) mobile, consent and evidence columns, " +
            "or (b) a Mobile Number column from a dealer CRM export."
          );
        }

        if (isStandard) {
          // Standard format — pass rows as-is
          rows = rawRows.map((r) =>
            Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), String(v).trim()]))
          );
        } else {
          // Dealer CRM export — map columns, fill consent/evidence automatically
          const findHeader = (aliases: string[]) =>
            Object.keys(rawRows[0]).find((k) =>
              aliases.includes(k.toLowerCase().trim())
            );
          const mobileKey     = findHeader(dealerMobileAliases)!;
          const firstNameKey  = findHeader(["first name", "firstname", "first_name", "given name"]);
          const lastNameKey   = findHeader(["last name", "lastname", "last_name", "surname", "family name"]);
          const emailKey      = findHeader(["email address", "email", "e-mail"]);
          const makeKey       = findHeader(["make"]);
          const modelKey      = findHeader(["model"]);

          rows = rawRows
            .filter((r) => String(r[mobileKey] || "").trim())
            .map((r) => ({
              mobile:    String(r[mobileKey] || "").trim(),
              consent:   "express",
              evidence:  "dealer_crm_export",
              ...(firstNameKey ? { firstName: String(r[firstNameKey] || "").trim() } : {}),
              ...(lastNameKey  ? { lastName:  String(r[lastNameKey]  || "").trim() } : {}),
              ...(emailKey     ? { email:     String(r[emailKey]     || "").trim() } : {}),
              ...(makeKey      ? { vehicleMake:  String(r[makeKey]  || "").trim() } : {}),
              ...(modelKey     ? { vehicleModel: String(r[modelKey] || "").trim() } : {}),
            }));
        }
      } else {
        // CSV — existing path
        rows = parseCSV(await file.text());
      }

      if (rows.length > 10000)
        throw new Error("Maximum 10,000 rows per upload.");

      const result = await api("contacts/import", { rows });
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
  // PART 2: INITIAL AUTH & WORKSPACE CONNECTIVITY SPLASH
  // -------------------------------------------------------------
  if (initialLoading) {
    return <FullscreenSplash status="Connecting to Booran Campaign Studio…" />;
  }

  // -------------------------------------------------------------
  // PART 3: DEDICATED FULL-SCREEN LOGIN GATE (WHEN !signed)
  // -------------------------------------------------------------
  if (!signed) {
    return (
      <div className="login-gate-wrapper">
        <div className="login-card" style={{ position: "relative" }}>
          {/* Loading overlay — covers the whole card while API is in-flight */}
          {loginBusy && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                background: "rgba(255,255,255,0.72)",
                backdropFilter: "blur(3px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                zIndex: 10,
              }}
            >
              <Spinner size="lg" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", letterSpacing: "0.01em" }}>
                Authenticating…
              </span>
            </div>
          )}

          <div className="login-view-switch">{viewSwitch}</div>
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
                disabled={loginBusy}
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
                disabled={loginBusy}
              />
            </label>

            <button
              type="submit"
              disabled={loginBusy}
              className="btn btn-primary"
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "4px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loginBusy ? (
                <>
                  <Spinner size="xs" color="#ffffff" trackColor="rgba(255, 255, 255, 0.3)" />
                  <span>Authenticating…</span>
                </>
              ) : (
                "Unlock Workspace →"
              )}
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
          <div className="login-view-switch">{viewSwitch}</div>
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
              style={{
                width: "100%",
                padding: "12px",
                marginTop: "4px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {busy ? (
                <>
                  <Spinner size="xs" color="#ffffff" trackColor="rgba(255, 255, 255, 0.3)" />
                  <span>Updating Password…</span>
                </>
              ) : (
                "Update Password & Continue →"
              )}
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
            <h1>{tab === "KIASMORANG" ? "South Morang Kia" : "South Morang Hyundai"}</h1>
            <p>Loyalty Campaign Studio</p>
          </div>
        </a>

        <div className="dealership-pill">
          <span className="rooftop-name">{tab === "KIASMORANG" ? "South Morang Kia" : "South Morang Hyundai"}</span>
          <span className="site-id">{tab === "KIASMORANG" ? "KIA SMS" : "SITE 10876"}</span>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav className="nav-list">
          {navTabs
            .filter((t) => t.id === "Staff" ? user?.role === "admin" : !t.restricted || canManage)
            .map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              const showPendingCount = item.id === "Leads" && (m.pending || 0) > 0;

              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => switchTab(item.id)}
                >
                  <span className="nav-item-content">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </span>
                  {tabLoading && isActive ? (
                    <Spinner size="xs" color="var(--red)" />
                  ) : showPendingCount ? (
                    <span className="nav-badge-count">{m.pending}</span>
                  ) : null}
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
            {tabLoading && <Spinner size="xs" style={{ marginLeft: 6 }} />}
          </div>

          <div className="topbar-right">
            {viewSwitch}

            <button
              className="sync-button"
              title="Refresh telemetry"
              disabled={syncing}
              onClick={() => void refresh()}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              {syncing ? <Spinner size="xs" /> : <RefreshCwIcon className="w-4 h-4" />}
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
                {tab === "KIASMORANG" ? "SOUTH MORANG KIA · SELTOS LAUNCH PARTY" : "SOUTH MORANG HYUNDAI · PREVIOUS CLIENT RE-ENGAGEMENT"}
              </p>
              <h2>{tab === "Overview" ? "Loyalty Campaign Operations" : tab}</h2>
              <p>
                {tab === "Overview"
                  ? "Re-engaging previous customers with an exclusive loyalty reward, directed to /loyalty."
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
                onClick={() => switchTab("Audience")}
              >
                <UploadCloudIcon className="w-4 h-4" />
                Import Audience
              </button>

              <button
                className="btn btn-primary"
                disabled={!canManage}
                onClick={() => setModal(true)}
              >
                <SparklesIcon className="w-4 h-4" />
                New Campaign
              </button>
            </div>
          </div>

          {notice && (
            <div className="notice-banner">
              <span>{notice}</span>
              <button
                style={{ background: "none", border: "none", color: "#166534", fontWeight: 700, fontSize: 16 }}
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}

          {tabLoading ? (
            <TabLoader
              title={`Loading ${tab}…`}
              subtitle={TAB_SUBTITLES[tab] || "Retrieving verified campaign telemetry and records…"}
            />
          ) : (
            <>
              {/* ------------------------------------------------------------- */}
              {/* TAB 2: OVERVIEW & COMMAND CENTER                              */}
              {/* ------------------------------------------------------------- */}
              {tab === "Overview" && (
            <>
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
                    Tracked visits to /loyalty
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
              <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 24, marginBottom: 28 }}>
                <section className="panel" style={{ margin: 0 }}>
                  <div className="panel-header">
                    <div>
                      <h3>ACMA Compliance & Launch Readiness</h3>
                      <p>Full Spam Act 2003 and telco Sender ID verification checklist.</p>
                    </div>
                    <span className="badge badge-green">TARGET: 9 NOV</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                          padding: "12px 16px",
                          background: "#f8fafc",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              background: ok ? "#22c55e" : "#e2e8f0",
                              color: ok ? "#ffffff" : "#64748b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                              flexShrink: 0,
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
                            padding: "12px 14px",
                            background: "#f8fafc",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <strong style={{ fontSize: 12, color: "var(--ink)" }}>
                              {a.action}
                            </strong>
                            <span style={{ fontSize: 10, color: "var(--muted)" }}>
                              {date(a.createdAt)}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
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
                  <p>{SCOPE_TEMPLATES.length} campaign templates tailored for previous South Morang Hyundai customers.</p>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={!canManage}
                onClick={() => setModal(true)}
                >
                  ＋ Create New Campaign
                </button>
              </div>

              {!data?.campaigns?.length ? (
                <div className="empty-state">
                  <h4>No Campaigns Created Yet</h4>
                  <p>
                    Select from the {SCOPE_TEMPLATES.length} campaign templates to prepare your SMS broadcast.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 14 }}
                    disabled={!canManage}
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
                              {c.dealership === "KIASMORANG" ? "KIASMORANG · Seltos event · isolated Kia audience" : "Sender: BooranSMH · Subdomain: /loyalty"}
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
                          <td>{c.audienceSize || c.recipients || 0}</td>
                          <td>{date(c.createdAt)}</td>
                          <td>
                            {c.status === "draft" ? (
                              <button
                                disabled={busy || !canManage}
                                className="btn btn-secondary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
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
                                {busy && <Spinner size="xs" />}
                                <span>Review & Approve</span>
                              </button>
                            ) : c.status === "approved" ? (
                              <button
                                disabled={busy || !canManage}
                                className="btn btn-primary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
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
                                {busy && <Spinner size="xs" color="#ffffff" trackColor="rgba(255,255,255,0.3)" />}
                                <span>Send Campaign ↗</span>
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
          {tab === "KIASMORANG" && <KiaCampaign api={api} canManage={canManage} />}
          {tab === "HYUNDSMORA" && <HyundaiCampaign api={api} canManage={canManage} />}
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
                  {busy ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <Spinner size="lg" />
                      <strong style={{ fontSize: 15, display: "block", color: "var(--ink)" }}>
                        Processing & Verifying Audience Records…
                      </strong>
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                        Validating Australian mobile numbers (+614…) and consent audit evidence
                      </p>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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

                  <div style={{ position: "relative", width: 300 }}>
                    <input
                      placeholder="Search by name, mobile, evidence…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 14px 9px 36px",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 13,
                        background: "#ffffff",
                        transition: "all 0.15s ease",
                      }}
                    />
                    <SearchIcon
                      className="w-4 h-4"
                      style={{
                        position: "absolute",
                        left: 12,
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
          {tab === "Leads" && <SouthMorangProspects />}
          {tab === "Leads" && (
            <>
            <DealerSocketLeads api={api} canManage={canManage} />
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Campaign landing-page enquiries</h3>
                  <p>
                    Registrations from the loyalty form. DealerSocket opportunities are shown separately above. GoodShowroom delivery remains queued until integration is available.
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
                                  style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, marginTop: 8, borderRadius: 6 }}
                                  disabled={busy || !canManage}
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
                    Landing-page enquiries will appear here automatically. DealerSocket delivery is processed by the worker; GoodShowroom delivery remains queued.
                  </p>
                </div>
              )}
            </section>
            </>
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

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                  <div style={{ padding: "16px 18px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>
                      1. SMS "STOP" Reply
                    </strong>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)", lineHeight: 1.45 }}>
                      Webhook instantly adds sender number to master suppression list.
                    </p>
                  </div>

                  <div style={{ padding: "16px 18px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>
                      2. Web Unsubscribe
                    </strong>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)", lineHeight: 1.45 }}>
                      One-click functional opt-out link embedded in every message.
                    </p>
                  </div>

                  <div style={{ padding: "16px 18px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <strong style={{ fontSize: 13, color: "var(--ink)", display: "block" }}>
                      3. Lead Registration
                    </strong>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)", lineHeight: 1.45 }}>
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
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-end",
                    padding: "20px 24px",
                    background: "#f8fafc",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                  }}
                >
                  <label style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--ink-secondary)" }}>
                    Manual Quarantine Add (Australian Mobile)
                    <input
                      name="mobile"
                      placeholder="04xx xxx xxx or +614xx xxx xxx"
                      required
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        marginTop: 6,
                        fontSize: 13,
                        height: 42,
                        background: "#ffffff",
                      }}
                    />
                  </label>
                  <button
                    disabled={busy || !canManage}
                    className="btn btn-secondary"
                    style={{ height: 42, padding: "0 22px", display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    {busy ? <><Spinner size="xs" /> Adding…</> : "Add to Do-Not-Contact List"}
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24, marginBottom: 28 }}>
                {/* 1. GOODSHOWROOM SUBDOMAIN CARD */}
                <section className="panel" style={{ margin: 0 }}>
                  <div className="panel-header">
                    <div>
                      <h3>Customer loyalty page</h3>
                      <p>Dedicated branded customer landing experience.</p>
                    </div>
                    <span className="badge badge-blue">Same portal</span>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                      Subdomain Endpoint
                    </label>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                      /loyalty
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                      Target Experience Embed
                    </label>
                    <div style={{ fontSize: 12, color: "var(--red)" }}>
                      /loyalty
                    </div>
                  </div>

                  <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
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

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                        Registered Sender ID
                      </label>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                        {String(data?.readiness?.senderId || "BooranSMH")}
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                        Sending Frequency Cap
                      </label>
                      <div style={{ fontSize: 12, color: "var(--ink)" }}>
                        1 message / customer / 30 days
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    disabled={busy || !canManage}
                    style={{ width: "100%", height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
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
                    {busy ? <><Spinner size="xs" /> Testing Connection…</> : "Send Telecommunications Test Ping"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={busy || !canManage}
                    style={{ width: "100%", height: 42, marginTop: 8 }}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const { campaign } = await api("kiasmorang");
                        if (typeof campaign?.id !== "string" || !campaign.id) {
                          throw new Error("The saved Kia campaign is unavailable.");
                        }
                        const requestId = kiaTestRequestId ?? crypto.randomUUID();
                        setKiaTestRequestId(requestId);
                        const result = await api("sms/test", { requestId, campaignId: campaign.id });
                        setNotice("KIASMORANG test SMS status: " + result.status + ".");
                        setKiaTestRequestId(null);
                      } catch (error) {
                        setNotice((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Send KIASMORANG Test SMS
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-secondary)" }}>
                        Primary Assignee · Sales Manager
                        <select
                          required
                          disabled={!isAdmin}
                          value={routing.salesManager}
                          onChange={(e) =>
                            setRouting({ ...routing, salesManager: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            marginTop: 6,
                            height: 42,
                            background: "#ffffff",
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

                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-secondary)" }}>
                        Secondary Assignee · General Manager
                        <select
                          required
                          disabled={!isAdmin}
                          value={routing.generalManager}
                          onChange={(e) =>
                            setRouting({ ...routing, generalManager: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            marginTop: 6,
                            height: 42,
                            background: "#ffffff",
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
                      disabled={busy || !isAdmin}
                      style={{ height: 42, padding: "0 24px", display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      {busy ? <><Spinner size="xs" color="#ffffff" trackColor="rgba(255,255,255,0.3)" /> Saving Routing…</> : "Save CRM Manager Routing →"}
                    </button>
                  </form>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: "var(--muted)", fontSize: 13 }}>
                    <Spinner size="sm" />
                    <span>Loading verified site assignees from DealerSocket catalog…</span>
                  </div>
                )}
              </section>
            </>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 8: REPORTS                                                */}
          {/* ------------------------------------------------------------- */}
          {tab === "Account" && <section className="panel"><h3>My account</h3><p>{user?.name} · {user?.username} · {user?.role.replaceAll('_', ' ')}</p><form onSubmit={changePassword} className="login-form"><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label><button className="btn btn-primary" disabled={busy}>Change password and sign out</button></form></section>}
          {tab === "Reports" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Campaign Performance & Conversion Funnel</h3>
                  <p>Real-time delivery confirmation and audience engagement metrics.</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
                <div style={{ padding: "20px 22px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                    Delivery Rate
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 6 }}>
                    {m.sent ? Math.round(((m.delivered || 0) / m.sent) * 100) : 100}%
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: 10 }}>Confirmed carrier receipts</small>
                </div>

                <div style={{ padding: "20px 22px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                    Click-Through Rate (CTR)
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 6 }}>
                    {m.delivered ? Math.round(((m.clicks || 0) / m.delivered) * 100) : 0}%
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: 10 }}>Tracked landing visits</small>
                </div>

                <div style={{ padding: "20px 22px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                    Lead Conversion
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 6 }}>
                    {m.clicks ? Math.round(((m.leads || 0) / m.clicks) * 100) : 0}%
                  </div>
                  <small style={{ color: "var(--muted)", fontSize: 10 }}>Form submissions / visits</small>
                </div>

                <div style={{ padding: "20px 22px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--border)" }}>
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
            </>
          )}
        </main>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 3 MODAL: 7 SCOPE SMS TEMPLATES & TELEMETRY                */}
      {/* ------------------------------------------------------------- */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Create Verified Loyalty Campaign</h3>
                <p>
                  Select from the {SCOPE_TEMPLATES.length} campaign templates, including the supplied year-end offer.
                </p>
              </div>
              <button
                style={{ background: "none", border: "none", fontSize: 22, color: "var(--muted)", padding: 4 }}
                onClick={() => setModal(false)}
              >
                ×
              </button>
            </div>

            {/* CAMPAIGN FORM - STRICT TOP-TO-BOTTOM SEQUENTIAL FLOW */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await action("campaigns", {
                  name: campaignName,
                  body: campaignBody,
                });
                if (result) {
                  setModal(false);
                  switchTab("Campaigns");
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              {/* STEP 1: CAMPAIGN NAME */}
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
                1. Campaign Reference Name
                <input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. November Loyalty Re-engagement"
                  maxLength={200}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    marginTop: 6,
                    height: 42,
                    background: "#ffffff",
                    fontSize: 13,
                  }}
                />
              </label>

              {/* STEP 2: TEMPLATE SELECTOR (TOP-TO-BOTTOM) */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                  2. Select Approved Campaign Template
                </label>
                <select
                  value={selectedTemplate.id}
                  onChange={(e) => {
                    const tmpl = SCOPE_TEMPLATES.find((t) => t.id === e.target.value) || SCOPE_TEMPLATES[0];
                    setSelectedTemplate(tmpl);
                    setCampaignBody(tmpl.body);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    height: 44,
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                    cursor: "pointer",
                  }}
                >
                  {SCOPE_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name} {tmpl.badge ? `· [${tmpl.badge}]` : ""}
                    </option>
                  ))}
                </select>

                {/* SELECTED TEMPLATE DETAILS CARD */}
                <div
                  style={{
                    marginTop: 10,
                    padding: "14px 16px",
                    background: "#f8fafc",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                      {selectedTemplate.name}
                    </span>
                    <span className={`badge ${selectedTemplate.recommended ? "badge-green" : "badge-blue"}`}>
                      {selectedTemplate.badge}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                    {selectedTemplate.description}
                  </p>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: "ui-monospace, monospace",
                      background: "#ffffff",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border-subtle)",
                      color: "#334155",
                      marginTop: 4,
                      wordBreak: "break-word",
                    }}
                  >
                    {selectedTemplate.body}
                  </div>
                </div>
              </div>

              {/* STEP 3: SMS MESSAGE BODY */}
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
                3. SMS Message Body
                <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: "var(--muted)", marginTop: 2 }}>
                  Must identify Booran and include mandatory tags: {"{link}"} and {"{optout}"}.
                </span>
                <textarea
                  value={campaignBody}
                  onChange={(e) => setCampaignBody(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    marginTop: 6,
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 12,
                    minHeight: 100,
                    background: "#ffffff",
                    lineHeight: 1.5,
                  }}
                />
              </label>

              {/* TOKEN CHIP SHORTCUTS */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Insert tag:</span>
                {["{firstName}", "{link}", "{optout}", "03 8432 3000"].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => {
                      if (!campaignBody.includes(token)) {
                        setCampaignBody((prev) => `${prev} ${token}`.trim());
                      }
                    }}
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontFamily: "ui-monospace, monospace",
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    + {token}
                  </button>
                ))}
              </div>

              {/* STEP 4: REAL-TIME TELEMETRY BAR */}
              <div className="telemetry-row" style={{ margin: 0 }}>
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

              {/* STEP 5: LIVE SMARTPHONE MESSAGE PREVIEW BUBBLE */}
              <div className="phone-preview-shell" style={{ marginTop: 0 }}>
                <div className="phone-preview-header">
                  <span>5. Simulated Handset Preview</span>
                  <span>Sender ID: BooranSMH</span>
                </div>

                <div className="phone-preview-bubble">
                  <span className="bubble-sender">BooranSMH</span>
                  {telemetry.renderedText}
                </div>
              </div>

              {/* STEP 6: ACTIONS */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 12,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={busy || !canManage}
                  className="btn btn-primary"
                  style={{ height: 42, padding: "0 22px", display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  {busy ? <><Spinner size="xs" color="#ffffff" trackColor="rgba(255,255,255,0.3)" /> Saving Draft…</> : "Save Campaign Draft →"}
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
            <div className="modal-header">
              <div>
                <h3>Link DealerSocket Customer</h3>
                <p>Verify matching phone number before confirming save.</p>
              </div>
              <button
                style={{ background: "none", border: "none", fontSize: 22, color: "var(--muted)", padding: 4 }}
                onClick={() => setMatchLead(null)}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 18px 0", lineHeight: 1.5 }}>
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-secondary)", marginBottom: 16 }}>
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
                    padding: "10px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    marginTop: 6,
                    height: 42,
                    background: "#ffffff",
                  }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ height: 40, padding: "0 18px" }}
                  onClick={() => setMatchLead(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: 40, padding: "0 20px", display: "inline-flex", alignItems: "center", gap: 8 }}
                  disabled={busy}
                >
                  {busy ? <><Spinner size="xs" color="#ffffff" trackColor="rgba(255,255,255,0.3)" /> Saving Match…</> : "Save Match"}
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
