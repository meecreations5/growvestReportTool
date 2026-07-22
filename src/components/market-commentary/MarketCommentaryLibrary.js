"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  BookOpenText,
  CheckCircle2,
  Copy,
  FilePenLine,
  LibraryBig,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import MetricCard from "@/components/ui/MetricCard";
import { inputClassName } from "@/components/ui/Field";
import { isAdminRole } from "@/lib/constants/roles";
import { getMonthLabel } from "@/lib/constants/report";
import {
  COMMENTARY_CATEGORY_OPTIONS,
  COMMENTARY_SCOPE,
  COMMENTARY_STATUS,
  COMMENTARY_STATUS_LABELS,
  getCommentaryCategoryLabel
} from "@/lib/constants/marketCommentary";
import {
  archiveMarketCommentary,
  duplicateMarketCommentary,
  restoreMarketCommentary,
  seedDefaultCommentaryExamples,
  subscribeMarketCommentaries
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

function CommentaryStatusBadge({ status }) {
  const styles = {
    [COMMENTARY_STATUS.APPROVED]: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    [COMMENTARY_STATUS.DRAFT]: "bg-blue-50 text-blue-700 ring-blue-200",
    [COMMENTARY_STATUS.ARCHIVED]: "bg-slate-100 text-slate-600 ring-slate-200"
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${styles[status] || styles[COMMENTARY_STATUS.DRAFT]}`}>
      {COMMENTARY_STATUS_LABELS[status] || status}
    </span>
  );
}

function periodLabel(item) {
  if (item.scope === COMMENTARY_SCOPE.REUSABLE) return "Reusable library";
  return `${getMonthLabel(item.reportMonth)} ${item.reportYear}`;
}

function CommentaryActions({ item, canManage, busyId, onDuplicate, onArchive, onRestore }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        aria-label={`Actions for ${item.title}`}
      >
        {busyId === item.id ? <Loader2 size={17} className="animate-spin" /> : <MoreHorizontal size={18} />}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <Link href={`/market-commentary/${item.id}/edit`} className="flex min-h-10 items-center gap-2 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
            <FilePenLine size={16} /> Open commentary
          </Link>
          <button type="button" onClick={() => { setOpen(false); onDuplicate(item); }} className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Copy size={16} /> Duplicate
          </button>
          {canManage && item.status !== COMMENTARY_STATUS.ARCHIVED ? (
            <button type="button" onClick={() => { setOpen(false); onArchive(item.id); }} className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50">
              <Archive size={16} /> Archive
            </button>
          ) : null}
          {canManage && item.status === COMMENTARY_STATUS.ARCHIVED ? (
            <button type="button" onClick={() => { setOpen(false); onRestore(item.id); }} className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50">
              <RefreshCcw size={16} /> Restore as draft
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function MarketCommentaryLibrary() {
  const router = useRouter();
  const { profile } = useAuth();
  const canApprove = isAdminRole(profile?.role);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [scope, setScope] = useState("all");
  const [monthKey, setMonthKey] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!profile?.id) return undefined;
    setLoading(true);
    return subscribeMarketCommentaries(
      profile,
      (rows) => {
        setItems(rows);
        setLoading(false);
      },
      (nextError) => {
        console.error(nextError);
        setError("Unable to load the Market Commentary Library. Deploy the updated Firestore rules and try again.");
        setLoading(false);
      }
    );
  }, [profile]);

  const monthOptions = useMemo(() => {
    const values = [...new Set(items.filter((item) => item.scope === COMMENTARY_SCOPE.MONTHLY && item.reportMonthKey).map((item) => item.reportMonthKey))];
    return values.sort((a, b) => b.localeCompare(a));
  }, [items]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (category !== "all" && item.category !== category) return false;
      if (scope !== "all" && item.scope !== scope) return false;
      if (scope !== COMMENTARY_SCOPE.REUSABLE && monthKey !== "all" && item.reportMonthKey !== monthKey) return false;
      if (!term) return true;
      return [item.title, item.summary, item.content, item.category, item.createdByName, ...(item.tags || [])]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [category, items, monthKey, scope, search, status]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const metrics = useMemo(() => ({
    approved: items.filter((item) => item.status === COMMENTARY_STATUS.APPROVED && (item.reportMonthKey === currentMonthKey || item.scope === COMMENTARY_SCOPE.REUSABLE)).length,
    drafts: items.filter((item) => item.status === COMMENTARY_STATUS.DRAFT).length,
    reusable: items.filter((item) => item.scope === COMMENTARY_SCOPE.REUSABLE && item.status !== COMMENTARY_STATUS.ARCHIVED).length,
    archived: items.filter((item) => item.status === COMMENTARY_STATUS.ARCHIVED).length
  }), [currentMonthKey, items]);

  async function runAction(itemId, action, successMessage) {
    setBusyId(itemId);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to update the commentary record.");
    } finally {
      setBusyId("");
    }
  }

  async function handleDuplicate(item) {
    setBusyId(item.id);
    setError("");
    try {
      const newId = await duplicateMarketCommentary(item, profile);
      router.push(`/market-commentary/${newId}/edit`);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to duplicate the commentary.");
      setBusyId("");
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setError("");
    try {
      const count = await seedDefaultCommentaryExamples(profile);
      setNotice(count ? `${count} approved GrowVest commentary examples were added.` : "The commentary library already contains records.");
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Unable to add the example commentary records.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="grid gap-6 pb-24 lg:pb-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="gv-eyebrow">Report content</p>
          <h1 className="gv-page-title mt-2">Market Commentary Library</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Prepare approved market summaries, risk notes, strategy observations, outlooks and reusable Advisor language for monthly Investor reports.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canApprove && !items.length && !loading ? (
            <Button type="button" variant="secondary" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />} Add examples
            </Button>
          ) : null}
          <Button type="button" onClick={() => router.push("/market-commentary/create")}>
            <Plus size={17} /> New Commentary
          </Button>
        </div>
      </header>

      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Approved Content" value={metrics.approved} helper="Current month and reusable" icon={CheckCircle2} tone="green" />
        <MetricCard label="Drafts" value={metrics.drafts} helper="Awaiting review or approval" icon={FilePenLine} tone="blue" />
        <MetricCard label="Reusable Notes" value={metrics.reusable} helper="Available across report months" icon={LibraryBig} tone="cyan" />
        <MetricCard label="Archived" value={metrics.archived} helper="Retained for audit history" icon={Archive} tone="slate" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="grid gap-4 border-b border-slate-200 p-4 sm:p-5 xl:grid-cols-[minmax(260px,1fr)_repeat(4,minmax(150px,190px))]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input className={`${inputClassName} min-h-11 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, content or tag" />
          </label>
          <select className={`${inputClassName} min-h-11`} value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {COMMENTARY_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className={`${inputClassName} min-h-11`} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value={COMMENTARY_STATUS.APPROVED}>Approved</option>
            <option value={COMMENTARY_STATUS.DRAFT}>Draft</option>
            <option value={COMMENTARY_STATUS.ARCHIVED}>Archived</option>
          </select>
          <select className={`${inputClassName} min-h-11`} value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="all">All scopes</option>
            <option value={COMMENTARY_SCOPE.MONTHLY}>Reporting month</option>
            <option value={COMMENTARY_SCOPE.REUSABLE}>Reusable library</option>
          </select>
          <select className={`${inputClassName} min-h-11`} value={monthKey} onChange={(event) => setMonthKey(event.target.value)} disabled={scope === COMMENTARY_SCOPE.REUSABLE}>
            <option value="all">All reporting months</option>
            {monthOptions.map((value) => {
              const [year, month] = value.split("-");
              return <option key={value} value={value}>{getMonthLabel(Number(month))} {year}</option>;
            })}
          </select>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500">
            <div><Loader2 size={28} className="mx-auto mb-3 animate-spin text-blue-700" />Loading commentary library…</div>
          </div>
        ) : !visibleItems.length ? (
          <div className="p-6">
            <EmptyState
              icon={BookOpenText}
              title={items.length ? "No commentary matches the selected filters" : "No market commentary yet"}
              description={items.length ? "Clear the search or adjust the category, status and reporting-month filters." : "Create the first monthly market summary or add the approved GrowVest examples."}
              action={!items.length ? <Button type="button" onClick={() => router.push("/market-commentary/create")}><Plus size={17} /> Create Commentary</Button> : null}
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Commentary</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Period / Scope</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleItems.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-slate-50/70">
                      <td className="max-w-xl px-5 py-4">
                        <Link href={`/market-commentary/${item.id}/edit`} className="font-bold text-slate-950 hover:text-blue-700">{item.title}</Link>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary || item.content}</p>
                        {item.tags?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{item.tags.slice(0, 4).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{tag}</span>)}</div> : null}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-700">{getCommentaryCategoryLabel(item.category)}</td>
                      <td className="px-4 py-4 text-slate-600">{periodLabel(item)}</td>
                      <td className="px-4 py-4"><CommentaryStatusBadge status={item.status} /></td>
                      <td className="px-4 py-4 font-semibold text-slate-700">v{item.version || 1}<span className="block text-[10px] font-medium text-slate-400">Revision {item.revision || 1}</span></td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatDateTime(item.updatedAt)}<span className="mt-1 block">{item.updatedByName || item.createdByName || "GrowVest"}</span></td>
                      <td className="px-5 py-4 text-right">
                        <CommentaryActions item={item} canManage={canApprove || item.createdByUid === profile?.id} busyId={busyId} onDuplicate={handleDuplicate} onArchive={(id) => runAction(id, () => archiveMarketCommentary(id, profile), "Commentary archived.")} onRestore={(id) => runAction(id, () => restoreMarketCommentary(id, profile), "Commentary restored as a draft.")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {visibleItems.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">{getCommentaryCategoryLabel(item.category)}</p>
                      <Link href={`/market-commentary/${item.id}/edit`} className="mt-1 block font-heading text-lg font-bold leading-tight text-slate-950">{item.title}</Link>
                    </div>
                    <CommentaryActions item={item} canManage={canApprove || item.createdByUid === profile?.id} busyId={busyId} onDuplicate={handleDuplicate} onArchive={(id) => runAction(id, () => archiveMarketCommentary(id, profile), "Commentary archived.")} onRestore={(id) => runAction(id, () => restoreMarketCommentary(id, profile), "Commentary restored as a draft.")} />
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">{item.summary || item.content}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
                    <div><span className="block text-slate-400">Period</span><span className="mt-1 block font-semibold text-slate-700">{periodLabel(item)}</span></div>
                    <div><span className="block text-slate-400">Version</span><span className="mt-1 block font-semibold text-slate-700">v{item.version || 1} · r{item.revision || 1}</span></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <CommentaryStatusBadge status={item.status} />
                    <Link href={`/market-commentary/${item.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">Open</Link>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <Button type="button" className="w-full" onClick={() => router.push("/market-commentary/create")}><Plus size={17} /> New Commentary</Button>
      </div>
    </div>
  );
}
