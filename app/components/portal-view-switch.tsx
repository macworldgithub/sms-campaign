"use client";

export default function PortalViewSwitch({ view, onChange }: { view: "customer" | "staff"; onChange: (view: "customer" | "staff") => void }) {
  return <div className="portal-switch-tabs" role="group" aria-label="Portal view">
    <button type="button" aria-pressed={view === "customer"} onClick={() => onChange("customer")}>Customer loyalty</button>
    <button type="button" aria-pressed={view === "staff"} onClick={() => onChange("staff")}>Staff / Admin</button>
  </div>;
}
