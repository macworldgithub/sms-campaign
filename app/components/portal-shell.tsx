"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import PortalViewSwitch from "./portal-view-switch";

const LoyaltyForm = dynamic(() => import("../loyalty/loyalty-form"));
const StaffWorkspace = dynamic(() => import("./staff-workspace"));

type View = "customer" | "staff";
const subscribe = (notify: () => void) => { window.addEventListener("popstate", notify); return () => window.removeEventListener("popstate", notify); };
const locationQuery = () => window.location.search;
const serverQuery = () => "";
export default function PortalShell() {
  const query = useSyncExternalStore(subscribe, locationQuery, serverQuery);
  const params = new URLSearchParams(query);
  const ref = params.get("ref") || "";
  const campaignRef = /^[a-f0-9-]{36}$/i.test(ref) ? ref : "";
  const defaultView: View = params.get("view") === "customer" || campaignRef ? "customer" : "staff";
  const [selectedView, setView] = useState<View | null>(null);
  const view = selectedView || defaultView;
  const [visited, setVisited] = useState<View[]>([]);
  const changeView = (next: View) => {
    setVisited(previous => [...new Set([...previous, view, next])]);
    setView(next);
  };
  return <div className="portal-mode-shell">
    <div className="portal-view" id="customer-view-panel" role="region" aria-label="Customer loyalty" hidden={view !== "customer"}>{(view === "customer" || visited.includes("customer")) && <LoyaltyForm campaignRef={campaignRef} viewSwitch={<PortalViewSwitch view={view} onChange={changeView} />} />}</div>
    <div className="portal-view" id="staff-view-panel" role="region" aria-label="Staff workspace" hidden={view !== "staff"}>{(view === "staff" || visited.includes("staff")) && <StaffWorkspace viewSwitch={<PortalViewSwitch view={view} onChange={changeView} />} />}</div>
  </div>;
}
