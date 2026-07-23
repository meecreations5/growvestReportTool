"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, LayoutTemplate, Loader2, Mail, Plus, Search, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_ROLES } from "@/lib/constants/roles";
import { EMAIL_TEMPLATE_STATUS, EMAIL_TEMPLATE_TYPE_LABELS } from "@/lib/constants/emailTemplates";
import {
  duplicateEmailTemplate,
  initialiseSystemEmailTemplates,
  setDefaultEmailTemplate,
  subscribeEmailTemplates
} from "@/services/emailTemplateService";
import EmailTemplatePreview from "@/components/email-templates/EmailTemplatePreview";
import Button from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";

function statusClass(status) {
  if (status === EMAIL_TEMPLATE_STATUS.ACTIVE) return "bg-emerald-50 text-emerald-700";
  if (status === EMAIL_TEMPLATE_STATUS.DRAFT) return "bg-amber-50 text-amber-700";
  if (status === EMAIL_TEMPLATE_STATUS.ARCHIVED) return "bg-slate-100 text-slate-500";
  return "bg-blue-50 text-blue-700";
}

export default function EmailTemplateLibrary() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const isAdmin = ADMIN_ROLES.includes(profile?.role);

  useEffect(() => subscribeEmailTemplates(setTemplates, (nextError) => {
    console.error(nextError);
    setError("Unable to load email templates from Firestore. Built-in templates remain available.");
  }), []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((item) => {
      if (!isAdmin && item.status !== EMAIL_TEMPLATE_STATUS.ACTIVE) return false;
      if (status !== "all" && item.status !== status) return false;
      if (!term) return true;
      return [item.name, item.description, EMAIL_TEMPLATE_TYPE_LABELS[item.type]].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [isAdmin, search, status, templates]);

  async function initialise() {
    setBusy("initialise");
    setError("");
    try {
      const writes = await initialiseSystemEmailTemplates(profile);
      setNotice(writes ? "GrowVest email templates were initialised." : "Email templates are already initialised.");
    } catch (nextError) {
      setError(nextError.message || "Unable to initialise email templates.");
    } finally {
      setBusy("");
    }
  }

  async function duplicate(template) {
    setBusy(`duplicate-${template.id}`);
    setError("");
    try {
      const id = await duplicateEmailTemplate(template, profile, { name: `${template.name} — Custom` });
      window.location.href = `/email-delivery/templates/${id}/edit`;
    } catch (nextError) {
      setError(nextError.message || "Unable to duplicate the email template.");
      setBusy("");
    }
  }

  async function makeDefault(template) {
    setBusy(`default-${template.id}`);
    setError("");
    try {
      await setDefaultEmailTemplate(template.id, profile);
      setNotice(`${template.name} is now the default report email template.`);
    } catch (nextError) {
      setError(nextError.message || "Unable to update the default template.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-6 pb-24 lg:pb-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="gv-eyebrow">Email design system</p>
          <h1 className="gv-page-title mt-2">Email Template Customisation</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Create responsive email layouts, configure header and divider colours, control Advisor signature visibility, and assign a published email template to each report template.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/email-delivery" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">Delivery Centre</Link>
          {isAdmin ? <Button type="button" variant="secondary" onClick={initialise} disabled={busy === "initialise"}>{busy === "initialise" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Initialise defaults</Button> : null}
        </div>
      </header>

      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(240px,1fr)_200px]">
        <label className="relative"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email templates" /></label>
        <select className={inputClassName} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {visible.map((template) => (
          <article key={template.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
            <div className="border-b border-slate-200 bg-slate-50 p-4">
              <EmailTemplatePreview template={template} mode="mobile" />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass(template.status)}`}>{template.status}</span>{template.isDefault ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Default</span> : null}{template.isSystemTemplate ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">GrowVest standard</span> : null}</div>
                  <h2 className="mt-3 font-heading text-xl font-bold text-slate-950">{template.name}</h2>
                  <p className="mt-1 text-xs font-semibold text-blue-700">{EMAIL_TEMPLATE_TYPE_LABELS[template.type] || "Email template"} · v{template.version || 1}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{template.description}</p>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Mail size={20} /></span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/email-delivery/templates/${template.id}/edit`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#1F4ED8] px-4 text-sm font-semibold text-white"><LayoutTemplate size={15} /> {template.isSystemTemplate ? "Preview" : "Edit template"}</Link>
                {isAdmin ? <button type="button" onClick={() => duplicate(template)} disabled={busy === `duplicate-${template.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">{busy === `duplicate-${template.id}` ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />} Duplicate</button> : null}
                {isAdmin && template.status === "active" && !template.isDefault ? <button type="button" onClick={() => makeDefault(template)} disabled={busy === `default-${template.id}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 px-4 text-sm font-semibold text-blue-700 disabled:opacity-60">{busy === `default-${template.id}` ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Set default</button> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
