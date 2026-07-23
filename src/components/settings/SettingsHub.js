"use client";

import { useState } from "react";
import { MailCheck, Palette, Settings2 } from "lucide-react";
import BrandingSettingsWorkspace from "@/components/settings/BrandingSettingsWorkspace";
import EmailDiagnostics from "@/components/settings/EmailDiagnostics";
import SystemSettingsForm from "@/components/settings/SystemSettingsForm";

const TABS = [
  ["branding", "Branding", Palette],
  ["system", "System Configuration", Settings2],
  ["diagnostics", "Email Diagnostics", MailCheck]
];

export default function SettingsHub() {
  const [activeTab, setActiveTab] = useState("branding");

  return (
    <div className="grid gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="gv-scrollbar flex gap-2 overflow-x-auto" role="tablist" aria-label="Settings area">
          {TABS.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`inline-flex min-h-11 min-w-max items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${activeTab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "branding" ? <BrandingSettingsWorkspace /> : null}
      {activeTab === "system" ? <SystemSettingsForm /> : null}
      {activeTab === "diagnostics" ? <EmailDiagnostics /> : null}
    </div>
  );
}
