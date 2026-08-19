"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenText,
  CheckCircle2,
  LibraryBig,
  Loader2,
  Search,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import {
  COMMENTARY_CATEGORY_OPTIONS,
  COMMENTARY_SCOPE,
  COMMENTARY_STATUS,
  COMMENTARY_TARGET_OPTIONS,
  defaultCommentaryTarget,
  getCommentaryCategoryLabel
} from "@/lib/constants/marketCommentary";
import { getMonthLabel } from "@/lib/constants/report";
import { subscribeMarketCommentaries } from "@/services/marketCommentaryService";

export default function CommentaryLibraryPicker({ reportMonth, reportYear, onApply }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [target, setTarget] = useState("narrative");
  const [replaceExisting, setReplaceExisting] = useState(false);

  useEffect(() => {
    if (!open || !profile?.id) return undefined;
    setLoading(true);
    return subscribeMarketCommentaries(
      profile,
      (rows) => {
        setItems(rows.filter((item) => item.status === COMMENTARY_STATUS.APPROVED));
        setLoading(false);
      },
      (nextError) => {
        console.error(nextError);
        setError("Unable to load approved commentary.");
        setLoading(false);
      }
    );
  }, [open, profile]);

  const reportMonthKey = `${Number(reportYear)}-${String(Number(reportMonth)).padStart(2, "0")}`;
  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const periodMatch = item.scope === COMMENTARY_SCOPE.REUSABLE || item.reportMonthKey === reportMonthKey;
      if (!periodMatch) return false;
      if (category !== "all" && item.category !== category) return false;
      if (!term) return true;
      return [item.title, item.summary, item.content, ...(item.tags || [])]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [category, items, reportMonthKey, search]);

  const selected = items.find((item) => item.id === selectedId) || null;

  function selectItem(item) {
    setSelectedId(item.id);
    setTarget(defaultCommentaryTarget(item.category));
  }

  function applySelected() {
    if (!selected) return;
    onApply?.({ commentary: selected, target, replaceExisting });
    setOpen(false);
    setSelectedId("");
    setReplaceExisting(false);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <LibraryBig size={16} /> Use Commentary Library
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[70] bg-slate-950/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Select approved monthly market note">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white sm:h-[calc(100vh-2rem)] sm:rounded-2xl sm:shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Approved content</p>
                <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Monthly Market Note Library</h2>
                <p className="mt-1 text-sm text-slate-500">Select reusable content or approved commentary for {getMonthLabel(reportMonth)} {reportYear}.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close commentary library"><X size={19} /></button>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
                <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-5">
                  <label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClassName} min-h-11 pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search approved commentary" /></label>
                  <select className={`${inputClassName} min-h-11`} value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{COMMENTARY_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                  {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
                  {loading ? <div className="grid min-h-56 place-items-center text-sm text-slate-500"><div><Loader2 size={26} className="mx-auto mb-3 animate-spin text-blue-700" />Loading approved commentary…</div></div> : !visibleItems.length ? <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><div><BookOpenText size={30} className="mx-auto text-slate-400" /><p className="mt-3 font-semibold text-slate-800">No approved commentary found</p><p className="mt-1 text-sm text-slate-500">Create or approve content in the Monthly Market Note Library.</p><Link href="/market-commentary" target="_blank" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-blue-700">Open Library</Link></div></div> : <div className="grid gap-3">{visibleItems.map((item) => {
                    const isSelected = selectedId === item.id;
                    return <button key={item.id} type="button" onClick={() => selectItem(item)} className={`rounded-xl border p-4 text-left transition ${isSelected ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">{getCommentaryCategoryLabel(item.category)}</p><h3 className="mt-1 font-heading text-lg font-bold text-slate-950">{item.title}</h3></div>{isSelected ? <CheckCircle2 size={20} className="shrink-0 text-blue-700" /> : null}</div><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{item.summary || item.content}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-500"><span className="rounded-full bg-slate-100 px-2 py-1">{item.scope === COMMENTARY_SCOPE.REUSABLE ? "Reusable" : `${getMonthLabel(item.reportMonth)} ${item.reportYear}`}</span><span className="rounded-full bg-slate-100 px-2 py-1">Version {item.version || 1}</span>{item.applicableAssetClasses?.slice(0, 3).map((asset) => <span key={asset} className="rounded-full bg-slate-100 px-2 py-1">{asset}</span>)}</div></button>;
                  })}</div>}
                </div>
              </section>

              <aside className="min-h-0 overflow-y-auto p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Copy to report</p>
                {selected ? (
                  <div className="mt-3 grid gap-5">
                    <div><h3 className="font-heading text-xl font-bold text-slate-950">{selected.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{selected.content}</p></div>
                    <label><span className="mb-2 block text-sm font-semibold text-slate-700">Report field</span><select className={`${inputClassName} min-h-11`} value={target} onChange={(event) => setTarget(event.target.value)}>{COMMENTARY_TARGET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} /><span><span className="block text-sm font-semibold text-slate-900">Replace existing content</span><span className="mt-1 block text-xs leading-5 text-slate-500">When off, the approved content is appended below the text already entered in this report.</span></span></label>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">The copied content remains editable. Review it for the Investor's actual portfolio, goals and reporting period before completing the report.</div>
                  </div>
                ) : <div className="mt-8 text-center"><LibraryBig size={34} className="mx-auto text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Select commentary</p><p className="mt-1 text-sm text-slate-500">Choose an approved content block to preview and copy it into the report.</p></div>}
              </aside>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Link href="/market-commentary" target="_blank" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Manage Commentary Library</Link>
              <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" onClick={applySelected} disabled={!selected}><CheckCircle2 size={17} /> Apply to Report</Button></div>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
