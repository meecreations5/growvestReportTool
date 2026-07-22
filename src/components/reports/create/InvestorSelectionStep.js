"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  Mail,
  Search,
  ShieldCheck,
  UserRound,
  WalletCards
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

function portfolioValue(investor) {
  if (Number(investor?.portfolioValue || 0) > 0) return Number(investor.portfolioValue);
  if (Number(investor?.summary?.totalCorpus || 0) > 0) return Number(investor.summary.totalCorpus);
  return (investor?.existingInvestments || []).reduce((sum, item) => sum + Number(item.currentValue || 0), 0);
}

function initials(name = "Investor") {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function InvestorOption({ investor, selected, onSelect, disabled = false, compact = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(investor.id)}
      className={`group w-full rounded-xl border bg-white text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70 ${selected ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200 hover:shadow-sm"} ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid shrink-0 place-items-center rounded-xl font-bold ${compact ? "h-10 w-10 text-xs" : "h-11 w-11 text-sm"} ${selected ? "bg-blue-700 text-white" : "bg-blue-50 text-blue-700"}`}>
          {initials(investor.fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-950">{investor.fullName || "Unnamed investor"}</span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">{investor.clientCode || "Client code pending"}</span>
            </span>
            {selected ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-700 text-white"><Check size={14} strokeWidth={2.5} /></span> : null}
          </span>
          {!compact ? (
            <span className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3">
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Portfolio</span>
                <span className="mt-0.5 block text-xs font-semibold text-slate-800">{formatCurrency(portfolioValue(investor))}</span>
              </span>
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Advisor</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-slate-800">{investor.assignedAdvisorName || investor.advisorName || "Not assigned"}</span>
              </span>
            </span>
          ) : null}
        </span>
      </div>
    </button>
  );
}

export default function InvestorSelectionStep({ investors, selectedInvestor, onSelect, disabled = false }) {
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(!selectedInvestor);

  const filteredInvestors = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return investors;
    return investors.filter((investor) => [
      investor.fullName,
      investor.clientCode,
      investor.email,
      investor.contactNo,
      investor.assignedAdvisorName,
      investor.advisorName
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [investors, search]);

  const quickSelect = filteredInvestors.slice(0, 3);

  function selectInvestor(investorId) {
    onSelect(investorId);
    setShowPicker(false);
  }

  if (selectedInvestor && !showPicker) {
    return (
      <div className="grid gap-5">
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-700 text-sm font-bold text-white">
                {initials(selectedInvestor.fullName)}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">Selected investor</p>
                <h3 className="mt-1 truncate font-heading text-xl font-bold text-slate-950">{selectedInvestor.fullName}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedInvestor.clientCode || "Client code pending"}</p>
              </div>
            </div>
            {!disabled ? (
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                Change investor
              </button>
            ) : null}
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InvestorFact icon={WalletCards} label="Current portfolio" value={formatCurrency(portfolioValue(selectedInvestor))} />
            <InvestorFact icon={BriefcaseBusiness} label="Assigned Advisor" value={selectedInvestor.assignedAdvisorName || selectedInvestor.advisorName || "Not assigned"} />
            <InvestorFact icon={Mail} label="Email" value={selectedInvestor.email || "Not available"} />
            <InvestorFact icon={ShieldCheck} label="Investor Portal" value={selectedInvestor.portalEnabled ? "Active" : "Not enabled"} />
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Check size={17} /></span>
            <div>
              <p className="text-sm font-semibold text-slate-950">Investor profile linked</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">Client code, contact details, Advisor information, goals and existing holdings will be inherited from this profile.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <label htmlFor="investor-search" className="text-sm font-semibold text-slate-800">Search investors</label>
        <div className="relative mt-2">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="investor-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by investor name, client code, email or mobile"
            className="min-h-12 w-full rounded-lg border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </div>

      {!search && quickSelect.length ? (
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Quick select</h3>
              <p className="mt-1 text-xs text-slate-500">Choose from available investor profiles.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {quickSelect.map((investor) => (
              <InvestorOption key={investor.id} investor={investor} selected={selectedInvestor?.id === investor.id} onSelect={selectInvestor} compact />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">All investors</h3>
            <p className="mt-1 text-xs text-slate-500">{filteredInvestors.length} profile{filteredInvestors.length === 1 ? "" : "s"} available</p>
          </div>
        </div>

        {filteredInvestors.length ? (
          <div className="mt-3 grid max-h-[430px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {filteredInvestors.map((investor) => (
              <InvestorOption key={investor.id} investor={investor} selected={selectedInvestor?.id === investor.id} onSelect={selectInvestor} disabled={disabled} />
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><UserRound size={19} /></span>
            <p className="mt-3 text-sm font-semibold text-slate-900">No investors found</p>
            <p className="mt-1 text-sm text-slate-500">Try another name, client code, email address or mobile number.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function InvestorFact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400"><Icon size={13} /> {label}</div>
      <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
