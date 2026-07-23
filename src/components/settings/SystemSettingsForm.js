"use client";

import { useEffect, useState } from "react";
import { FileText, MessageSquare, Save, Settings2, SlidersHorizontal } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_SYSTEM_SETTINGS, saveSystemSettings, subscribeSystemSettings } from "@/services/settingsService";

const SECTIONS = [
  ["reports", "Report Defaults", FileText],
  ["communications", "Communications", MessageSquare],
  ["masters", "Masters", SlidersHorizontal],
  ["servicing", "Servicing Rules", Settings2]
];

function TextField({ label, value, onChange, type = "text", multiline = false, hint }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {multiline ? (
        <textarea value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={`${inputClassName} min-h-28 resize-y`} />
      ) : (
        <input type={type} value={value ?? ""} onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)} className={inputClassName} />
      )}
      {hint ? <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Toggle({ label, checked, onChange, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div><p className="text-sm font-bold text-slate-950">{label}</p>{description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}</div>
      <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
        <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </label>
  );
}

export default function SystemSettingsForm() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("reports");
  const [settings, setSettings] = useState(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => subscribeSystemSettings((value) => {
    setSettings(value);
    setLoading(false);
  }, (nextError) => {
    setError(nextError.message);
    setLoading(false);
  }), []);

  function update(section, key, value) {
    setSettings((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
    setNotice("");
    setError("");
  }

  async function save() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await saveSystemSettings(settings, profile);
      setNotice("System configuration saved successfully.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <Card className="p-6 text-sm text-slate-500">Loading system configuration…</Card>;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Operational configuration</p>
          <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Reports, communication and servicing rules</h2>
          <p className="mt-1 text-sm text-slate-500">Brand assets and visual identity are managed separately in the Branding tab.</p>
        </div>
        <Button type="button" onClick={save} disabled={working}><Save size={17} /> {working ? "Saving…" : "Save Configuration"}</Button>
      </div>

      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 p-3 lg:border-b-0 lg:border-r">
          <div className="gv-scrollbar flex gap-2 overflow-x-auto lg:grid">
            {SECTIONS.map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => setActiveSection(key)} className={`inline-flex min-h-11 min-w-max items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ${activeSection === key ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
                <Icon size={17} /> {label}
              </button>
            ))}
          </div>
        </aside>

        <div className="p-5 sm:p-6">
          {error ? <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          {notice ? <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}

          {activeSection === "reports" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Default report title" value={settings.reports.defaultTitle} onChange={(value) => update("reports", "defaultTitle", value)} />
              <TextField label="Currency" value={settings.reports.currency} onChange={(value) => update("reports", "currency", value)} />
              <TextField label="Date format" value={settings.reports.dateFormat} onChange={(value) => update("reports", "dateFormat", value)} />
              <TextField label="Footer text" value={settings.reports.footerText} onChange={(value) => update("reports", "footerText", value)} />
              <TextField label="Growth asset classes" value={settings.reports.growthAssetClasses} onChange={(value) => update("reports", "growthAssetClasses", value)} hint="Comma-separated" />
              <TextField label="Stable asset classes" value={settings.reports.stableAssetClasses} onChange={(value) => update("reports", "stableAssetClasses", value)} hint="Comma-separated" />
              <div className="sm:col-span-2"><TextField label="Confidentiality text" multiline value={settings.reports.confidentialityText} onChange={(value) => update("reports", "confidentialityText", value)} /></div>
              <div className="sm:col-span-2"><TextField label="Default disclaimer" multiline value={settings.reports.disclaimer} onChange={(value) => update("reports", "disclaimer", value)} /></div>
            </div>
          ) : null}

          {activeSection === "communications" ? (
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Sender name" value={settings.communications.senderName} onChange={(value) => update("communications", "senderName", value)} />
                <TextField type="email" label="Sender email" value={settings.communications.senderEmail} onChange={(value) => update("communications", "senderEmail", value)} />
                <TextField type="email" label="Reply-to email" value={settings.communications.replyToEmail} onChange={(value) => update("communications", "replyToEmail", value)} />
                <TextField label="WhatsApp mode" value={settings.communications.whatsappMode} onChange={(value) => update("communications", "whatsappMode", value)} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Toggle label="Meeting reminder — 24 hours" checked={settings.communications.meetingReminder24Hours} onChange={(value) => update("communications", "meetingReminder24Hours", value)} />
                <Toggle label="Meeting reminder — 1 hour" checked={settings.communications.meetingReminder1Hour} onChange={(value) => update("communications", "meetingReminder1Hour", value)} />
                <Toggle label="Investor email enabled" checked={settings.communications.investorEmailEnabled} onChange={(value) => update("communications", "investorEmailEnabled", value)} />
                <Toggle label="Advisor email enabled" checked={settings.communications.advisorEmailEnabled} onChange={(value) => update("communications", "advisorEmailEnabled", value)} />
                <Toggle label="Investor in-app notifications" checked={settings.communications.investorInAppEnabled} onChange={(value) => update("communications", "investorInAppEnabled", value)} />
                <Toggle label="Advisor in-app notifications" checked={settings.communications.advisorInAppEnabled} onChange={(value) => update("communications", "advisorInAppEnabled", value)} />
              </div>
            </div>
          ) : null}

          {activeSection === "masters" ? (
            <div className="grid gap-4">
              <TextField label="Lead sources" multiline value={settings.masters.leadSources} onChange={(value) => update("masters", "leadSources", value)} hint="Comma-separated" />
              <TextField label="Advisory areas" multiline value={settings.masters.advisoryAreas} onChange={(value) => update("masters", "advisoryAreas", value)} hint="Comma-separated" />
              <TextField label="Meeting types" multiline value={settings.masters.meetingTypes} onChange={(value) => update("masters", "meetingTypes", value)} hint="Comma-separated" />
              <TextField label="Goal categories" multiline value={settings.masters.goalCategories} onChange={(value) => update("masters", "goalCategories", value)} hint="Comma-separated" />
              <TextField label="Asset classes" multiline value={settings.masters.assetClasses} onChange={(value) => update("masters", "assetClasses", value)} hint="Comma-separated" />
            </div>
          ) : null}

          {activeSection === "servicing" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField label="WhatsApp update day" type="number" value={settings.servicing.whatsappUpdateDay} onChange={(value) => update("servicing", "whatsappUpdateDay", value)} />
              <TextField label="Email update day" type="number" value={settings.servicing.emailUpdateDay} onChange={(value) => update("servicing", "emailUpdateDay", value)} />
              <TextField label="General query hours" type="number" value={settings.servicing.generalQueryHours} onChange={(value) => update("servicing", "generalQueryHours", value)} />
              <TextField label="Action query hours" type="number" value={settings.servicing.actionQueryHours} onChange={(value) => update("servicing", "actionQueryHours", value)} />
              <TextField label="Complaint query hours" type="number" value={settings.servicing.complaintQueryHours} onChange={(value) => update("servicing", "complaintQueryHours", value)} />
              <TextField label="Urgent query hours" type="number" value={settings.servicing.urgentQueryHours} onChange={(value) => update("servicing", "urgentQueryHours", value)} />
              <TextField label="Review frequency days" type="number" value={settings.servicing.reviewFrequencyDays} onChange={(value) => update("servicing", "reviewFrequencyDays", value)} />
              <TextField label="Review invite days" type="number" value={settings.servicing.reviewInviteDays} onChange={(value) => update("servicing", "reviewInviteDays", value)} />
              <TextField label="Recap TAT hours" type="number" value={settings.servicing.recapHours} onChange={(value) => update("servicing", "recapHours", value)} />
              <TextField label="Rebalancing TAT days" type="number" value={settings.servicing.rebalancingDays} onChange={(value) => update("servicing", "rebalancingDays", value)} />
              <TextField label="Renewal flag days" type="number" value={settings.servicing.renewalFlagDays} onChange={(value) => update("servicing", "renewalFlagDays", value)} />
              <TextField label="Renewal conversation days" type="number" value={settings.servicing.renewalConversationDays} onChange={(value) => update("servicing", "renewalConversationDays", value)} />
              <TextField label="MOM pending hours" type="number" value={settings.servicing.momPendingHours} onChange={(value) => update("servicing", "momPendingHours", value)} />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
