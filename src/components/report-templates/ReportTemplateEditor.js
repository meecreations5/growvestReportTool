"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  FileText,
  GripVertical,
  LoaderCircle,
  Monitor,
  PanelRightOpen,
  Save,
  Settings2,
  Smartphone,
  Sparkles,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_ROLES, USER_ROLES } from "@/lib/constants/roles";
import {
  REPORT_TEMPLATE_SECTIONS,
  TEMPLATE_CATEGORY_LABELS,
  createReportTemplateSnapshot,
  visibleTemplateSections
} from "@/lib/constants/reportTemplates";
import { SIGNATURE_SOURCE_LABELS, createEmailTemplateSnapshot } from "@/lib/constants/emailTemplates";
import { subscribeEmailTemplates } from "@/services/emailTemplateService";
import {
  activateReportTemplate,
  duplicateReportTemplate,
  getReportTemplateForEditing,
  saveReportTemplateDraft
} from "@/services/reportTemplateService";
import TemplateThumbnail from "@/components/report-templates/TemplateThumbnail";
import TemplateStatusBadge from "@/components/report-templates/TemplateStatusBadge";

const inputClassName = "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const coverStyles = [
  { value: "premium-dark", label: "Premium Dark" },
  { value: "minimal-light", label: "Executive Light" },
  { value: "performance-grid", label: "Performance Grid" },
  { value: "structured-dark", label: "Structured Dark" },
  { value: "compact-gradient", label: "Compact Premium" },
  { value: "brand-light", label: "Brand Light" }
];

const coverPatterns = [
  { value: "orbital", label: "Orbital" },
  { value: "grid", label: "Grid" },
  { value: "lines", label: "Lines" },
  { value: "wave", label: "Wave" },
  { value: "brand-mark", label: "Brand Mark" },
  { value: "none", label: "None" }
];

const chartStyles = [
  { value: "modern", label: "Modern" },
  { value: "minimal", label: "Minimal" },
  { value: "analytical", label: "Analytical" },
  { value: "detailed", label: "Detailed" },
  { value: "compact", label: "Compact" }
];

const tableDensities = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" }
];

const previewModes = [
  { value: "desktop", label: "Desktop", icon: Monitor, width: "max-w-[760px]" },
  { value: "mobile", label: "Mobile", icon: Smartphone, width: "max-w-[320px]" },
  { value: "pdf", label: "A4 PDF", icon: FileText, width: "max-w-[470px]" }
];

function formatSavedAt(value) {
  if (!value) return "Not saved yet";
  return `Saved ${new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(value)}`;
}

function cloneTemplate(template) {
  const snapshot = createReportTemplateSnapshot(template);
  return {
    ...template,
    name: template?.name || "Custom Report Template",
    description: template?.description || "",
    category: template?.category || "custom",
    estimatedPages: template?.estimatedPages || "6–9 pages",
    sectionOrder: [...snapshot.sectionOrder],
    sectionVisibility: { ...snapshot.sectionVisibility },
    appearance: {
      ...snapshot.appearance,
      document: { ...snapshot.appearance.document }
    },
    delivery: { ...snapshot.delivery }
  };
}

function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-[#1F4ED8]" : "bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

function SettingsDrawer({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <button type="button" className="absolute inset-0 bg-slate-950/50" aria-label="Close settings" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-[#F5F7FB] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Template settings</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Appearance & document</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500"><X size={18} /></button>
        </header>
        <div className="p-4">{children}</div>
      </aside>
    </div>
  );
}

export default function ReportTemplateEditor({ templateId }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [template, setTemplate] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [busy, setBusy] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [activePanel, setActivePanel] = useState("sections");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedKey, setDraggedKey] = useState(null);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const signatureRef = useRef("");
  const readyRef = useRef(false);

  const isAdmin = ADMIN_ROLES.includes(profile?.role);
  const isSuperAdmin = profile?.role === USER_ROLES.SUPER_ADMIN;
  const readOnly = !isAdmin || Boolean(template?.isSystemTemplate);

  useEffect(() => {
    let active = true;
    async function loadTemplate() {
      if (!profile?.id) return;
      setLoading(true);
      setError("");
      try {
        const result = await getReportTemplateForEditing(templateId);
        if (!result) throw new Error("Report template not found.");
        if (!active) return;
        const next = cloneTemplate(result);
        setTemplate(next);
        setOriginal(next);
        signatureRef.current = JSON.stringify(next);
        readyRef.current = true;
      } catch (nextError) {
        console.error(nextError);
        if (active) setError(nextError.message || "Unable to load the report template.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTemplate();
    return () => { active = false; };
  }, [profile?.id, templateId]);


  useEffect(() => subscribeEmailTemplates(
    (items) => setEmailTemplates(items.filter((item) => item.status === "active")),
    (nextError) => console.warn("Unable to load email templates for report assignment", nextError)
  ), []);

  useEffect(() => {
    if (!template || !readyRef.current || readOnly) return;
    const signature = JSON.stringify(template);
    if (signature !== signatureRef.current) setSaveState("dirty");
  }, [readOnly, template]);

  useEffect(() => {
    if (!template || readOnly || saveState !== "dirty" || busy) return undefined;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const saved = await saveReportTemplateDraft(templateId, template, profile);
        const next = cloneTemplate(saved);
        signatureRef.current = JSON.stringify(next);
        setOriginal(next);
        setTemplate(next);
        setLastSavedAt(new Date());
        setSaveState("saved");
      } catch (nextError) {
        console.error(nextError);
        setSaveState("error");
      }
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [busy, profile, readOnly, saveState, template, templateId]);

  const visibleCount = useMemo(() => visibleTemplateSections(template || {}).length, [template]);
  const activePreview = previewModes.find((item) => item.value === previewMode) || previewModes[0];

  function updateField(field, value) {
    setTemplate((current) => ({ ...current, [field]: value }));
  }

  function updateAppearance(field, value) {
    setTemplate((current) => ({
      ...current,
      appearance: { ...current.appearance, [field]: value }
    }));
  }

  function updateDocument(field, value) {
    setTemplate((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        document: { ...current.appearance?.document, [field]: value }
      }
    }));
  }

  function updateDelivery(field, value) {
    setTemplate((current) => ({
      ...current,
      delivery: { ...current.delivery, [field]: value }
    }));
  }

  function selectEmailTemplate(emailTemplateId) {
    const selected = emailTemplates.find((item) => item.id === emailTemplateId);
    setTemplate((current) => ({
      ...current,
      delivery: {
        ...current.delivery,
        emailTemplateId,
        emailTemplateName: selected?.name || "Monthly Report Ready — Premium",
        emailTemplateVersion: Number(selected?.version || 1),
        emailTemplateSnapshot: selected ? createEmailTemplateSnapshot(selected) : current.delivery?.emailTemplateSnapshot || null
      }
    }));
  }

  function moveSection(key, direction) {
    setTemplate((current) => {
      const order = [...current.sectionOrder];
      const index = order.indexOf(key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return current;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return { ...current, sectionOrder: order };
    });
  }

  function dropSection(targetKey) {
    if (!draggedKey || draggedKey === targetKey) return;
    setTemplate((current) => {
      const order = [...current.sectionOrder];
      const from = order.indexOf(draggedKey);
      const to = order.indexOf(targetKey);
      if (from < 0 || to < 0) return current;
      order.splice(from, 1);
      order.splice(to, 0, draggedKey);
      return { ...current, sectionOrder: order };
    });
    setDraggedKey(null);
  }

  function toggleSection(section, checked) {
    if (section.mandatory && !checked) return;
    setTemplate((current) => ({
      ...current,
      sectionVisibility: { ...current.sectionVisibility, [section.key]: checked }
    }));
  }

  async function saveNow() {
    if (readOnly || !template) return;
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const saved = await saveReportTemplateDraft(templateId, template, profile);
      const next = cloneTemplate(saved);
      setTemplate(next);
      setOriginal(next);
      signatureRef.current = JSON.stringify(next);
      setSaveState("saved");
      setLastSavedAt(new Date());
      setNotice("Template draft saved.");
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to save the template draft.");
      setSaveState("error");
    } finally {
      setBusy("");
    }
  }

  async function activateTemplate() {
    if (!isSuperAdmin || !template || readOnly) return;
    setBusy("activate");
    setError("");
    setNotice("");
    try {
      const activated = await activateReportTemplate(templateId, template, profile);
      const next = cloneTemplate(activated);
      setTemplate(next);
      setOriginal(next);
      signatureRef.current = JSON.stringify(next);
      setSaveState("saved");
      setLastSavedAt(new Date());
      setNotice(`Template activated as version ${next.version}.`);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to activate the template.");
    } finally {
      setBusy("");
    }
  }

  async function duplicateForEditing() {
    if (!template || !isAdmin) return;
    setBusy("duplicate");
    setError("");
    try {
      const newId = await duplicateReportTemplate(template, profile, {
        name: `${template.name} — Custom`
      });
      router.push(`/report-templates/${newId}/edit`);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to create an editable template copy.");
      setBusy("");
    }
  }

  function resetChanges() {
    if (!original) return;
    const next = cloneTemplate(original);
    setTemplate(next);
    signatureRef.current = JSON.stringify(next);
    setSaveState("saved");
    setError("");
    setNotice("Unsaved changes were discarded.");
  }

  const settingsContent = template ? (
    <div className="grid gap-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Cover</p>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Cover style<select disabled={readOnly} className={inputClassName} value={template.appearance?.coverStyle || "premium-dark"} onChange={(event) => updateAppearance("coverStyle", event.target.value)}>{coverStyles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Background pattern<select disabled={readOnly} className={inputClassName} value={template.appearance?.coverPattern || "orbital"} onChange={(event) => updateAppearance("coverPattern", event.target.value)}>{coverPatterns.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-900">Advisor profile card</p><p className="mt-1 text-xs text-slate-500">Show Advisor contact details on the report cover.</p></div><Toggle checked={template.appearance?.advisorCardVisible !== false} disabled={readOnly} onChange={(value) => updateAppearance("advisorCardVisible", value)} label="Advisor card visibility" /></div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Data presentation</p>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Chart style<select disabled={readOnly} className={inputClassName} value={template.appearance?.chartStyle || "modern"} onChange={(event) => updateAppearance("chartStyle", event.target.value)}>{chartStyles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Table density<select disabled={readOnly} className={inputClassName} value={template.appearance?.tableDensity || "comfortable"} onChange={(event) => updateAppearance("tableDensity", event.target.value)}>{tableDensities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Brand colours</p>
        <div className="mt-4 grid gap-3">
          {[
            ["primaryColor", "Primary", "#1F4ED8"],
            ["secondaryColor", "Secondary", "#20B8CD"],
            ["darkColor", "Dark surface", "#0B1220"]
          ].map(([field, label, fallback]) => (
            <label key={field} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-semibold text-slate-700">{label}</span>
              <span className="flex items-center gap-2">
                <input disabled={readOnly} type="color" className="h-9 w-11 rounded border border-slate-200 bg-white p-1 disabled:opacity-60" value={template.appearance?.[field] || fallback} onChange={(event) => updateAppearance(field, event.target.value)} />
                <span className="w-20 font-mono text-xs text-slate-500">{template.appearance?.[field] || fallback}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Header, footer & disclaimer</p>
        <div className="mt-4 grid gap-3">
          {[
            ["showLogo", "Show GrowVest logo"],
            ["showClientCode", "Show client code"],
            ["showReportMonth", "Show reporting month"],
            ["showConfidentialLabel", "Show confidential label"],
            ["showPageNumbers", "Show page numbers"],
            ["showContactInformation", "Show contact information"]
          ].map(([field, label]) => <div key={field} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3"><span className="text-sm font-semibold text-slate-700">{label}</span><Toggle checked={template.appearance?.document?.[field] !== false} disabled={readOnly} onChange={(value) => updateDocument(field, value)} label={label} /></div>)}
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Disclaimer format<select disabled={readOnly} className={inputClassName} value={template.appearance?.document?.disclaimerStyle || "standard"} onChange={(event) => updateDocument("disclaimerStyle", event.target.value)}><option value="standard">Standard panel</option><option value="compact">Compact footer note</option><option value="detailed">Dedicated disclaimer section</option></select></label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Email delivery assignment</p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Default email template<select disabled={readOnly} className={inputClassName} value={template.delivery?.emailTemplateId || "monthly-report-ready-premium"} onChange={(event) => selectEmailTemplate(event.target.value)}>{template.delivery?.emailTemplateId && !emailTemplates.some((item) => item.id === template.delivery.emailTemplateId) ? <option value={template.delivery.emailTemplateId}>{template.delivery.emailTemplateName || "Assigned email template"} · v{template.delivery.emailTemplateVersion || 1}</option> : null}{emailTemplates.length ? emailTemplates.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version || 1}</option>) : <option value="monthly-report-ready-premium">Monthly Report Ready — Premium</option>}</select></label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Signature source<select disabled={readOnly} className={inputClassName} value={template.delivery?.signatureSource || "assigned_advisor"} onChange={(event) => updateDelivery("signatureSource", event.target.value)}>{Object.entries(SIGNATURE_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {[
            ["includeSecureLink", "Include secure report link"],
            ["attachPdf", "Attach generated PDF"],
            ["includeSignature", "Include published signature"]
          ].map(([field, label]) => <div key={field} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3"><span className="text-sm font-semibold text-slate-700">{label}</span><Toggle checked={template.delivery?.[field] !== false} disabled={readOnly} onChange={(value) => updateDelivery(field, value)} label={label} /></div>)}
          <Link href="/email-delivery/templates" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700">Manage email templates</Link>
        </div>
      </section>
    </div>
  ) : null;

  if (loading) return <div className="grid min-h-[620px] place-items-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">Loading template editor…</div>;
  if (!template) return <div className="grid min-h-[520px] place-items-center rounded-xl border border-slate-200 bg-white p-8 text-center"><div><FileText size={30} className="mx-auto text-slate-400" /><h1 className="mt-4 font-heading text-2xl font-bold text-slate-950">Template unavailable</h1><p className="mt-2 text-sm text-slate-500">{error || "This template could not be loaded."}</p><Link href="/report-templates" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white">Return to library</Link></div></div>;

  return (
    <div className="-mx-4 -mt-5 min-h-[calc(100dvh-5rem)] bg-[#F5F7FB] sm:-mx-6 sm:-mt-7 xl:-mx-8 xl:-mt-8">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 xl:px-8">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <Link href={`/report-templates/${templateId}`} className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-700"><ArrowLeft size={16} /> Back to template</Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="truncate font-heading text-2xl font-bold text-slate-950 sm:text-3xl">{template.name}</h1>
              <TemplateStatusBadge status={template.status} isDefault={template.isDefault} />
              {template.editingDraft ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">Draft changes</span> : null}
            </div>
            <p className={`mt-1 text-xs font-semibold ${saveState === "error" ? "text-red-600" : saveState === "dirty" ? "text-amber-600" : "text-slate-500"}`}>
              {readOnly ? "Read-only GrowVest standard template" : saveState === "saving" ? "Autosaving draft…" : saveState === "dirty" ? "Unsaved changes" : saveState === "error" ? "Autosave failed — use Save draft" : formatSavedAt(lastSavedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 xl:hidden"><PanelRightOpen size={17} /> Settings</button>
            {readOnly && isAdmin ? <button type="button" onClick={duplicateForEditing} disabled={busy === "duplicate"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white disabled:opacity-60">{busy === "duplicate" ? <LoaderCircle size={17} className="animate-spin" /> : <Copy size={17} />} Create editable copy</button> : null}
            {!readOnly ? <button type="button" onClick={resetChanges} disabled={saveState === "saved" || Boolean(busy)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">Reset</button> : null}
            {!readOnly ? <button type="button" onClick={saveNow} disabled={Boolean(busy) || saveState === "saved"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 disabled:opacity-50">{busy === "save" ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />} Save draft</button> : null}
            {!readOnly && isSuperAdmin ? <button type="button" onClick={activateTemplate} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white disabled:opacity-60">{busy === "activate" ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />} Activate version</button> : null}
          </div>
        </div>
      </header>

      <div className="grid gap-4 px-4 py-4 sm:px-6 xl:px-8 xl:py-6">
        {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
        {notice ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div> : null}
        {template.isSystemTemplate ? <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><Sparkles size={19} className="mt-0.5 shrink-0 text-blue-700" /><div><p className="font-semibold text-blue-950">GrowVest standard template</p><p className="mt-1 text-sm text-blue-800">Standard templates are protected. Create a custom copy to change sections, appearance or document settings.</p></div></div>{isAdmin ? <button type="button" onClick={duplicateForEditing} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white"><Copy size={16} /> Customize</button> : null}</div> : null}

        <div className="grid items-start gap-5 xl:grid-cols-[250px_minmax(0,1fr)_320px]">
          <aside className="hidden xl:grid xl:content-start xl:gap-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Template setup</p>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Template name<input disabled={readOnly} className={inputClassName} value={template.name || ""} onChange={(event) => updateField("name", event.target.value)} /></label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Description<textarea disabled={readOnly} rows="4" className={`${inputClassName} py-3`} value={template.description || ""} onChange={(event) => updateField("description", event.target.value)} /></label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Category<select disabled={readOnly} className={inputClassName} value={template.category || "custom"} onChange={(event) => updateField("category", event.target.value)}>{Object.entries(TEMPLATE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Estimated output<input disabled={readOnly} className={inputClassName} value={template.estimatedPages || ""} onChange={(event) => updateField("estimatedPages", event.target.value)} placeholder="6–9 pages" /></label>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Configuration</p>
              <div className="mt-3 grid gap-2">
                {[{ id: "sections", label: "Sections", count: visibleCount }, { id: "appearance", label: "Appearance" }, { id: "document", label: "Header & footer" }, { id: "delivery", label: "Email delivery" }].map((item) => <button key={item.id} type="button" onClick={() => setActivePanel(item.id)} className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm font-semibold ${activePanel === item.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}><span>{item.label}</span><span className="flex items-center gap-2">{item.count !== undefined ? <span className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-slate-200">{item.count}</span> : null}<ChevronRight size={15} /></span></button>)}
              </div>
            </section>
          </aside>

          <main className="min-w-0">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)] sm:p-5">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Live preview</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">HTML and PDF presentation</h2></div>
                <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1">{previewModes.map((item) => { const Icon = item.icon; return <button key={item.value} type="button" onClick={() => setPreviewMode(item.value)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold ${previewMode === item.value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><Icon size={14} /><span className="hidden sm:inline">{item.label}</span></button>; })}</div>
              </div>
              <div className="grid min-h-[520px] place-items-center overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4 sm:p-7"><div className={`w-full transition-all ${activePreview.width}`}><TemplateThumbnail template={template} /></div></div>
            </section>

            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 xl:hidden">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Report sections</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Order and visibility</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{visibleCount} visible</span></div>
              <div className="mt-4 grid gap-2">{template.sectionOrder.map((key, index) => { const section = REPORT_TEMPLATE_SECTIONS.find((item) => item.key === key); if (!section) return null; const visible = template.sectionVisibility?.[key] !== false; return <article key={key} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><GripVertical size={16} className="text-slate-400" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{index + 1}. {section.label}</p><p className="mt-0.5 text-xs text-slate-500">{section.mandatory ? "Mandatory" : visible ? "Visible" : "Hidden"}</p></div><Toggle checked={visible} disabled={readOnly || section.mandatory} onChange={(value) => toggleSection(section, value)} label={`${section.label} visibility`} /></article>; })}</div>
            </section>
          </main>

          <aside className="hidden xl:grid xl:content-start xl:gap-4">
            {activePanel === "sections" ? <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Report sections</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Order and visibility</h2></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{visibleCount}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">Drag sections to reorder. Mandatory sections remain visible. Keyboard users can use Move Up and Move Down.</p><div className="mt-4 grid gap-2">{template.sectionOrder.map((key, index) => { const section = REPORT_TEMPLATE_SECTIONS.find((item) => item.key === key); if (!section) return null; const visible = template.sectionVisibility?.[key] !== false; return <article key={key} draggable={!readOnly} onDragStart={() => setDraggedKey(key)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropSection(key)} className={`rounded-lg border p-3 transition ${draggedKey === key ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}><div className="flex items-start gap-2"><GripVertical size={17} className="mt-1 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{index + 1}. {section.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p></div><Toggle checked={visible} disabled={readOnly || section.mandatory} onChange={(value) => toggleSection(section, value)} label={`${section.label} visibility`} /></div><div className="mt-3 flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${section.mandatory ? "bg-blue-50 text-blue-700" : visible ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{section.mandatory ? "Mandatory" : visible ? "Visible" : "Hidden"}</span><div className="flex gap-1"><button type="button" disabled={readOnly || index === 0} onClick={() => moveSection(key, -1)} aria-label={`Move ${section.label} up`} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30"><ArrowUp size={14} /></button><button type="button" disabled={readOnly || index === template.sectionOrder.length - 1} onClick={() => moveSection(key, 1)} aria-label={`Move ${section.label} down`} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30"><ArrowDown size={14} /></button></div></div></article>; })}</div></section> : settingsContent}
          </aside>
        </div>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)}>{settingsContent}</SettingsDrawer>

      {!readOnly ? <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={saveNow} disabled={Boolean(busy) || saveState === "saved"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-blue-200 font-semibold text-blue-700 disabled:opacity-50"><Save size={17} /> Save draft</button>{isSuperAdmin ? <button type="button" onClick={activateTemplate} disabled={Boolean(busy)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] font-semibold text-white disabled:opacity-60"><Check size={17} /> Activate</button> : <button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] font-semibold text-white"><Settings2 size={17} /> Settings</button>}</div></div> : null}
    </div>
  );
}
