"use client";

import { useEffect, useState } from "react";
import { Building2, FileText, MessageSquare, Save, Settings2, SlidersHorizontal } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_SYSTEM_SETTINGS, saveSystemSettings, subscribeSystemSettings } from "@/services/settingsService";
import BrandAssetUploader from "@/components/settings/BrandAssetUploader";

const SECTIONS = [
  ["branding", "Branding", Building2],
  ["reports", "Report Defaults", FileText],
  ["communications", "Communications", MessageSquare],
  ["masters", "Masters", SlidersHorizontal],
  ["servicing", "Servicing Rules", Settings2]
];

function TextField({ label, value, onChange, type = "text", multiline = false, hint }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>{label}</span>{multiline ? <textarea value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={`${inputClassName} min-h-28`} /> : <input type={type} value={value ?? ""} onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)} className={inputClassName} />}{hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}</label>;
}

function Toggle({ label, checked, onChange, description }) {
  return <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4" /><div><p className="text-sm font-bold text-slate-900">{label}</p>{description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}</div></label>;
}

export default function SystemSettingsForm() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("branding");
  const [settings, setSettings] = useState(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => subscribeSystemSettings((value) => { setSettings(value); setLoading(false); }, (nextError) => { setError(nextError.message); setLoading(false); }), []);

  function update(section, key, value) {
    setSettings((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  }

  async function save() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await saveSystemSettings(settings, profile);
      setNotice("Settings saved successfully.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <Card className="p-6 text-sm text-slate-500">Loading system settings…</Card>;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Configuration</p><h2 className="mt-1 text-xl font-black text-slate-950">Branding and operational settings</h2></div>
        <Button type="button" onClick={save} disabled={working}><Save size={17} /> {working ? "Saving…" : "Save Settings"}</Button>
      </div>
      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 p-3 lg:border-b-0 lg:border-r"><div className="flex gap-2 overflow-x-auto lg:grid">{SECTIONS.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setActiveSection(key)} className={`inline-flex min-w-max items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${activeSection === key ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={17} />{label}</button>)}</div></aside>
        <div className="p-5 sm:p-6">
          {error ? <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          {notice ? <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}

          {activeSection === "branding" ? <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <BrandAssetUploader label="App icon / square logo" assetKey="icon-logo" value={settings.branding.iconLogoUrl} onChange={(value) => update("branding", "iconLogoUrl", value)} hint="Used for the sidebar mark, portal icon and browser favicon. Recommended square PNG or JPG." />
              <BrandAssetUploader label="Primary / wide logo" assetKey="primary-logo" value={settings.branding.primaryLogoUrl} onChange={(value) => { update("branding", "primaryLogoUrl", value); update("branding", "logoUrl", value); }} hint="Used on light backgrounds, staff and Investor headers, login pages and report headers." />
              <BrandAssetUploader label="White / inverse logo" assetKey="white-logo" value={settings.branding.whiteLogoUrl} onChange={(value) => update("branding", "whiteLogoUrl", value)} hint="Used on premium black and Royal Trust Blue surfaces. Keep the original logo proportions." />
              <BrandAssetUploader label="Email header logo" assetKey="email-logo" value={settings.branding.emailLogoUrl} onChange={(value) => update("branding", "emailLogoUrl", value)} hint="Used in Brevo meeting, MOM and monthly-report emails. Falls back to the primary logo." />
              <BrandAssetUploader label="Report watermark" assetKey="report-watermark" value={settings.branding.watermarkUrl} onChange={(value) => update("branding", "watermarkUrl", value)} hint="A light transparent PNG works best for web and PDF reports." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Company name" value={settings.branding.companyName} onChange={(value) => update("branding", "companyName", value)} />
              <TextField label="Legal name" value={settings.branding.legalName} onChange={(value) => update("branding", "legalName", value)} />
              <TextField label="Application tagline" value={settings.branding.tagline} onChange={(value) => update("branding", "tagline", value)} />
              <TextField label="Brand positioning" value={settings.branding.brandPositioning} onChange={(value) => update("branding", "brandPositioning", value)} />
              <TextField label="Document footer tagline" value={settings.branding.documentFooterTagline} onChange={(value) => update("branding", "documentFooterTagline", value)} />
              <TextField label="Website" value={settings.branding.website} onChange={(value) => update("branding", "website", value)} />
              <TextField label="Support email" type="email" value={settings.branding.supportEmail} onChange={(value) => update("branding", "supportEmail", value)} />
              <TextField label="Support mobile" value={settings.branding.supportMobile} onChange={(value) => update("branding", "supportMobile", value)} />
              <TextField label="Primary colour" type="color" value={settings.branding.primaryColor} onChange={(value) => update("branding", "primaryColor", value)} />
              <TextField label="Secondary colour" type="color" value={settings.branding.secondaryColor} onChange={(value) => update("branding", "secondaryColor", value)} />
              <div className="sm:col-span-2"><TextField label="Office address" multiline value={settings.branding.address} onChange={(value) => update("branding", "address", value)} /></div>
              <div className="sm:col-span-2"><TextField label="Default email signature" multiline value={settings.branding.defaultEmailSignatureHtml} onChange={(value) => update("branding", "defaultEmailSignatureHtml", value)} hint="Plain text or simple HTML. Advisor-specific signatures override this value." /></div>
              <div className="sm:col-span-2"><TextField label="Email footer text" multiline value={settings.branding.emailFooterText} onChange={(value) => update("branding", "emailFooterText", value)} /></div>
            </div>
          </div> : null}

          {activeSection === "reports" ? <div className="grid gap-4 sm:grid-cols-2"><TextField label="Default report title" value={settings.reports.defaultTitle} onChange={(value) => update("reports", "defaultTitle", value)} /><TextField label="Currency" value={settings.reports.currency} onChange={(value) => update("reports", "currency", value)} /><TextField label="Date format" value={settings.reports.dateFormat} onChange={(value) => update("reports", "dateFormat", value)} /><TextField label="Footer text" value={settings.reports.footerText} onChange={(value) => update("reports", "footerText", value)} /><TextField label="Growth asset classes" value={settings.reports.growthAssetClasses} onChange={(value) => update("reports", "growthAssetClasses", value)} hint="Comma-separated" /><TextField label="Stable asset classes" value={settings.reports.stableAssetClasses} onChange={(value) => update("reports", "stableAssetClasses", value)} hint="Comma-separated" /><div className="sm:col-span-2"><TextField label="Confidentiality text" multiline value={settings.reports.confidentialityText} onChange={(value) => update("reports", "confidentialityText", value)} /></div><div className="sm:col-span-2"><TextField label="Default disclaimer" multiline value={settings.reports.disclaimer} onChange={(value) => update("reports", "disclaimer", value)} /></div></div> : null}

          {activeSection === "communications" ? <div className="grid gap-4 sm:grid-cols-2"><TextField label="Default sender name" value={settings.communications.senderName} onChange={(value) => update("communications", "senderName", value)} /><TextField label="Default sender email" type="email" value={settings.communications.senderEmail} onChange={(value) => update("communications", "senderEmail", value)} /><TextField label="Reply-to email" type="email" value={settings.communications.replyToEmail} onChange={(value) => update("communications", "replyToEmail", value)} /><TextField label="WhatsApp mode" value={settings.communications.whatsappMode} onChange={(value) => update("communications", "whatsappMode", value)} /><Toggle label="24-hour meeting reminder" checked={settings.communications.meetingReminder24Hours} onChange={(value) => update("communications", "meetingReminder24Hours", value)} /><Toggle label="1-hour meeting reminder" checked={settings.communications.meetingReminder1Hour} onChange={(value) => update("communications", "meetingReminder1Hour", value)} /><Toggle label="Investor email notifications" checked={settings.communications.investorEmailEnabled} onChange={(value) => update("communications", "investorEmailEnabled", value)} /><Toggle label="Advisor email notifications" checked={settings.communications.advisorEmailEnabled} onChange={(value) => update("communications", "advisorEmailEnabled", value)} /></div> : null}

          {activeSection === "masters" ? <div className="grid gap-4"><TextField label="Lead sources" multiline value={settings.masters.leadSources} onChange={(value) => update("masters", "leadSources", value)} hint="Comma-separated values" /><TextField label="Advisory areas" multiline value={settings.masters.advisoryAreas} onChange={(value) => update("masters", "advisoryAreas", value)} /><TextField label="Meeting types" multiline value={settings.masters.meetingTypes} onChange={(value) => update("masters", "meetingTypes", value)} /><TextField label="Goal categories" multiline value={settings.masters.goalCategories} onChange={(value) => update("masters", "goalCategories", value)} /><TextField label="Asset classes" multiline value={settings.masters.assetClasses} onChange={(value) => update("masters", "assetClasses", value)} /></div> : null}

          {activeSection === "servicing" ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><TextField label="WhatsApp update by day" type="number" value={settings.servicing.whatsappUpdateDay} onChange={(value) => update("servicing", "whatsappUpdateDay", value)} /><TextField label="Email update by day" type="number" value={settings.servicing.emailUpdateDay} onChange={(value) => update("servicing", "emailUpdateDay", value)} /><TextField label="General query hours" type="number" value={settings.servicing.generalQueryHours} onChange={(value) => update("servicing", "generalQueryHours", value)} /><TextField label="Action query hours" type="number" value={settings.servicing.actionQueryHours} onChange={(value) => update("servicing", "actionQueryHours", value)} /><TextField label="Complaint query hours" type="number" value={settings.servicing.complaintQueryHours} onChange={(value) => update("servicing", "complaintQueryHours", value)} /><TextField label="Urgent query hours" type="number" value={settings.servicing.urgentQueryHours} onChange={(value) => update("servicing", "urgentQueryHours", value)} /><TextField label="Review frequency days" type="number" value={settings.servicing.reviewFrequencyDays} onChange={(value) => update("servicing", "reviewFrequencyDays", value)} /><TextField label="Recap TAT hours" type="number" value={settings.servicing.recapHours} onChange={(value) => update("servicing", "recapHours", value)} /><TextField label="Rebalancing TAT days" type="number" value={settings.servicing.rebalancingDays} onChange={(value) => update("servicing", "rebalancingDays", value)} /><TextField label="Renewal flag days" type="number" value={settings.servicing.renewalFlagDays} onChange={(value) => update("servicing", "renewalFlagDays", value)} /><TextField label="Renewal conversation days" type="number" value={settings.servicing.renewalConversationDays} onChange={(value) => update("servicing", "renewalConversationDays", value)} /><TextField label="MOM pending hours" type="number" value={settings.servicing.momPendingHours} onChange={(value) => update("servicing", "momPendingHours", value)} /></div> : null}
        </div>
      </div>
    </Card>
  );
}
