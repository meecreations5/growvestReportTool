"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileCheck2,
  History,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { ASSET_CLASS_OPTIONS, getMonthLabel, MONTH_OPTIONS } from "@/lib/constants/report";
import { isAdminRole } from "@/lib/constants/roles";
import {
  COMMENTARY_CATEGORY_OPTIONS,
  COMMENTARY_SCOPE,
  COMMENTARY_SCOPE_OPTIONS,
  COMMENTARY_STATUS,
  COMMENTARY_STATUS_LABELS,
  createEmptyMarketCommentary,
  getCommentaryCategoryLabel
} from "@/lib/constants/marketCommentary";
import {
  approveMarketCommentary,
  archiveMarketCommentary,
  duplicateMarketCommentary,
  getMarketCommentary,
  listMarketCommentaryVersions,
  restoreMarketCommentary,
  saveMarketCommentaryDraft
} from "@/services/marketCommentaryService";

function formatDateTime(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function StatusBadge({ status }) {
  const style = status === COMMENTARY_STATUS.APPROVED
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === COMMENTARY_STATUS.ARCHIVED
      ? "bg-slate-100 text-slate-600 ring-slate-200"
      : "bg-blue-50 text-blue-700 ring-blue-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${style}`}>{COMMENTARY_STATUS_LABELS[status] || status}</span>;
}

function TextPreview({ content }) {
  const paragraphs = String(content || "").split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  if (!paragraphs.length) return <p className="text-sm italic text-slate-400">The Investor-facing content preview will appear here.</p>;
  return (
    <div className="grid gap-4 text-sm leading-7 text-slate-700">
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 24)}-${index}`} className="whitespace-pre-line">{paragraph}</p>
      ))}
    </div>
  );
}

export default function MarketCommentaryEditor({ commentaryId = null }) {
  const router = useRouter();
  const { profile } = useAuth();
  const canApprove = isAdminRole(profile?.role);
  const [form, setForm] = useState(() => createEmptyMarketCommentary());
  const [loading, setLoading] = useState(Boolean(commentaryId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workingId, setWorkingId] = useState(commentaryId);
  const [versions, setVersions] = useState([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [saveState, setSaveState] = useState(commentaryId ? "saved" : "idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [confirmAction, setConfirmAction] = useState("");
  const signatureRef = useRef("");
  const readyRef = useRef(false);

  useEffect(() => {
    if (!commentaryId) {
      signatureRef.current = JSON.stringify(form);
      readyRef.current = true;
      return undefined;
    }

    let active = true;
    setLoading(true);
    Promise.all([getMarketCommentary(commentaryId), listMarketCommentaryVersions(commentaryId)])
      .then(([record, versionRows]) => {
        if (!active) return;
        if (!record) throw new Error("Commentary record not found.");
        setForm(record);
        setVersions(versionRows);
        signatureRef.current = JSON.stringify(record);
        readyRef.current = true;
      })
      .catch((nextError) => {
        console.error(nextError);
        if (active) setError(nextError.message || "Unable to load this commentary record.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [commentaryId]);

  const currentSignature = useMemo(() => JSON.stringify(form), [form]);
  const dirty = readyRef.current && currentSignature !== signatureRef.current;
  const isArchived = form.status === COMMENTARY_STATUS.ARCHIVED;
  const canEdit = !isArchived && (canApprove || !workingId || form.createdByUid === profile?.id);

  useEffect(() => {
    if (!dirty || !canEdit || saving || !form.title?.trim() || !form.content?.trim()) return undefined;
    setSaveState("pending");
    const timer = window.setTimeout(async () => {
      setSaving(true);
      setSaveState("saving");
      try {
        const id = await saveMarketCommentaryDraft(workingId, form, profile);
        setWorkingId(id);
        const updated = await getMarketCommentary(id) || {
          ...form,
          id,
          createdByUid: form.createdByUid || profile.id,
          createdByName: form.createdByName || profile.fullName || profile.email,
          status: form.status === COMMENTARY_STATUS.APPROVED ? COMMENTARY_STATUS.DRAFT : form.status
        };
        setForm(updated);
        signatureRef.current = JSON.stringify(updated);
        setLastSavedAt(new Date());
        setSaveState("saved");
        if (!workingId) router.replace(`/market-commentary/${id}/edit`);
      } catch (nextError) {
        console.error(nextError);
        setSaveState("error");
      } finally {
        setSaving(false);
      }
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [canEdit, dirty, form, profile, router, saving, workingId]);

  function setValue(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "scope" && value === COMMENTARY_SCOPE.REUSABLE) {
        next.reportMonth = null;
        next.reportYear = null;
        next.reportMonthKey = "reusable";
      }
      if ((field === "reportMonth" || field === "reportYear") && next.scope === COMMENTARY_SCOPE.MONTHLY) {
        next.reportMonthKey = `${Number(next.reportYear)}-${String(Number(next.reportMonth)).padStart(2, "0")}`;
      }
      return next;
    });
  }

  function toggleAssetClass(value) {
    setForm((current) => {
      const selected = new Set(current.applicableAssetClasses || []);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      return { ...current, applicableAssetClasses: [...selected] };
    });
  }

  async function refreshVersions(id = workingId) {
    if (!id) return;
    try {
      setVersions(await listMarketCommentaryVersions(id));
    } catch (nextError) {
      console.error(nextError);
    }
  }

  async function handleSave() {
    if (!canEdit || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    setSaveState("saving");
    try {
      const id = await saveMarketCommentaryDraft(workingId, form, profile);
      setWorkingId(id);
      const updated = await getMarketCommentary(id) || {
          ...form,
          id,
          createdByUid: form.createdByUid || profile.id,
          createdByName: form.createdByName || profile.fullName || profile.email,
          status: form.status === COMMENTARY_STATUS.APPROVED ? COMMENTARY_STATUS.DRAFT : form.status
        };
      setForm(updated);
      signatureRef.current = JSON.stringify(updated);
      setLastSavedAt(new Date());
      setSaveState("saved");
      setNotice("Commentary draft saved.");
      await refreshVersions(id);
      if (!workingId) router.replace(`/market-commentary/${id}/edit`);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to save the commentary draft.");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!workingId) {
      setError("Save the draft before approval.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (dirty) await saveMarketCommentaryDraft(workingId, form, profile);
      await approveMarketCommentary(workingId, profile);
      const updated = await getMarketCommentary(workingId);
      setForm(updated);
      signatureRef.current = JSON.stringify(updated);
      setNotice("Commentary approved and available in Create Report.");
      setSaveState("saved");
      setLastSavedAt(new Date());
      await refreshVersions();
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to approve the commentary.");
    } finally {
      setSaving(false);
      setConfirmAction("");
    }
  }

  async function handleDuplicate() {
    setSaving(true);
    setError("");
    try {
      const id = await duplicateMarketCommentary(form, profile);
      router.push(`/market-commentary/${id}/edit`);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to duplicate this commentary.");
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!workingId) return;
    setSaving(true);
    setError("");
    try {
      await archiveMarketCommentary(workingId, profile);
      const updated = { ...form, status: COMMENTARY_STATUS.ARCHIVED };
      setForm(updated);
      signatureRef.current = JSON.stringify(updated);
      setNotice("Commentary archived. It remains available in audit history.");
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to archive this commentary.");
    } finally {
      setSaving(false);
      setConfirmAction("");
    }
  }

  async function handleRestore() {
    if (!workingId) return;
    setSaving(true);
    setError("");
    try {
      await restoreMarketCommentary(workingId, profile);
      const updated = { ...form, status: COMMENTARY_STATUS.DRAFT };
      setForm(updated);
      signatureRef.current = JSON.stringify(updated);
      setNotice("Commentary restored as a draft.");
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to restore this commentary.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500"><div><Loader2 className="mx-auto mb-3 animate-spin text-blue-700" size={28} />Loading commentary…</div></div>;
  }

  return (
    <div className="grid gap-6 pb-28 lg:pb-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link href="/market-commentary" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-700"><ArrowLeft size={17} /> Back to Library</Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="gv-eyebrow">Market commentary</p>
            <StatusBadge status={form.status || COMMENTARY_STATUS.DRAFT} />
          </div>
          <h1 className="gv-page-title mt-2">{workingId ? form.title || "Edit Commentary" : "Create Market Commentary"}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Create clear, approved report language while keeping internal review notes separate from Investor-visible content.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {workingId ? <Button type="button" variant="secondary" onClick={handleDuplicate} disabled={saving}><Copy size={17} /> Duplicate</Button> : null}
          <Button type="button" variant="secondary" onClick={() => setVersionsOpen((current) => !current)} disabled={!workingId}><History size={17} /> Version History</Button>
          <Button type="button" onClick={handleSave} disabled={!canEdit || saving || !dirty}><Save size={17} /> Save Draft</Button>
          {canApprove && form.status !== COMMENTARY_STATUS.ARCHIVED ? <Button type="button" onClick={() => setConfirmAction("approve")} disabled={saving || !workingId}><ShieldCheck size={17} /> Approve</Button> : null}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
          {saveState === "saving" ? <Loader2 size={14} className="animate-spin text-blue-700" /> : saveState === "error" ? <AlertTriangle size={14} className="text-red-600" /> : <CheckCircle2 size={14} className="text-emerald-600" />}
          {saveState === "pending" ? "Autosave pending" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Autosave failed — use Save Draft" : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        {lastSavedAt ? <span>Last saved {lastSavedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span> : null}
        <span className="ml-auto">Version {form.version || 1} · Revision {form.revision || 1}</span>
      </div>

      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      {isArchived ? (
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold text-slate-900">This commentary is archived.</p><p className="mt-1 text-sm text-slate-500">Restore it as a draft before making further edits.</p></div>
          {canApprove ? <Button type="button" variant="secondary" onClick={handleRestore} disabled={saving}><RotateCcw size={17} /> Restore as Draft</Button> : null}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="grid gap-5">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Content setup</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Commentary identity and reporting context</h2>
            </div>
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <Field label="Commentary title" hint="Internal library title"><input className={inputClassName} value={form.title || ""} onChange={(event) => setValue("title", event.target.value)} disabled={!canEdit} placeholder="July 2026 monthly market perspective" /></Field>
              <Field label="Category"><select className={inputClassName} value={form.category || "monthly_summary"} onChange={(event) => setValue("category", event.target.value)} disabled={!canEdit}>{COMMENTARY_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              <Field label="Content scope"><select className={inputClassName} value={form.scope || COMMENTARY_SCOPE.MONTHLY} onChange={(event) => setValue("scope", event.target.value)} disabled={!canEdit}>{COMMENTARY_SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              {form.scope === COMMENTARY_SCOPE.MONTHLY ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Reporting month"><select className={inputClassName} value={form.reportMonth || new Date().getMonth() + 1} onChange={(event) => setValue("reportMonth", Number(event.target.value))} disabled={!canEdit}>{MONTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                  <Field label="Year"><input type="number" min="2020" max="2100" className={inputClassName} value={form.reportYear || new Date().getFullYear()} onChange={(event) => setValue("reportYear", Number(event.target.value))} disabled={!canEdit} /></Field>
                </div>
              ) : <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">Reusable content can be selected in any monthly report and adapted by the Advisor.</div>}
              <div className="md:col-span-2"><Field label="Short summary" hint="Used in the library list and selection dialog"><textarea rows="3" className={inputClassName} value={form.summary || ""} onChange={(event) => setValue("summary", event.target.value)} disabled={!canEdit} placeholder="Briefly explain when this content should be used." /></Field></div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Investor-visible content</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Commentary editor</h2><p className="mt-1 text-xs text-slate-500">Use clear paragraphs and concise language. Advisors can adapt approved content inside Create Report.</p></div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">{String(form.content || "").length} characters</span>
            </div>
            <div className="p-5">
              <Field label={getCommentaryCategoryLabel(form.category)} hint="Paragraph breaks are preserved in HTML and PDF output"><textarea rows="14" className={`${inputClassName} min-h-80 resize-y leading-7`} value={form.content || ""} onChange={(event) => setValue("content", event.target.value)} disabled={!canEdit} placeholder="Write the approved market perspective, risk note, strategy observation or Advisor language here." /></Field>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Do not include guarantees, unverified performance claims or Investor-specific personal information in reusable content.</div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Classification</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Tags and applicability</h2></div>
            <div className="grid gap-5 p-5">
              <Field label="Tags" hint="Comma-separated"><input className={inputClassName} value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags || ""} onChange={(event) => setValue("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} disabled={!canEdit} placeholder="monthly, equity, volatility, long-term" /></Field>
              <div>
                <p className="text-sm font-semibold text-slate-700">Applicable asset classes</p>
                <p className="mt-1 text-xs text-slate-500">Optional. Leave all unselected when the content is suitable for every portfolio.</p>
                <div className="mt-3 flex flex-wrap gap-2">{ASSET_CLASS_OPTIONS.map((assetClass) => {
                  const selected = (form.applicableAssetClasses || []).includes(assetClass);
                  return <button key={assetClass} type="button" onClick={() => toggleAssetClass(assetClass)} disabled={!canEdit} className={`min-h-10 rounded-full border px-3 text-xs font-semibold transition ${selected ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{assetClass}</button>;
                })}</div>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700" checked={form.investorVisible !== false} onChange={(event) => setValue("investorVisible", event.target.checked)} disabled={!canEdit} /><span><span className="block text-sm font-semibold text-slate-900">Investor-visible content</span><span className="mt-1 block text-xs leading-5 text-slate-500">When copied into a report, this content may appear in the Investor HTML report and PDF. Internal review notes remain separate.</span></span></label>
              <Field label="Internal review note" hint="Never copied into the Investor report"><textarea rows="4" className={inputClassName} value={form.internalNote || ""} onChange={(event) => setValue("internalNote", event.target.value)} disabled={!canEdit} placeholder="Document review context, source notes or approval instructions." /></Field>
            </div>
          </section>
        </main>

        <aside className="grid content-start gap-5 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Report preview</p><h2 className="mt-1 font-heading text-lg font-bold text-slate-950">Investor-facing output</h2></div><button type="button" onClick={() => setPreviewOpen((current) => !current)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500"><Eye size={17} /></button></div>
            {previewOpen ? <div className="p-5"><div className="rounded-xl bg-[#0B1220] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">{form.scope === COMMENTARY_SCOPE.MONTHLY ? `${getMonthLabel(form.reportMonth)} ${form.reportYear}` : "Reusable Advisor Library"}</p><h3 className="mt-2 font-heading text-xl font-bold !text-white">{form.title || "Commentary title"}</h3><p className="mt-2 text-xs leading-5 text-white/60">{getCommentaryCategoryLabel(form.category)}</p></div><div className="mt-4"><TextPreview content={form.content} /></div></div> : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><FileCheck2 size={18} className="text-blue-700" /><h2 className="font-heading text-lg font-bold text-slate-950">Approval readiness</h2></div>
            <div className="mt-4 grid gap-3 text-sm">
              {[
                [Boolean(form.title?.trim()), "Title added"],
                [Boolean(form.content?.trim()), "Commentary content added"],
                [form.scope === COMMENTARY_SCOPE.REUSABLE || Boolean(form.reportMonth && form.reportYear), "Reporting scope complete"],
                [Boolean(form.summary?.trim()), "Library summary added"]
              ].map(([complete, label]) => <div key={label} className="flex items-center gap-2"><span className={`grid h-5 w-5 place-items-center rounded-full ${complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{complete ? <CheckCircle2 size={13} /> : <Clock3 size={12} />}</span><span className={complete ? "text-slate-700" : "text-slate-400"}>{label}</span></div>)}
            </div>
            {canApprove && form.status !== COMMENTARY_STATUS.ARCHIVED ? <Button type="button" className="mt-5 w-full" onClick={() => setConfirmAction("approve")} disabled={!workingId || saving}><ShieldCheck size={17} /> Approve Commentary</Button> : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><History size={18} className="text-blue-700" /><h2 className="font-heading text-lg font-bold text-slate-950">Audit details</h2></div>
            <dl className="mt-4 grid gap-3 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Created by</dt><dd className="text-right font-semibold text-slate-700">{form.createdByName || profile?.fullName || "Current user"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Updated</dt><dd className="text-right font-semibold text-slate-700">{formatDateTime(form.updatedAt) || "Not saved"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Approved by</dt><dd className="text-right font-semibold text-slate-700">{form.approvedByName || "Not approved"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Version</dt><dd className="font-semibold text-slate-700">v{form.version || 1} · r{form.revision || 1}</dd></div>
            </dl>
            {workingId && canApprove ? form.status === COMMENTARY_STATUS.ARCHIVED ? <Button type="button" variant="secondary" className="mt-5 w-full" onClick={handleRestore}><RotateCcw size={17} /> Restore</Button> : <Button type="button" variant="danger" className="mt-5 w-full" onClick={() => setConfirmAction("archive")}><Archive size={17} /> Archive</Button> : null}
          </section>
        </aside>
      </div>

      {versionsOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Commentary version history">
          <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Audit history</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Commentary Versions</h2></div><button type="button" onClick={() => setVersionsOpen(false)} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">Close</button></div>
            <div className="flex-1 overflow-y-auto p-5">{versions.length ? <div className="grid gap-3">{versions.map((version) => <article key={version.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{version.snapshotType === "approved" ? `Approved version ${version.version || 1}` : `Revision ${version.revision || 1}`}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(version.savedAt)} · {version.savedByName || "GrowVest"}</p></div><StatusBadge status={version.status || COMMENTARY_STATUS.DRAFT} /></div><p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{version.content}</p></article>)}</div> : <p className="text-sm text-slate-500">No saved versions are available yet.</p>}</div>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${confirmAction === "approve" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{confirmAction === "approve" ? <ShieldCheck size={19} /> : <Archive size={19} />}</span><div><h2 className="font-heading text-xl font-bold text-slate-950">{confirmAction === "approve" ? "Approve commentary?" : "Archive commentary?"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{confirmAction === "approve" ? "The approved content becomes available inside Create Report. Advisors can still adapt the copied text before completing an Investor report." : "Archived content is removed from normal selection but retained in version and audit history."}</p></div></div>
            <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setConfirmAction("")} disabled={saving}>Cancel</Button><Button type="button" variant={confirmAction === "approve" ? "primary" : "danger"} onClick={confirmAction === "approve" ? handleApprove : handleArchive} disabled={saving}>{saving ? <Loader2 size={17} className="animate-spin" /> : confirmAction === "approve" ? <ShieldCheck size={17} /> : <Archive size={17} />}{confirmAction === "approve" ? "Approve" : "Archive"}</Button></div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => router.push("/market-commentary")}><ArrowLeft size={17} /> Library</Button><Button type="button" className="flex-1" onClick={handleSave} disabled={!canEdit || saving || !dirty}><Save size={17} /> Save Draft</Button></div>
      </div>
    </div>
  );
}
