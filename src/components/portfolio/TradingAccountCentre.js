"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  CandlestickChart,
  FileUp,
  Landmark,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import MetricCard from "@/components/ui/MetricCard";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils/format";
import { PORTFOLIO_SOURCE_LABELS } from "@/lib/constants/portfolio";
import { getTradingAccounts } from "@/services/portfolioService";

function shortAccount(value = "") {
  const text = String(value || "");
  if (text.length <= 8) return text || "Not available";
  return `${text.slice(0, 4)}••••${text.slice(-4)}`;
}

function AccountCard({ account }) {
  return <Card className="overflow-hidden">
    <div className="border-b border-slate-200 p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-xl font-bold text-slate-950">{account.investorName}</p>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{account.provider || PORTFOLIO_SOURCE_LABELS[account.source] || "Broker"}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{account.clientCode || "No client code"} · Account {shortAccount(account.accountReference)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Last valuation: {account.lastValuationDate || "Not available"}</p>
        </div>
        <Link href={`/investors/${account.investorId}?tab=portfolio`} className="inline-flex min-h-9 items-center gap-1 self-start rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">Investor Portfolio <ArrowUpRight size={13} /></Link>
      </div>
    </div>
    <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Delivery Value</p><p className="mt-1 text-lg font-black text-slate-950">{formatCurrency(account.holdingValue)}</p><p className="mt-1 text-[10px] text-slate-500">{account.positionCount} current holding(s)</p></div>
      <div className="rounded-xl bg-amber-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Cost Basis Pending</p><p className="mt-1 text-lg font-black text-amber-950">{account.costBasisPendingCount}</p><p className="mt-1 text-[10px] text-amber-800">Needs trade/cost report when unavailable</p></div>
      <div className="rounded-xl bg-violet-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-violet-700">DP Movements</p><p className="mt-1 text-lg font-black text-violet-950">{account.dpTransactionCount}</p><p className="mt-1 text-[10px] text-violet-800">Depository credit/debit records</p></div>
      <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Intraday This Month</p><p className="mt-1 text-lg font-black text-emerald-950">{formatCurrency(account.intradayNetPnlMonth)}</p><p className="mt-1 text-[10px] text-emerald-800">{account.intradayTradeCountMonth} trade(s)</p></div>
    </div>
    {account.latestDpTransactions?.length ? <div className="border-t border-slate-100 p-5"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Latest DP movements</p><div className="mt-3 grid gap-2">{account.latestDpTransactions.map((item) => <div key={item.id} className="grid gap-1 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:grid-cols-[90px_minmax(0,1fr)_110px]"><span className="font-semibold text-slate-500">{item.transactionDate || "—"}</span><div><p className="font-bold text-slate-900">{item.instrumentName || item.isin || "Security"}</p><p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">{item.description || "DP movement"}</p></div><span className="font-bold text-slate-700 sm:text-right">{item.creditQuantity ? `+${item.creditQuantity}` : item.debitQuantity ? `-${item.debitQuantity}` : "—"}</span></div>)}</div></div> : null}
  </Card>;
}

export default function TradingAccountCentre() {
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load({ quiet = false } = {}) {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setData(await getTradingAccounts());
    } catch (nextError) {
      setError(nextError?.message || "Unable to load trading accounts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!profile?.id) return;
    load();
  }, [profile?.id]);

  const rows = useMemo(() => data?.rows || [], [data]);
  const summary = data?.summary || {};

  if (!profile) return <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-blue-700" /></div>;

  return <div className="grid gap-6">
    <PageHeader eyebrow="Portfolio management" title="Trading Accounts" description="Broker-level delivery holdings, depository movement and intraday activity remain distinct while still rolling delivery investments into the investor's Portfolio Master." action={<><Link href="/portfolio/daily-update" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"><FileUp size={16} /> Upload Broker Files</Link><Button type="button" variant="secondary" onClick={() => load({ quiet: true })} disabled={refreshing}>{refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />} Refresh</Button></>} />

    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Broker Accounts" value={loading && !data ? "—" : summary.accountCount || 0} helper={`${summary.investorCount || 0} investor(s) · ${summary.brokerCount || 0} broker(s)`} icon={Landmark} tone="blue" />
      <MetricCard label="Delivery Holdings" value={loading && !data ? "—" : formatCurrency(summary.deliveryValue || 0)} helper={`${summary.deliveryPositionCount || 0} position(s)`} icon={WalletCards} tone="blue" />
      <MetricCard label="DP Movements" value={loading && !data ? "—" : summary.dpTransactionCount || 0} helper={`${summary.costBasisPendingCount || 0} holding(s) need cost basis`} icon={ShieldCheck} tone={summary.costBasisPendingCount ? "amber" : "green"} />
      <MetricCard label="Intraday P&L" value={loading && !data ? "—" : formatCurrency(summary.intradayNetPnlMonth || 0)} helper={`${summary.intradayTradeCountMonth || 0} trade(s) · ${summary.monthKey || "current month"}`} icon={CandlestickChart} tone="green" />
    </div>

    <Card className="p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Phase 1 native broker formats</p>
      <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">What GrowVest now understands</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-900">Bajaj Broking</p><p className="mt-1 text-xs leading-5 text-slate-500">Client Holding Report XLS/XLSX → authoritative delivery quantity and current value snapshot. Purchase cost is preserved when known and never fabricated.</p></div>
        <div className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-900">Bajaj Intraday / Trade Book</p><p className="mt-1 text-xs leading-5 text-slate-500">Intraday trades → turnover, realized P&amp;L and charges. This activity stays outside long-term Bucket List corpus.</p></div>
        <div className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-900">Angel One</p><p className="mt-1 text-xs leading-5 text-slate-500">Digital DP Transaction Cum Holding PDF → DP credit/debit movement plus authoritative closing delivery holding quantity/value.</p></div>
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><Banknote className="mr-1 inline" size={14} /> Ledger, Contract Note, broker P&amp;L, margin and position reports are intentionally not inferred from these two source formats. They can be added as separate native adapters in the next trading-account phase.</div>
    </Card>

    {loading && !data ? <div className="grid min-h-64 place-items-center text-sm font-semibold text-slate-500"><Loader2 className="animate-spin" /></div> : rows.length ? <div className="grid gap-5">{rows.map((account) => <AccountCard key={account.id} account={account} />)}</div> : <EmptyState title="No broker accounts yet" description="Upload a supported Bajaj Broking holding/trade file or Angel One DP statement from Daily Portfolio Update. GrowVest will create the broker account after investor confirmation." />}
  </div>;
}
