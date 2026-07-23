"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock3, Copy, Eye, Loader2, Monitor, Save, Smartphone, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_ROLES, USER_ROLES } from "@/lib/constants/roles";
import {
  EMAIL_MERGE_FIELDS,
  EMAIL_TEMPLATE_TYPE_LABELS,
  SIGNATURE_SOURCE_LABELS,
  createEmailTemplateSnapshot
} from "@/lib/constants/emailTemplates";
import {
  activateEmailTemplate,
  duplicateEmailTemplate,
  getEmailTemplateForEditing,
  getEmailTemplateVersions,
  saveEmailTemplateDraft
} from "@/services/emailTemplateService";
import EmailTemplatePreview from "@/components/email-templates/EmailTemplatePreview";
import { inputClassName } from "@/components/ui/Field";

const tabs = [
  ["content", "Content"],
  ["header", "Header"],
  ["design", "Design"],
  ["signature", "Signature"],
  ["preview", "Preview"],
  ["versions", "Versions"]
];

function Toggle({ checked, onChange, disabled, label }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full ${checked ? "bg-blue-700" : "bg-slate-300"} disabled:opacity-50`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`} /></button>;
}

function ColorField({ label, value, onChange, disabled }) {
  return <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3"><span className="text-sm font-semibold text-slate-700">{label}</span><span className="flex items-center gap-2"><input type="color" disabled={disabled} className="h-9 w-11 rounded border border-slate-200 bg-white p-1" value={value} onChange={(event) => onChange(event.target.value)} /><span className="w-20 font-mono text-xs text-slate-500">{value}</span></span></label>;
}

function formatVersionDate(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Current configuration";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function EmailTemplateEditor({ templateId }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [template, setTemplate] = useState(null);
  const [tab, setTab] = useState("content");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [versions, setVersions] = useState([]);
  const isAdmin = ADMIN_ROLES.includes(profile?.role);
  const isSuperAdmin = profile?.role === USER_ROLES.SUPER_ADMIN;
  const readOnly = !isAdmin || Boolean(template?.isSystemTemplate);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await getEmailTemplateForEditing(templateId);
        if (!result) throw new Error("Email template not found.");
        if (active) setTemplate({ ...result, ...createEmailTemplateSnapshot(result) });
      } catch (nextError) {
        if (active) setError(nextError.message || "Unable to load the email template.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [templateId]);

  useEffect(() => {
    if (!profile?.id || !templateId) return;
    getEmailTemplateVersions(templateId)
      .then(setVersions)
      .catch((nextError) => {
        console.warn("Unable to load email template versions", nextError);
        setVersions([]);
      });
  }, [profile?.id, templateId, template?.version]);

  const mergeFieldText = useMemo(() => EMAIL_MERGE_FIELDS.map((item) => `{{${item.key}}}`).join("  "), []);

  function updateTop(field, value) {
    setTemplate((current) => ({ ...current, [field]: value }));
  }

  function updateContent(field, value) {
    setTemplate((current) => ({ ...current, content: { ...current.content, [field]: value } }));
  }

  function updateDesign(section, field, value) {
    setTemplate((current) => ({
      ...current,
      design: section
        ? { ...current.design, [section]: { ...current.design[section], [field]: value } }
        : { ...current.design, [field]: value }
    }));
  }

  function updateSignature(field, value) {
    setTemplate((current) => ({ ...current, signature: { ...current.signature, [field]: value } }));
  }

  function updateSignatureVisibility(field, value) {
    setTemplate((current) => ({ ...current, signature: { ...current.signature, visibility: { ...current.signature.visibility, [field]: value } } }));
  }

  function updateDelivery(field, value) {
    setTemplate((current) => ({ ...current, delivery: { ...current.delivery, [field]: value } }));
  }

  async function save() {
    setBusy("save"); setError(""); setNotice("");
    try {
      const result = await saveEmailTemplateDraft(templateId, template, profile);
      setTemplate({ ...result, ...createEmailTemplateSnapshot(result) });
      setNotice("Email template draft saved.");
    } catch (nextError) {
      setError(nextError.message || "Unable to save the email template.");
    } finally { setBusy(""); }
  }

  async function activate() {
    setBusy("activate"); setError(""); setNotice("");
    try {
      const result = await activateEmailTemplate(templateId, template, profile);
      setTemplate({ ...result, ...createEmailTemplateSnapshot(result) });
      setNotice(`Email template activated as version ${result.version}.`);
    } catch (nextError) {
      setError(nextError.message || "Unable to activate the email template.");
    } finally { setBusy(""); }
  }

  async function duplicate() {
    setBusy("duplicate"); setError("");
    try {
      const id = await duplicateEmailTemplate(template, profile, { name: `${template.name} — Custom` });
      router.push(`/email-delivery/templates/${id}/edit`);
    } catch (nextError) {
      setError(nextError.message || "Unable to create an editable copy.");
      setBusy("");
    }
  }

  if (loading) return <div className="grid min-h-[600px] place-items-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">Loading email template…</div>;
  if (!template) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error || "Email template unavailable."}</div>;

  return (
    <div className="-mx-4 -mt-5 min-h-[calc(100dvh-5rem)] bg-[#F5F7FB] sm:-mx-6 sm:-mt-7 xl:-mx-8 xl:-mt-8">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 xl:px-8">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <Link href="/email-delivery/templates" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><ArrowLeft size={16} /> Email templates</Link>
            <div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="font-heading text-2xl font-bold text-slate-950">{template.name}</h1><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700">{template.status}</span>{template.editingDraft ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">Draft changes</span> : null}</div>
            <p className="mt-1 text-xs font-semibold text-slate-500">{EMAIL_TEMPLATE_TYPE_LABELS[template.type]} · Version {template.version || 1}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {readOnly && isAdmin ? <button type="button" onClick={duplicate} disabled={busy === "duplicate"} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">{busy === "duplicate" ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />} Create editable copy</button> : null}
            {!readOnly ? <button type="button" onClick={save} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700">{busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save draft</button> : null}
            {!readOnly && isSuperAdmin ? <button type="button" onClick={activate} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">{busy === "activate" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Activate version</button> : null}
          </div>
        </div>
      </header>

      <div className="grid gap-5 px-4 py-5 sm:px-6 xl:px-8">
        {template.isSystemTemplate ? <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Sparkles size={18} className="mt-0.5 shrink-0" /><p>This GrowVest standard template is protected. Create an editable copy to customise content, header, colours or signature visibility.</p></div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">{tabs.map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`min-h-10 whitespace-nowrap rounded-lg px-4 text-sm font-semibold ${tab === value ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}</div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_470px]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            {tab === "content" ? <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Template name<input disabled={readOnly} className={inputClassName} value={template.name} onChange={(event) => updateTop("name", event.target.value)} /></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Template type<select disabled={readOnly} className={inputClassName} value={template.type} onChange={(event) => updateTop("type", event.target.value)}>{Object.entries(EMAIL_TEMPLATE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Description<textarea disabled={readOnly} className={`${inputClassName} min-h-20 py-3`} value={template.description || ""} onChange={(event) => updateTop("description", event.target.value)} /></label>
              {[ ["subject", "Email subject"], ["preheader", "Preheader text"], ["eyebrow", "Eyebrow"], ["heading", "Email heading"], ["greeting", "Greeting line"], ["ctaText", "CTA button text"], ["privacyNote", "Privacy note"], ["footerText", "Legal footer text"] ].map(([field, label]) => <label key={field} className="grid gap-1.5 text-sm font-semibold text-slate-700">{label}<input disabled={readOnly} className={inputClassName} value={template.content[field] || ""} onChange={(event) => updateContent(field, event.target.value)} /></label>)}
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Supporting message<textarea disabled={readOnly} className={`${inputClassName} min-h-36 py-3`} value={template.content.body || ""} onChange={(event) => updateContent("body", event.target.value)} /></label>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-6 text-blue-800"><strong>Merge fields:</strong> {mergeFieldText}</div>
            </div> : null}

            {tab === "header" ? <div className="grid gap-4"><h2 className="font-heading text-xl font-bold text-slate-950">Header and divider</h2><ColorField label="Header background" value={template.design.header.backgroundColor} disabled={readOnly} onChange={(value) => updateDesign("header", "backgroundColor", value)} /><ColorField label="Header text" value={template.design.header.textColor} disabled={readOnly} onChange={(value) => updateDesign("header", "textColor", value)} /><ColorField label="Divider colour" value={template.design.header.dividerColor} disabled={readOnly} onChange={(value) => updateDesign("header", "dividerColor", value)} /><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Header alignment<select disabled={readOnly} className={inputClassName} value={template.design.header.alignment} onChange={(event) => updateDesign("header", "alignment", event.target.value)}><option value="left">Left</option><option value="center">Centre</option></select></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Header padding<input disabled={readOnly} type="number" min="12" max="50" className={inputClassName} value={template.design.header.padding} onChange={(event) => updateDesign("header", "padding", Number(event.target.value))} /></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Divider thickness<input disabled={readOnly} type="number" min="0" max="12" className={inputClassName} value={template.design.header.dividerThickness} onChange={(event) => updateDesign("header", "dividerThickness", Number(event.target.value))} /></label>{[["showTagline", "Show brand positioning"], ["dividerVisible", "Show coloured divider"]].map(([field, label]) => <div key={field} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><span className="text-sm font-semibold text-slate-700">{label}</span><Toggle disabled={readOnly} checked={template.design.header[field] !== false} onChange={(value) => updateDesign("header", field, value)} label={label} /></div>)}</div> : null}

            {tab === "design" ? <div className="grid gap-4"><h2 className="font-heading text-xl font-bold text-slate-950">Email canvas and CTA</h2><ColorField label="Canvas background" value={template.design.canvasBackground} disabled={readOnly} onChange={(value) => updateDesign(null, "canvasBackground", value)} /><ColorField label="Content background" value={template.design.contentBackground} disabled={readOnly} onChange={(value) => updateDesign(null, "contentBackground", value)} /><ColorField label="Heading colour" value={template.design.typography.headingColor} disabled={readOnly} onChange={(value) => updateDesign("typography", "headingColor", value)} /><ColorField label="Body colour" value={template.design.typography.bodyColor} disabled={readOnly} onChange={(value) => updateDesign("typography", "bodyColor", value)} /><ColorField label="CTA background" value={template.design.button.backgroundColor} disabled={readOnly} onChange={(value) => updateDesign("button", "backgroundColor", value)} /><ColorField label="CTA text" value={template.design.button.textColor} disabled={readOnly} onChange={(value) => updateDesign("button", "textColor", value)} /><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Email max width<input disabled={readOnly} type="number" className={inputClassName} value={template.design.maxWidth} onChange={(event) => updateDesign(null, "maxWidth", Number(event.target.value))} /></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Card radius<input disabled={readOnly} type="number" className={inputClassName} value={template.design.borderRadius} onChange={(event) => updateDesign(null, "borderRadius", Number(event.target.value))} /></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Heading size<input disabled={readOnly} type="number" className={inputClassName} value={template.design.typography.headingSize} onChange={(event) => updateDesign("typography", "headingSize", Number(event.target.value))} /></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Body size<input disabled={readOnly} type="number" className={inputClassName} value={template.design.typography.bodySize} onChange={(event) => updateDesign("typography", "bodySize", Number(event.target.value))} /></label></div><div className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><span className="text-sm font-semibold text-slate-700">Full-width mobile CTA</span><Toggle disabled={readOnly} checked={Boolean(template.design.button.fullWidth)} onChange={(value) => updateDesign("button", "fullWidth", value)} label="Full width CTA" /></div></div> : null}

            {tab === "signature" ? <div className="grid gap-4"><h2 className="font-heading text-xl font-bold text-slate-950">Signature integration</h2><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Signature source<select disabled={readOnly} className={inputClassName} value={template.signature.source} onChange={(event) => updateSignature("source", event.target.value)}>{Object.entries(SIGNATURE_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-900">Include signature</p><p className="mt-1 text-xs text-slate-500">Data comes from the selected user's published My Signature profile.</p></div><Toggle disabled={readOnly} checked={template.signature.enabled !== false} onChange={(value) => updateSignature("enabled", value)} label="Include signature" /></div><div className="grid gap-2 sm:grid-cols-2">{Object.entries({ companyLogo: "Signature logo", signatureIcon: "Signature icon", advisorPhoto: "Advisor photograph", designation: "Designation", mobile: "Mobile number", whatsapp: "WhatsApp number", email: "Email", website: "Website", address: "Office address", brandPositioning: "Brand positioning", socialMedia: "Social media icons", footerTaglines: "Footer taglines" }).map(([field, label]) => <div key={field} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><span className="text-xs font-semibold text-slate-700">{label}</span><Toggle disabled={readOnly} checked={template.signature.visibility[field] !== false} onChange={(value) => updateSignatureVisibility(field, value)} label={label} /></div>)}</div><h3 className="pt-2 font-heading text-lg font-bold text-slate-950">Delivery defaults</h3>{[["includeSecureLink", "Include secure report link"], ["attachPdf", "Attach generated PDF"]].map(([field, label]) => <div key={field} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><span className="text-sm font-semibold text-slate-700">{label}</span><Toggle disabled={readOnly} checked={template.delivery[field] !== false} onChange={(value) => updateDelivery(field, value)} label={label} /></div>)}</div> : null}

            {tab === "preview" ? <div className="grid gap-4"><div className="flex items-center justify-between"><div><h2 className="font-heading text-xl font-bold text-slate-950">Responsive email preview</h2><p className="mt-1 text-sm text-slate-500">Draft configuration and published branding are combined for preview.</p></div><Eye size={22} className="text-blue-700" /></div><div className="inline-flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1"><button type="button" onClick={() => setPreviewMode("desktop")} className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold ${previewMode === "desktop" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><Monitor size={14} /> Desktop</button><button type="button" onClick={() => setPreviewMode("mobile")} className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold ${previewMode === "mobile" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><Smartphone size={14} /> Mobile</button></div><div className="overflow-auto rounded-xl bg-slate-100 p-5"><EmailTemplatePreview template={template} mode={previewMode} /></div></div> : null}
            {tab === "versions" ? <div className="grid gap-4">
              <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Clock3 size={20} /></span><div><h2 className="font-heading text-xl font-bold text-slate-950">Email template version history</h2><p className="mt-1 text-sm leading-6 text-slate-500">Each activation preserves the exact content, colours, signature visibility and delivery defaults used for historical report emails.</p></div></div>
              <div className="grid gap-3">{versions.length ? versions.map((version) => <article key={version.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">v{version.version}</span><div><h3 className="font-semibold text-slate-950">{version.name || template.name}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Activated by {version.createdByName || "GrowVest"}</p></div></div><span className="text-xs font-semibold text-slate-500">{formatVersionDate(version.createdAt)}</span></div><p className="mt-3 text-sm text-slate-600">Header {version.design?.header?.backgroundColor || "#1F4ED8"} · divider {version.design?.header?.dividerColor || "#20B8CD"} · {SIGNATURE_SOURCE_LABELS[version.signature?.source] || "Assigned Advisor"}</p></article>) : <article className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5"><h3 className="font-semibold text-slate-950">No activated custom versions yet</h3><p className="mt-2 text-sm leading-6 text-slate-500">Save a draft and activate it to create a permanent version snapshot. GrowVest standard templates remain protected as built-in version 1.</p></article>}</div>
            </div> : null}
          </section>

          <aside className="sticky top-28 hidden rounded-xl border border-slate-200 bg-slate-100 p-4 xl:block"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Live preview</p><div className="inline-flex rounded-lg border border-slate-200 bg-white p-1"><button type="button" onClick={() => setPreviewMode("desktop")} className={`grid h-8 w-8 place-items-center rounded ${previewMode === "desktop" ? "bg-blue-700 text-white" : "text-slate-500"}`}><Monitor size={14} /></button><button type="button" onClick={() => setPreviewMode("mobile")} className={`grid h-8 w-8 place-items-center rounded ${previewMode === "mobile" ? "bg-blue-700 text-white" : "text-slate-500"}`}><Smartphone size={14} /></button></div></div><div className="max-h-[720px] overflow-auto"><EmailTemplatePreview template={template} mode={previewMode} /></div></aside>
        </div>
      </div>
    </div>
  );
}
