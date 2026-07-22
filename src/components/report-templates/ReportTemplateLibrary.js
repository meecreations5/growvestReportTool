"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  Copy,
  Crown,
  Files,
  Filter,
  LayoutTemplate,
  Search,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_ROLES, USER_ROLES } from "@/lib/constants/roles";
import { TEMPLATE_CATEGORY_LABELS, TEMPLATE_STATUS } from "@/lib/constants/reportTemplates";
import {
  archiveReportTemplate,
  duplicateReportTemplate,
  initialiseSystemReportTemplates,
  restoreReportTemplate,
  setDefaultReportTemplate,
  subscribeReportTemplates
} from "@/services/reportTemplateService";
import { subscribeMonthlyReports } from "@/services/reportService";
import MetricCard from "@/components/ui/MetricCard";
import TemplateCard from "@/components/report-templates/TemplateCard";
import TemplateCreateDialog from "@/components/report-templates/TemplateCreateDialog";

const inputClassName = "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

function ConfirmDialog({ state, busy, onCancel, onConfirm }) {
  if (!state) return null;
  const isArchive = state.action === "archive";
  const isRestore = state.action === "restore";
  const title = isArchive ? "Archive template?" : isRestore ? "Restore template as draft?" : "Set default report template?";
  const description = isArchive
    ? `${state.template.name} will no longer be available for new reports. Existing published reports remain unchanged.`
    : isRestore
      ? `${state.template.name} will return as a draft template for further configuration.`
      : `${state.template.name} will become the default selection for future monthly reports.`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <button type="button" className="absolute inset-0" aria-label="Close confirmation" onClick={onCancel} />
      <section role="dialog" aria-modal="true" aria-labelledby="confirm-template-title" className="relative z-10 w-full rounded-t-2xl bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,.28)] sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${isArchive ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
          {isArchive ? <Archive size={20} /> : <Crown size={20} />}
        </div>
        <h2 id="confirm-template-title" className="mt-4 font-heading text-2xl font-bold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${isArchive ? "bg-red-600 hover:bg-red-700" : "bg-[#1F4ED8] hover:bg-[#173EB4]"}`}>
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
            {isArchive ? "Archive template" : isRestore ? "Restore template" : "Set as default"}
          </button>
        </div>
      </section>
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
          <div className="gv-skeleton h-[210px] rounded-xl" />
          <div className="p-2 pt-5">
            <div className="gv-skeleton h-5 w-28 rounded" />
            <div className="gv-skeleton mt-3 h-7 w-2/3 rounded" />
            <div className="gv-skeleton mt-3 h-10 rounded" />
            <div className="gv-skeleton mt-5 h-11 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReportTemplateLibrary() {
  const router = useRouter();
  const { profile } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("available");
  const [sort, setSort] = useState("default");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSource, setDialogSource] = useState(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const busyAction = "";
  const [confirmState, setConfirmState] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const isAdmin = ADMIN_ROLES.includes(profile?.role);
  const isSuperAdmin = profile?.role === USER_ROLES.SUPER_ADMIN;

  useEffect(() => {
    let unsubscribeTemplates = () => {};
    let unsubscribeReports = () => {};

    if (!profile?.id) return undefined;

    unsubscribeTemplates = subscribeReportTemplates(
      profile,
      (items) => {
        setTemplates(items);
        setLoading(false);
      },
      (nextError) => {
        console.error("Unable to sync report templates", nextError);
        setError("The built-in GrowVest templates are available, but Firestore template management is not yet accessible. Deploy the updated Firestore rules to enable saved custom templates.");
        setLoading(false);
      }
    );

    unsubscribeReports = subscribeMonthlyReports(
      profile,
      (items) => setReports(items),
      () => setReports([])
    );

    if (isAdmin) {
      initialiseSystemReportTemplates(profile).catch((nextError) => {
        console.error("Unable to initialise report templates", nextError);
      });
    }

    return () => {
      unsubscribeTemplates();
      unsubscribeReports();
    };
  }, [isAdmin, profile]);

  const usageCounts = useMemo(() => reports.reduce((result, report) => {
    if (!report.templateId) return result;
    result[report.templateId] = (result[report.templateId] || 0) + 1;
    return result;
  }, {}), [reports]);

  const summary = useMemo(() => ({
    active: templates.filter((item) => item.status === TEMPLATE_STATUS.ACTIVE).length,
    custom: templates.filter((item) => !item.isSystemTemplate && item.status !== TEMPLATE_STATUS.ARCHIVED).length,
    linkedReports: Object.values(usageCounts).reduce((sum, value) => sum + value, 0),
    defaultTemplate: templates.find((item) => item.isDefault)?.name || "Premium Blue"
  }), [templates, usageCounts]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = templates.filter((item) => {
      const matchesTerm = !term || [item.name, item.description, item.category, item.slug]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      const matchesCategory = category === "all" || item.category === category;
      const matchesStatus = status === "all"
        || (status === "available" ? item.status !== TEMPLATE_STATUS.ARCHIVED : false)
        || (status === "custom" ? !item.isSystemTemplate : item.status === status);
      return matchesTerm && matchesCategory && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return String(a.name).localeCompare(String(b.name));
      if (sort === "sections") return Object.values(b.sectionVisibility || {}).filter(Boolean).length - Object.values(a.sectionVisibility || {}).filter(Boolean).length;
      if (sort === "updated") {
        const value = (item) => typeof item.updatedAt?.toDate === "function" ? item.updatedAt.toDate().getTime() : 0;
        return value(b) - value(a);
      }
      if (Boolean(a.isDefault) !== Boolean(b.isDefault)) return a.isDefault ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [category, search, sort, status, templates]);

  function openCreate(source = null) {
    setDialogSource(source);
    setDialogOpen(true);
  }

  async function handleCreate({ baseTemplate, name, description }) {
    setDialogSubmitting(true);
    setError("");
    try {
      const templateId = await duplicateReportTemplate(baseTemplate, profile, { name, description });
      setDialogOpen(false);
      setDialogSource(null);
      setNotice(`${name} was created as a draft template.`);
      router.push(`/report-templates/${templateId}/edit`);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to create the custom report template.");
    } finally {
      setDialogSubmitting(false);
    }
  }

  async function handleQuickDuplicate(template) {
    openCreate(template);
  }

  function requestAction(action, template) {
    setConfirmState({ action, template });
  }

  async function confirmAction() {
    if (!confirmState) return;
    setConfirmBusy(true);
    setError("");
    try {
      if (confirmState.action === "default") {
        await setDefaultReportTemplate(confirmState.template.id, profile);
        setNotice(`${confirmState.template.name} is now the default report template.`);
      } else if (confirmState.action === "archive") {
        await archiveReportTemplate(confirmState.template.id, profile);
        setNotice(`${confirmState.template.name} was archived.`);
      } else if (confirmState.action === "restore") {
        await restoreReportTemplate(confirmState.template.id, profile);
        setNotice(`${confirmState.template.name} was restored as a draft.`);
      }
      setConfirmState(null);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to update the report template.");
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="gv-eyebrow">Report presentation</p>
          <h1 className="gv-page-title mt-2">Report Template Library</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Preview and manage the structured GrowVest templates that will control responsive HTML reports and their PDF output.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => router.push(`/report-templates/${templates.find((item) => item.isDefault)?.id || "premium-blue"}`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <Crown size={17} className="text-blue-600" /> Preview default
          </button>
          {isAdmin ? (
            <button type="button" onClick={() => openCreate()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white transition hover:bg-[#173EB4]">
              <Copy size={18} /> Create custom template
            </button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active templates" value={summary.active} helper="Available for report configuration" icon={LayoutTemplate} tone="blue" />
        <MetricCard label="Custom templates" value={summary.custom} helper="Draft and active custom formats" icon={Copy} tone="cyan" />
        <MetricCard label="Template-linked reports" value={summary.linkedReports} helper="Begins increasing after report integration" icon={Files} tone="green" />
        <MetricCard label="Default template" value={summary.defaultTemplate} helper="Suggested for future monthly reports" icon={Crown} tone="amber" />
      </div>

      {error ? (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-amber-100" aria-label="Dismiss message"><X size={16} /></button>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={17} /> {notice}</span>
          <button type="button" onClick={() => setNotice("")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-emerald-100" aria-label="Dismiss message"><X size={16} /></button>
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_160px_160px_170px] lg:items-center lg:p-5">
          <label className="relative block">
            <span className="sr-only">Search templates</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" className={`${inputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search template name, category or purpose" />
          </label>

          <button type="button" onClick={() => setFiltersOpen((value) => !value)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 lg:hidden">
            <Filter size={17} /> Filters
          </button>

          <div className={`${filtersOpen ? "grid" : "hidden"} gap-3 lg:contents`}>
            <select className={inputClassName} value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Template category">
              <option value="all">All categories</option>
              {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className={inputClassName} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Template status">
              <option value="available">Available</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="custom">Custom</option>
              <option value="archived">Archived</option>
              <option value="all">All statuses</option>
            </select>
            <select className={inputClassName} value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort templates">
              <option value="default">Default first</option>
              <option value="name">Name</option>
              <option value="sections">Most sections</option>
              <option value="updated">Recently updated</option>
            </select>
          </div>
        </div>

        <div className="p-4 sm:p-5 lg:p-6">
          {loading ? <LibrarySkeleton /> : filteredTemplates.length ? (
            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  usageCount={usageCounts[template.id] || 0}
                  canDuplicate={isAdmin && template.status !== TEMPLATE_STATUS.ARCHIVED}
                  canSetDefault={isSuperAdmin}
                  canArchive={isSuperAdmin}
                  onDuplicate={handleQuickDuplicate}
                  onSetDefault={(item) => requestAction("default", item)}
                  onArchive={(item) => requestAction("archive", item)}
                  onRestore={(item) => requestAction("restore", item)}
                  busyAction={busyAction}
                />
              ))}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><LayoutTemplate size={22} /></span>
                <h2 className="mt-4 font-heading text-xl font-bold text-slate-950">No templates match these filters</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Clear the search or filters. Administrators can also duplicate a standard GrowVest template to create a custom draft.</p>
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <button type="button" onClick={() => { setSearch(""); setCategory("all"); setStatus("available"); }} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear filters</button>
                  {isAdmin ? <button type="button" onClick={() => openCreate()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-5 text-sm font-semibold text-white hover:bg-[#173EB4]"><Copy size={17} /> Create custom template</button> : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>


      <TemplateCreateDialog open={dialogOpen} templates={templates} sourceTemplate={dialogSource} submitting={dialogSubmitting} onClose={() => { if (!dialogSubmitting) { setDialogOpen(false); setDialogSource(null); } }} onSubmit={handleCreate} />
      <ConfirmDialog state={confirmState} busy={confirmBusy} onCancel={() => { if (!confirmBusy) setConfirmState(null); }} onConfirm={confirmAction} />
    </div>
  );
}
