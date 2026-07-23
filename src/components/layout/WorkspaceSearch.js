"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileBarChart2, Search, UserRound, UsersRound, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { searchWorkspace } from "@/services/workspaceSearchService";

const ICONS = { Investor: UserRound, Lead: UsersRound, Report: FileBarChart2 };

export default function WorkspaceSearch() {
  const router = useRouter();
  const { profile } = useAuth();
  const wrapperRef = useRef(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function close(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const value = term.trim();
    if (value.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const nextResults = await searchWorkspace(profile, value);
      if (!active) return;
      setResults(nextResults);
      setLoading(false);
      setOpen(true);
    }, 260);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [profile, term]);

  function choose(result) {
    setOpen(false);
    setTerm("");
    router.push(result.href);
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className="relative block">
        <span className="sr-only">Search workspace</span>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="search"
          value={term}
          onFocus={() => term.trim().length >= 2 && setOpen(true)}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) choose(results[0]);
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search investors, leads or reports"
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm outline-none transition focus:border-[var(--gv-blue)] focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
        {term ? <button type="button" onClick={() => { setTerm(""); setResults([]); }} className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-200" aria-label="Clear search"><X size={15} /></button> : null}
      </label>

      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[var(--gv-shadow-float)]">
          {loading ? <p className="px-3 py-5 text-center text-sm font-semibold text-slate-500">Searching workspace…</p> : null}
          {!loading && term.trim().length >= 2 && !results.length ? <p className="px-3 py-5 text-center text-sm font-semibold text-slate-500">No matching investors, leads or reports.</p> : null}
          {!loading ? results.map((result) => {
            const Icon = ICONS[result.type] || Search;
            return (
              <button key={result.id} type="button" onClick={() => choose(result)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]"><Icon size={17} /></span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{result.title}</strong><span className="block truncate text-xs text-slate-500">{result.meta || result.type}</span></span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{result.type}</span>
              </button>
            );
          }) : null}
        </div>
      ) : null}
    </div>
  );
}
