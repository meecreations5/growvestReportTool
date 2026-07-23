"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  FileImage,
  FileText,
  History,
  Mail,
  Palette,
  RotateCcw,
  Save,
  Share2,
  Sparkles,
  Type,
  UploadCloud
} from "lucide-react";
import Button from "@/components/ui/Button";
import BrandAssetUploader from "@/components/settings/BrandAssetUploader";
import BrandFontUploader from "@/components/settings/BrandFontUploader";
import BrandingPreviewPanel from "@/components/settings/BrandingPreviewPanel";
import BrandingVersionHistory from "@/components/settings/BrandingVersionHistory";
import { inputClassName } from "@/components/ui/Field";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_BRANDING,
  normaliseBranding,
  publishBranding,
  saveBrandingDraft,
  subscribeBrandingVersions,
  subscribeSystemSettings
} from "@/services/settingsService";

const SECTIONS = [
  ["identity", "Brand identity", Building2],
  ["assets", "Logo & assets", FileImage],
  ["colours", "Colours & typography", Palette],
  ["documents", "Reports & PDF", FileText],
  ["email", "Email branding", Mail],
  ["signature", "Signature branding", Share2],
  ["preview", "Live previews", Sparkles],
  ["history", "Version history", History]
];

const PREVIEW_FOR_SECTION = {
  identity: "application",
  assets: "staff-login",
  colours: "application",
  documents: "a4-pdf",
  email: "email",
  signature: "email"
};

function TextField({ label, value, onChange, type = "text", multiline = false, hint, placeholder, required }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      <span>{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
      {multiline ? (
        <textarea
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${inputClassName} min-h-28 resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
      )}
      {hint ? <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Toggle({ label, checked, onChange, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <div>
        <p className="text-sm font-bold text-slate-950">{label}</p>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
        <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </label>
  );
}

function ColourField({ label, value, onChange, description }) {
  return (
    <label className="rounded-xl border border-slate-200 bg-white p-4">
      <span className="text-sm font-bold text-slate-950">{label}</span>
      {description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
      <span className="mt-4 flex items-center gap-3">
        <input type="color" value={value || "#000000"} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
        <input value={value || ""} onChange={(event) => onChange(event.target.value.toUpperCase())} className={`${inputClassName} min-h-11 font-mono uppercase`} maxLength={7} />
      </span>
    </label>
  );
}

function SectionIntro({ eyebrow, title, description, icon: Icon }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 pb-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={19} /></span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{eyebrow}</p>
        <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function timestampLabel(value) {
  if (!value) return "Not available";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function validateBranding(branding) {
  const errors = [];
  if (!String(branding.companyName || "").trim()) errors.push("Company name is required.");
  if (!String(branding.legalName || "").trim()) errors.push("Legal company name is required.");
  if (!String(branding.supportEmail || "").includes("@")) errors.push("Enter a valid support email.");
  if (!String(branding.website || "").trim()) errors.push("Website is required.");
  ["primaryColor", "secondaryColor", "darkColor", "dangerColor", "warningColor", "surfaceColor", "mutedColor", "whiteColor"].forEach((field) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(String(branding[field] || ""))) errors.push(`${field.replace(/Color$/, " colour")} must use a six-digit hex value.`);
  });
  ["signatureLinkedInUrl", "signatureInstagramUrl", "signatureFacebookUrl", "signatureYouTubeUrl", "signatureXUrl"].forEach((field) => {
    const value = String(branding[field] || "").trim();
    if (value && !/^https?:\/\//i.test(value)) errors.push(`${field.replace(/^signature/, "Signature ").replace(/Url$/, " URL").replace(/([a-z])([A-Z])/g, "$1 $2")} must start with http:// or https://.`);
  });
  return errors;
}

export default function BrandingSettingsWorkspace() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("identity");
  const [activePreview, setActivePreview] = useState("application");
  const [published, setPublished] = useState(DEFAULT_BRANDING);
  const [draft, setDraft] = useState(DEFAULT_BRANDING);
  const [meta, setMeta] = useState({ version: 0, status: "published" });
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [saveState, setSaveState] = useState("saved");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const savedDraftRef = useRef(JSON.stringify(normaliseBranding(DEFAULT_BRANDING)));
  const draftRef = useRef(DEFAULT_BRANDING);
  const hydratedRef = useRef(false);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => subscribeSystemSettings((settings) => {
    const nextPublished = normaliseBranding(settings.branding);
    const nextDraft = normaliseBranding(settings.brandingDraft || settings.branding);
    setPublished(nextPublished);
    setMeta(settings.brandingMeta || { version: 0, status: "published" });

    const currentLocal = JSON.stringify(normaliseBranding(draftRef.current));
    if (!hydratedRef.current || currentLocal === savedDraftRef.current) {
      setDraft(nextDraft);
      draftRef.current = nextDraft;
      savedDraftRef.current = JSON.stringify(nextDraft);
      setSaveState("saved");
    }

    hydratedRef.current = true;
    setLoading(false);
  }, (nextError) => {
    setError(nextError.message || "Branding settings could not be loaded.");
    setLoading(false);
  }), []);

  useEffect(() => subscribeBrandingVersions((items) => {
    setVersions(items);
    setVersionsLoading(false);
  }, (nextError) => {
    console.warn(nextError);
    setVersionsLoading(false);
  }), []);

  const serialisedDraft = useMemo(() => JSON.stringify(normaliseBranding(draft)), [draft]);
  const hasUnpublishedChanges = serialisedDraft !== JSON.stringify(normaliseBranding(published));

  useEffect(() => {
    if (!hydratedRef.current || serialisedDraft === savedDraftRef.current) return;
    setSaveState("pending");
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await saveBrandingDraft(draft, profile);
        savedDraftRef.current = serialisedDraft;
        setSaveState("saved");
      } catch (nextError) {
        console.error(nextError);
        setSaveState("failed");
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [draft, profile, serialisedDraft]);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
    setError("");
  }

  async function saveDraftNow() {
    setWorking(true);
    setError("");
    setNotice("");
    setSaveState("saving");
    try {
      await saveBrandingDraft(draft, profile);
      savedDraftRef.current = JSON.stringify(normaliseBranding(draft));
      setSaveState("saved");
      setNotice("Branding draft saved. Live outputs have not changed.");
    } catch (nextError) {
      setError(nextError.message || "Branding draft could not be saved.");
      setSaveState("failed");
    } finally {
      setWorking(false);
    }
  }

  async function publish() {
    const validationErrors = validateBranding(draft);
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }

    setWorking(true);
    setError("");
    setNotice("");
    try {
      const version = await publishBranding(draft, profile);
      const normalised = normaliseBranding(draft);
      setPublished(normalised);
      savedDraftRef.current = JSON.stringify(normalised);
      setSaveState("saved");
      setNotice(`Branding version ${version} published across the application, emails, reports and PDFs.`);
    } catch (nextError) {
      setError(nextError.message || "Branding could not be published.");
    } finally {
      setWorking(false);
    }
  }

  function resetDraft() {
    setDraft(normaliseBranding(published));
    setNotice("Draft reset to the current published branding.");
    setError("");
  }

  function restoreVersion(version) {
    setDraft(normaliseBranding(version.branding));
    setActiveSection("preview");
    setActivePreview("application");
    setNotice(`Version ${version.version} restored to the draft. Review and publish to make it live.`);
    setError("");
  }

  function switchSection(key) {
    setActiveSection(key);
    if (PREVIEW_FOR_SECTION[key]) setActivePreview(PREVIEW_FOR_SECTION[key]);
  }

  if (loading) {
    return <div className="grid gap-4"><div className="h-24 animate-pulse rounded-2xl bg-white" /><div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_380px]"><div className="h-[520px] animate-pulse rounded-2xl bg-white" /><div className="h-[720px] animate-pulse rounded-2xl bg-white" /><div className="h-[520px] animate-pulse rounded-2xl bg-white" /></div></div>;
  }

  const statusText = saveState === "pending" ? "Autosave pending" : saveState === "saving" ? "Saving draft…" : saveState === "failed" ? "Autosave failed" : "All draft changes saved";

  return (
    <div className="grid gap-5 pb-24 lg:pb-0">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><BadgeCheck size={14} /> Published v{meta.version || 0}</span>
              {hasUnpublishedChanges ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Unpublished draft changes</span> : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Draft matches live branding</span>}
            </div>
            <h2 className="mt-3 font-heading text-2xl font-bold text-slate-950 sm:text-3xl">GrowVest brand control centre</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Manage the single branding source used by login pages, the staff workspace, Investor Portal, Brevo email templates, responsive HTML reports and A4 PDFs.</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span>{statusText}</span>
              <span>Last published: {timestampLabel(meta.lastPublishedAt)}</span>
              <span>Published by: {meta.lastPublishedByName || "—"}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={resetDraft} disabled={working || !hasUnpublishedChanges}><RotateCcw size={16} /> Reset Draft</Button>
            <Button type="button" variant="secondary" onClick={saveDraftNow} disabled={working}><Save size={16} /> Save Draft</Button>
            <Button type="button" onClick={publish} disabled={working || !hasUnpublishedChanges}><UploadCloud size={16} /> {working ? "Publishing…" : "Publish Branding"}</Button>
          </div>
        </div>
      </section>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_390px]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 xl:sticky xl:top-24 xl:self-start">
          <div className="gv-scrollbar flex gap-2 overflow-x-auto xl:grid" role="tablist" aria-label="Branding settings sections">
            {SECTIONS.map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeSection === key}
                onClick={() => switchSection(key)}
                className={`inline-flex min-h-11 min-w-max items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition xl:w-full ${activeSection === key ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
              >
                <Icon size={17} /> {label}
              </button>
            ))}
          </div>
          <div className="mt-4 hidden rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 xl:block">
            Draft changes autosave and remain private until you select <strong className="text-slate-700">Publish Branding</strong>.
          </div>
        </aside>

        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {activeSection === "identity" ? (
            <div className="grid gap-6">
              <SectionIntro eyebrow="Brand identity" title="Company identity and brand language" description="These details appear across the application, Investor Portal, reports, PDF metadata, communication templates and legal footers." icon={Building2} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField required label="Display name" value={draft.companyName} onChange={(value) => update("companyName", value)} hint="Short name used throughout the product interface." />
                <TextField required label="Legal company name" value={draft.legalName} onChange={(value) => update("legalName", value)} hint="Used in reports, PDF metadata, emails and legal footers." />
                <TextField label="Application tagline" value={draft.tagline} onChange={(value) => update("tagline", value)} hint="Used in application and email branding." />
                <TextField label="Brand positioning" value={draft.brandPositioning} onChange={(value) => update("brandPositioning", value)} hint="Example: Your Conscious Wealth Partner." />
                <TextField label="Document footer tagline" value={draft.documentFooterTagline} onChange={(value) => update("documentFooterTagline", value)} />
                <TextField required label="Website" value={draft.website} onChange={(value) => update("website", value)} placeholder="growvest.info" />
                <TextField required type="email" label="Support email" value={draft.supportEmail} onChange={(value) => update("supportEmail", value)} />
                <TextField label="Support mobile" value={draft.supportMobile} onChange={(value) => update("supportMobile", value)} />
                <div className="sm:col-span-2"><TextField label="Office address" multiline value={draft.address} onChange={(value) => update("address", value)} /></div>
              </div>
            </div>
          ) : null}

          {activeSection === "assets" ? (
            <div className="grid gap-6">
              <SectionIntro eyebrow="Logo system" title="Brand assets for every surface" description="Upload purpose-specific assets so logos remain clear on light, dark, email and document backgrounds. Original proportions are always preserved." icon={FileImage} />
              <div className="grid gap-4 md:grid-cols-2">
                <BrandAssetUploader label="App icon / square mark" assetKey="icon-logo" value={draft.iconLogoUrl} onChange={(value) => update("iconLogoUrl", value)} recommended="512 × 512px transparent PNG or WebP" hint="Used for the favicon, collapsed navigation and compact portal identity." previewTone="checker" />
                <BrandAssetUploader label="Primary wide logo" assetKey="primary-logo" value={draft.primaryLogoUrl} onChange={(value) => { update("primaryLogoUrl", value); update("logoUrl", value); }} recommended="1200 × 320px transparent PNG or WebP" hint="Used on white and light backgrounds." />
                <BrandAssetUploader label="White / inverse logo" assetKey="white-logo" value={draft.whiteLogoUrl} onChange={(value) => update("whiteLogoUrl", value)} recommended="1200 × 320px transparent PNG" hint="Used on premium black, Royal Trust Blue and dark report covers." previewTone="dark" />
                <BrandAssetUploader label="Email header logo" assetKey="email-logo" value={draft.emailLogoUrl} onChange={(value) => update("emailLogoUrl", value)} recommended="600 × 160px transparent PNG" hint="Optimised for Brevo transactional email headers." />
                <BrandAssetUploader label="Email signature logo" assetKey="signature-logo" value={draft.signatureLogoUrl} onChange={(value) => update("signatureLogoUrl", value)} recommended="720 × 240px transparent PNG or WebP" hint="Wide GrowVest logo used in the company block of individual staff signatures." />
                <BrandAssetUploader label="Email signature icon logo" assetKey="signature-icon" value={draft.signatureIconUrl} onChange={(value) => update("signatureIconUrl", value)} recommended="512 × 512px transparent PNG or WebP" hint="Compact GrowVest icon shown at the top-right of desktop and mobile email signatures. This is separate from the wide signature logo, app icon and PDF footer symbol." previewTone="checker" />
                <BrandAssetUploader label="PDF header logo" assetKey="pdf-logo" value={draft.pdfLogoUrl} onChange={(value) => update("pdfLogoUrl", value)} recommended="900 × 240px transparent PNG" hint="Used in A4 document headers and generated monthly-report PDFs." />
                <BrandAssetUploader label="PDF footer symbol" assetKey="footer-logo" value={draft.footerLogoUrl} onChange={(value) => update("footerLogoUrl", value)} recommended="512 × 512px transparent PNG" hint="Used as the compact footer mark, matching the GrowVest letterhead." previewTone="checker" />
                <BrandAssetUploader label="Report watermark" assetKey="report-watermark" value={draft.watermarkUrl} onChange={(value) => update("watermarkUrl", value)} recommended="1200 × 1200px transparent PNG" hint="Displayed subtly behind HTML and PDF report content." previewTone="checker" />
                <BrandAssetUploader label="Report cover background" assetKey="cover-background" value={draft.coverBackgroundUrl} onChange={(value) => update("coverBackgroundUrl", value)} recommended="1600 × 900px JPG, PNG or WebP" hint="Optional restrained background image for premium report covers." previewClassName="min-h-40" />
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-blue-800">
                Removing an asset clears it from the draft but does not delete the stored file, because published branding versions and old reports may still reference it.
              </div>
            </div>
          ) : null}

          {activeSection === "colours" ? (
            <div className="grid gap-6">
              <SectionIntro eyebrow="Design system" title="Approved colours and typography" description="The palette follows GrowVest’s trust, premium strength and strategic-attention system. Typography is fixed for product consistency." icon={Palette} />
              <div className="grid gap-4 md:grid-cols-2">
                <ColourField label="Royal Trust Blue" value={draft.primaryColor} onChange={(value) => update("primaryColor", value)} description="Primary actions, links, active navigation and key charts." />
                <ColourField label="Growth Cyan" value={draft.secondaryColor} onChange={(value) => update("secondaryColor", value)} description="Transformation, progress and supporting highlights." />
                <ColourField label="Deep Premium Black" value={draft.darkColor} onChange={(value) => update("darkColor", value)} description="Premium report covers, dark panels and strong headings." />
                <ColourField label="Strategic Red" value={draft.dangerColor} onChange={(value) => update("dangerColor", value)} description="Errors, failed delivery and critical attention." />
                <ColourField label="Insight Yellow" value={draft.warningColor} onChange={(value) => update("warningColor", value)} description="Warnings, insights and needs-review states." />
                <ColourField label="Soft Gray" value={draft.surfaceColor} onChange={(value) => update("surfaceColor", value)} description="Application background and quiet document surfaces." />
                <ColourField label="Medium Gray" value={draft.mutedColor} onChange={(value) => update("mutedColor", value)} description="Supporting copy, metadata and disabled states." />
                <ColourField label="White" value={draft.whiteColor} onChange={(value) => update("whiteColor", value)} description="Cards, clean report pages and inverse content." />
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-3"><Type size={20} className="text-blue-700" /><div><h3 className="font-heading text-xl font-bold text-slate-950">Typography is centrally managed</h3><p className="text-sm text-slate-500">League Spartan and Open Sauce One remain fixed. A licensed Emitha webfont can be uploaded for typed signature given names.</p></div></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Headings</p><p className="mt-3 font-heading text-3xl font-bold text-slate-950">League Spartan</p><p className="mt-2 text-xs text-slate-500">Page titles, section headings and premium report statements.</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Body and interface</p><p className="mt-3 text-2xl font-semibold text-slate-950">Open Sauce One</p><p className="mt-2 text-xs text-slate-500">Forms, tables, financial figures and readable report content.</p></div>
                </div>
                <div className="mt-4"><BrandFontUploader value={draft.signatureScriptFontUrl} onChange={(value) => update("signatureScriptFontUrl", value)} /></div>
              </section>
            </div>
          ) : null}

          {activeSection === "documents" ? (
            <div className="grid gap-6">
              <SectionIntro eyebrow="Report identity" title="HTML report and A4 PDF configuration" description="Control the shared identity used by responsive report previews, printable reports and server-generated PDFs." icon={FileText} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Confidential label" value={draft.confidentialLabel} onChange={(value) => update("confidentialLabel", value)} />
                <TextField label="PDF filename format" value={draft.pdfFilenamePattern} onChange={(value) => update("pdfFilenamePattern", value)} hint="Supported tokens: {InvestorName}, {Month}, {Year}, {ClientCode}, {ReportCode}." />
                <div className="sm:col-span-2"><TextField label="Document footer tagline" value={draft.documentFooterTagline} onChange={(value) => update("documentFooterTagline", value)} /></div>
                <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                  <span>Watermark opacity: {Number(draft.watermarkOpacity || 0)}%</span>
                  <input type="range" min="0" max="15" step="1" value={Number(draft.watermarkOpacity || 0)} onChange={(event) => update("watermarkOpacity", Number(event.target.value))} className="w-full accent-blue-600" />
                  <span className="text-xs font-normal text-slate-500">Keep watermarks subtle so financial data remains readable.</span>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Toggle label="Show page numbers" checked={draft.showPageNumbers} onChange={(value) => update("showPageNumbers", value)} description="Include Page X in the A4 PDF footer." />
                <Toggle label="Show contact information" checked={draft.showContactInFooter} onChange={(value) => update("showContactInFooter", value)} description="Display phone, email and website in document footers." />
                <Toggle label="Show footer tagline" checked={draft.showFooterTagline} onChange={(value) => update("showFooterTagline", value)} description="Display the document footer tagline below the legal company name." />
                <Toggle label="Show confidential label" checked={draft.showConfidentialLabel} onChange={(value) => update("showConfidentialLabel", value)} description="Display confidentiality status on report covers and footers." />
              </div>
            </div>
          ) : null}

          {activeSection === "email" ? (
            <div className="grid gap-6">
              <SectionIntro eyebrow="Email identity" title="Brevo transactional email branding" description="Configure the visual identity, signature fallback and legal footer used by report, meeting and MOM emails." icon={Mail} />
              <div className="grid gap-4">
                <TextField label="Default email signature" multiline value={draft.defaultEmailSignatureHtml} onChange={(value) => update("defaultEmailSignatureHtml", value)} hint="Plain text or simple HTML. Advisor-specific profile signatures override this fallback." />
                <TextField label="Email footer text" multiline value={draft.emailFooterText} onChange={(value) => update("emailFooterText", value)} hint="Include confidentiality, support or regulatory text. Sender name and reply-to address remain under System Configuration → Communications." />
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-800">
                Brevo sender verification, sender email and reply-to identity are operational settings. Use the System Configuration tab after publishing visual branding.
              </div>
            </div>
          ) : null}

          {activeSection === "signature" ? (
            <div className="grid gap-6">
              <SectionIntro eyebrow="Signature identity" title="Company-wide signature branding" description="Configure the company details inherited by staff email signatures. Individual users can still edit their personal name, designation, email and mobile number." icon={Share2} />

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Inherited defaults</p>
                  <h3 className="mt-1 font-heading text-xl font-bold text-slate-950">Signature company details</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">These values prefill staff signatures and can be reapplied from each user&apos;s My Signature page.</p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <TextField label="Default brand positioning" value={draft.signatureBrandPositioning} onChange={(value) => update("signatureBrandPositioning", value)} placeholder="Your Conscious Wealth Partner" />
                  <TextField label="Signature website" value={draft.signatureWebsite} onChange={(value) => update("signatureWebsite", value)} placeholder="growvest.info" />
                  <div className="sm:col-span-2"><TextField label="Signature office address" multiline value={draft.signatureAddress} onChange={(value) => update("signatureAddress", value)} /></div>
                  <TextField label="Left footer tagline" value={draft.signatureFooterLeftText} onChange={(value) => update("signatureFooterLeftText", value)} placeholder="Fulfill Your Bucketlist" />
                  <TextField label="Right footer tagline" value={draft.signatureFooterRightText} onChange={(value) => update("signatureFooterRightText", value)} placeholder="Experience the Wealth Every Moment" />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Social media</p>
                  <h3 className="mt-1 font-heading text-xl font-bold text-slate-950">Profiles shown in staff signatures</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Only profiles with a valid URL are displayed. Staff can hide the social row from their individual Visibility settings.</p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <TextField type="url" label="LinkedIn URL" value={draft.signatureLinkedInUrl} onChange={(value) => update("signatureLinkedInUrl", value)} placeholder="https://www.linkedin.com/company/growvest" />
                  <TextField type="url" label="Instagram URL" value={draft.signatureInstagramUrl} onChange={(value) => update("signatureInstagramUrl", value)} placeholder="https://www.instagram.com/growvest" />
                  <TextField type="url" label="Facebook URL" value={draft.signatureFacebookUrl} onChange={(value) => update("signatureFacebookUrl", value)} placeholder="https://www.facebook.com/growvest" />
                  <TextField type="url" label="YouTube URL" value={draft.signatureYouTubeUrl} onChange={(value) => update("signatureYouTubeUrl", value)} placeholder="https://www.youtube.com/@growvest" />
                  <TextField type="url" label="X / Twitter URL" value={draft.signatureXUrl} onChange={(value) => update("signatureXUrl", value)} placeholder="https://x.com/growvest" />
                </div>
                <div className="mt-4">
                  <Toggle label="Enable social media in signatures" checked={draft.signatureSocialEnabled} onChange={(value) => update("signatureSocialEnabled", value)} description="When enabled, configured social profiles appear as email-safe linked icons and in the WhatsApp signature text." />
                </div>
              </section>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-800">
                Signature logo, signature icon and Emitha font are managed under <strong>Logo &amp; assets</strong> and <strong>Colours &amp; typography</strong>. Publish Branding after updating these defaults.
              </div>
            </div>
          ) : null}

          {activeSection === "preview" ? (
            <div className="grid gap-6">
              <SectionIntro eyebrow="Preview centre" title="Review every branded experience" description="Switch between product, login, email, HTML report and A4 PDF previews before publishing." icon={Sparkles} />
              <BrandingPreviewPanel branding={draft} activePreview={activePreview} onPreviewChange={setActivePreview} sticky={false} />
            </div>
          ) : null}

          {activeSection === "history" ? <BrandingVersionHistory versions={versions} loading={versionsLoading} onRestore={restoreVersion} /> : null}
        </main>

        {!["preview", "history"].includes(activeSection) ? <BrandingPreviewPanel branding={draft} activePreview={activePreview} onPreviewChange={setActivePreview} /> : <div className="hidden xl:block" />}
      </div>

      <div className="gv-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_32px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[1fr_1.35fr] gap-2">
          <Button type="button" variant="secondary" onClick={saveDraftNow} disabled={working}><Save size={16} /> Save Draft</Button>
          <Button type="button" onClick={publish} disabled={working || !hasUnpublishedChanges}><Check size={16} /> Publish Branding</Button>
        </div>
      </div>
    </div>
  );
}
