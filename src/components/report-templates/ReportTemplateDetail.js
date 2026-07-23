"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  PencilLine,
  FileText,
  Laptop,
  Mail,
  Monitor,
  Smartphone,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_ROLES, USER_ROLES } from "@/lib/constants/roles";
import {
  REPORT_TEMPLATE_SECTIONS,
  templateCategoryLabel,
  visibleTemplateSections
} from "@/lib/constants/reportTemplates";
import { SIGNATURE_SOURCE_LABELS } from "@/lib/constants/emailTemplates";
import {
  duplicateReportTemplate,
  getReportTemplateVersions,
  setDefaultReportTemplate,
  subscribeReportTemplates
} from "@/services/reportTemplateService";
import { subscribeMonthlyReports } from "@/services/reportService";
import TemplateThumbnail from "@/components/report-templates/TemplateThumbnail";
import TemplateStatusBadge from "@/components/report-templates/TemplateStatusBadge";
import SegmentedTabs from "@/components/ui/SegmentedTabs";

function formatDate(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Built-in configuration";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function PreviewFrame({ template, mode }) {
  const widths = {
    desktop: "max-w-[780px]",
    mobile: "max-w-[320px]",
    pdf: "max-w-[470px]"
  };
  return (
    <div className="grid min-h-[520px] place-items-center overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4 sm:p-7">
      <div className={`w-full transition-all duration-200 ${widths[mode]}`}>
        <TemplateThumbnail template={template} />
      </div>
    </div>
  );
}

export default function ReportTemplateDetail({ templateId }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [template, setTemplate] = useState(null);
  const [reports, setReports] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("overview");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [busy, setBusy] = useState(false);

  const isAdmin = ADMIN_ROLES.includes(profile?.role);
  const isSuperAdmin = profile?.role === USER_ROLES.SUPER_ADMIN;

  useEffect(() => {
    if (!profile?.id) return undefined;
    const unsubscribeTemplates = subscribeReportTemplates(
      profile,
      (items, metadata = {}) => {
        const nextTemplate = items.find((item) => item.id === templateId) || null;
        if (nextTemplate) {
          setTemplate(nextTemplate);
          setLoading(false);
          return;
        }
        if (metadata.fromFirestore) {
          setTemplate(null);
          setLoading(false);
        }
      },
      (nextError) => {
        console.error(nextError);
        setError("Unable to load the saved template record. The built-in preview may still be available after Firestore rules are deployed.");
        setLoading(false);
      }
    );
    const unsubscribeReports = subscribeMonthlyReports(profile, setReports, () => setReports([]));
    return () => { unsubscribeTemplates(); unsubscribeReports(); };
  }, [profile, templateId]);

  useEffect(() => {
    if (!profile?.id || !templateId) return;
    getReportTemplateVersions(templateId)
      .then(setVersions)
      .catch((nextError) => {
        console.error("Unable to load template versions", nextError);
        setVersions([]);
      });
  }, [profile?.id, templateId, template?.version]);

  const templateReports = useMemo(() => reports.filter((report) => report.templateId === templateId), [reports, templateId]);
  const visibleSections = useMemo(() => template ? visibleTemplateSections(template) : [], [template]);

  async function handleDuplicate() {
    if (!template || !isAdmin) return;
    setBusy(true);
    setError("");
    try {
      const newId = await duplicateReportTemplate(template, profile);
      router.push(`/report-templates/${newId}/edit`);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to duplicate this template.");
      setBusy(false);
    }
  }

  async function handleSetDefault() {
    if (!template || !isSuperAdmin) return;
    setBusy(true);
    setError("");
    try {
      await setDefaultReportTemplate(template.id, profile);
      setNotice(`${template.name} is now the default report template.`);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to set the default report template.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-[520px] place-items-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">Loading report template…</div>;
  }

  if (!template) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div>
          <FileText size={30} className="mx-auto text-slate-400" />
          <h1 className="mt-4 font-heading text-2xl font-bold text-slate-950">Template not found</h1>
          <p className="mt-2 text-sm text-slate-500">This template may have been removed or the URL is incorrect.</p>
          <Link href="/report-templates" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white">Return to Template Library</Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "sections", label: "Sections", count: visibleSections.length },
    { value: "appearance", label: "Appearance" },
    { value: "delivery", label: "Email delivery" },
    { value: "usage", label: "Usage", count: templateReports.length },
    { value: "versions", label: "Version history" }
  ];

  return (
    <div className="grid gap-6">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <Link href="/report-templates" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-700"><ArrowLeft size={17} /> Back to Template Library</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TemplateStatusBadge status={template.status} isDefault={template.isDefault} />
            <span className="inline-flex min-h-6 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">{templateCategoryLabel(template.category)}</span>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-bold text-slate-950 sm:text-4xl">{template.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{template.description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {isAdmin ? <Link href={`/report-templates/${template.id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50"><PencilLine size={17} /> {template.isSystemTemplate ? "Customize" : "Edit template"}</Link> : null}
          {isAdmin ? <button type="button" onClick={handleDuplicate} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><Copy size={17} /> Duplicate</button> : null}
          {isSuperAdmin && !template.isDefault && template.status === "active" ? <button type="button" onClick={handleSetDefault} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white hover:bg-[#173EB4] disabled:opacity-60"><Crown size={17} /> Set as default</button> : null}
        </div>
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div> : null}

      <div className="overflow-x-auto pb-1"><SegmentedTabs items={tabs} value={tab} onChange={setTab} ariaLabel="Template details" /></div>

      {tab === "overview" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)] sm:p-5">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Live template preview</p>
                <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Responsive report presentation</h2>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                {[
                  { value: "desktop", label: "Desktop", icon: Monitor },
                  { value: "mobile", label: "Mobile", icon: Smartphone },
                  { value: "pdf", label: "A4 PDF", icon: FileText }
                ].map((item) => {
                  const Icon = item.icon;
                  const active = previewMode === item.value;
                  return <button key={item.value} type="button" onClick={() => setPreviewMode(item.value)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${active ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}><Icon size={14} /> <span className="hidden sm:inline">{item.label}</span></button>;
                })}
              </div>
            </div>
            <PreviewFrame template={template} mode={previewMode} />
          </section>

          <aside className="grid content-start gap-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Template summary</p>
              <dl className="mt-4 grid gap-4 text-sm">
                {[
                  ["Visible sections", visibleSections.length],
                  ["Estimated output", template.estimatedPages || "6–9 pages"],
                  ["HTML layout", "Responsive"],
                  ["PDF layout", "A4 portrait"],
                  ["Version", `v${template.version || 1}`],
                  ["Last updated", formatDate(template.updatedAt)]
                ].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold text-slate-900">{value}</dd></div>)}
              </dl>
            </section>
            <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
              <Sparkles size={20} className="text-blue-700" />
              <h2 className="mt-3 font-heading text-lg font-bold text-blue-950">Structured, not free-form</h2>
              <p className="mt-2 text-sm leading-6 text-blue-900">The template stores controlled section order, visibility, cover, chart and document settings while protecting GrowVest brand consistency.</p>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "sections" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Report structure</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Visible sections and output order</h2></div>
            <p className="text-sm text-slate-500">{visibleSections.length} of {REPORT_TEMPLATE_SECTIONS.length} sections visible</p>
          </div>
          <div className="mt-5 grid gap-3">
            {(template.sectionOrder || []).map((key, index) => {
              const section = REPORT_TEMPLATE_SECTIONS.find((item) => item.key === key);
              if (!section) return null;
              const visible = template.sectionVisibility?.[key] !== false;
              return (
                <article key={key} className={`grid gap-3 rounded-xl border p-4 sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-center ${visible ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-65"}`}>
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">{index + 1}</span>
                  <div><h3 className="font-heading text-lg font-bold text-slate-950">{section.label}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{section.description}</p></div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {section.mandatory ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Mandatory</span> : null}
                    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${visible ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{visible ? <Check size={13} /> : null}{visible ? "Visible" : "Hidden"}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "appearance" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Appearance configuration</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Current template settings</h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Cover style", template.appearance?.coverStyle || "Premium dark"],
                ["Cover pattern", template.appearance?.coverPattern || "None"],
                ["Chart style", template.appearance?.chartStyle || "Modern"],
                ["Table density", template.appearance?.tableDensity || "Comfortable"],
                ["Advisor card", template.appearance?.advisorCardVisible === false ? "Hidden" : "Visible"],
                ["Header / footer", `${template.appearance?.headerStyle || "Compact"} / ${template.appearance?.footerStyle || "Legal"}`]
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 capitalize font-semibold text-slate-900">{String(value).replaceAll("-", " ")}</dd></div>)}
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Brand colours</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">GrowVest colour application</h2>
            <div className="mt-5 grid gap-3">
              {[
                ["Primary", template.appearance?.primaryColor || "#1F4ED8", "bg-[#1F4ED8]"],
                ["Secondary", template.appearance?.secondaryColor || "#20B8CD", "bg-[#20B8CD]"],
                ["Dark surface", template.appearance?.darkColor || "#0B1220", "bg-[#0B1220]"]
              ].map(([label, value, tone]) => <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"><div className="flex items-center gap-3"><span className={`h-9 w-9 rounded-lg border border-black/5 ${tone}`} /><div><p className="text-xs text-slate-400">{label}</p><p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">{value}</p></div></div><span className="text-xs font-semibold text-slate-500">Brand controlled</span></div>)}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "delivery" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Mail size={20} /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Report-template assignment</p>
                <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Email delivery configuration</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Every report created with this template stores a versioned snapshot of the assigned email design and signature rules.</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["Assigned email template", template.delivery?.emailTemplateName || "Monthly Report Ready — Premium"],
                ["Email template version", `v${template.delivery?.emailTemplateVersion || 1}`],
                ["Signature source", SIGNATURE_SOURCE_LABELS[template.delivery?.signatureSource] || "Assigned Advisor's published signature"],
                ["Secure report link", template.delivery?.includeSecureLink === false ? "Excluded" : "Included"],
                ["PDF attachment", template.delivery?.attachPdf === false ? "Not attached" : "Attached by default"],
                ["Advisor signature", template.delivery?.includeSignature === false ? "Hidden" : "Included"]
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>)}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/email-delivery/templates/${template.delivery?.emailTemplateId || "monthly-report-ready-premium"}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1F4ED8] px-4 text-sm font-semibold text-white">Preview assigned email</Link>
              {isAdmin ? <Link href={`/report-templates/${template.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700">Change assignment</Link> : null}
            </div>
          </section>
          <aside className="rounded-xl border border-blue-100 bg-blue-50 p-5">
            <Sparkles size={20} className="text-blue-700" />
            <h3 className="mt-3 font-heading text-lg font-bold text-blue-950">Historical consistency</h3>
            <p className="mt-2 text-sm leading-6 text-blue-900">Published reports retain the email-template version, branding and signature configuration selected at report creation. Later template changes do not alter earlier deliveries.</p>
          </aside>
        </div>
      ) : null}

      {tab === "usage" ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Template usage</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Reports linked to this template</h2></div>
          {templateReports.length ? (
            <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Investor</th><th className="px-5 py-3">Report month</th><th className="px-5 py-3">Version</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{templateReports.map((report) => <tr key={report.id}><td className="px-5 py-4"><p className="font-semibold text-slate-900">{report.investorName}</p><p className="mt-1 text-xs text-slate-500">{report.clientCode}</p></td><td className="px-5 py-4">{report.reportMonthKey}</td><td className="px-5 py-4">v{report.templateVersion || report.version || 1}</td><td className="px-5 py-4 capitalize">{String(report.status || "draft").replaceAll("_", " ")}</td><td className="px-5 py-4 text-right"><Link href={`/reports/${report.id}`} className="font-semibold text-blue-700 hover:underline">Open report</Link></td></tr>)}</tbody></table></div>
          ) : (
            <div className="grid min-h-64 place-items-center p-8 text-center"><div><Laptop size={28} className="mx-auto text-slate-400" /><h3 className="mt-4 font-heading text-xl font-bold text-slate-950">No reports are linked yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Reports will appear here after this template is selected and saved during monthly report creation.</p></div></div>
          )}
        </section>
      ) : null}

      {tab === "versions" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Version history</p>
          <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Template configuration history</h2>
          <div className="mt-5 grid gap-3">
            {versions.length ? versions.map((version) => (
              <article key={version.id} className="flex items-start gap-4 rounded-xl border border-slate-200 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 font-bold text-blue-700">v{version.version}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-950">{version.name || template.name}</h3><span className="text-xs font-semibold text-slate-500">{formatDate(version.createdAt)}</span></div>
                  <p className="mt-1 text-sm text-slate-500">Activated by {version.createdByName || "GrowVest"} · {(version.sectionOrder || []).filter((key) => version.sectionVisibility?.[key] !== false).length} visible sections</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{version.description || "Activated report-template configuration."}</p>
                </div>
              </article>
            )) : (
              <article className="flex items-start gap-4 rounded-xl border border-slate-200 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 font-bold text-blue-700">v{template.version || 1}</span>
                <div><h3 className="font-semibold text-slate-950">Current template version</h3><p className="mt-1 text-sm text-slate-500">{template.isSystemTemplate ? "GrowVest standard configuration" : `Created from ${template.sourceTemplateId || "a GrowVest template"}`} · {formatDate(template.updatedAt || template.createdAt)}</p><p className="mt-2 text-sm leading-6 text-slate-600">Activate changes from the structured editor to create a preserved version snapshot.</p></div>
              </article>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
