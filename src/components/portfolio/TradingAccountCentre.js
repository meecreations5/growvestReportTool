"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  CandlestickChart,
  Download,
  FileSpreadsheet,
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
      <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Trading This Month</p><p className="mt-1 text-lg font-black text-emerald-950">{formatCurrency(account.tradingNetPnlMonth ?? account.intradayNetPnlMonth)}</p><p className="mt-1 text-[10px] text-emerald-800">{account.tradeCountMonth ?? account.intradayTradeCountMonth} closed trade(s) · {account.futuresTradeCountMonth || 0} futures · {account.optionsTradeCountMonth || 0} options</p></div>
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
    <PageHeader eyebrow="Portfolio management" title="Trading Accounts" description="Delivery holdings stay in the long-term portfolio. Equity intraday, futures and options are tracked separately for turnover, charges and realised P&L and do not enter Bucket List corpus." action={<><a href="/templates/GrowVest_Daily_Trading_FO_Template_v0.34.25.xlsx" download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileSpreadsheet size={16} /> Trading Excel</a><Link href="/portfolio/daily-update" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"><FileUp size={16} /> Upload Broker Files</Link><Button type="button" variant="secondary" onClick={() => load({ quiet: true })} disabled={refreshing}>{refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />} Refresh</Button></>} />

    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Broker Accounts" value={loading && !data ? "—" : summary.accountCount || 0} helper={`${summary.investorCount || 0} investor(s) · ${summary.brokerCount || 0} broker(s)`} icon={Landmark} tone="blue" />
      <MetricCard label="Delivery Holdings" value={loading && !data ? "—" : formatCurrency(summary.deliveryValue || 0)} helper={`${summary.deliveryPositionCount || 0} position(s)`} icon={WalletCards} tone="blue" />
      <MetricCard label="DP Movements" value={loading && !data ? "—" : summary.dpTransactionCount || 0} helper={`${summary.costBasisPendingCount || 0} holding(s) need cost basis`} icon={ShieldCheck} tone={summary.costBasisPendingCount ? "amber" : "green"} />
      <MetricCard label="Trading P&L" value={loading && !data ? "—" : formatCurrency((summary.tradingNetPnlMonth ?? summary.intradayNetPnlMonth) || 0)} helper={`${(summary.tradeCountMonth ?? summary.intradayTradeCountMonth) || 0} closed trade(s) · ${summary.futuresTradeCountMonth || 0} futures · ${summary.optionsTradeCountMonth || 0} options`} icon={CandlestickChart} tone="green" />
    </div>

    <Card className="p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Trading upload formats</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">What GrowVest now understands</h2></div><a href="/templates/GrowVest_Daily_Trading_FO_Filled_Sample_v0.34.25.xlsx" download className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700"><Download size={14} /> Filled F&O sample</a></div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-900">Bajaj Broking</p><p className="mt-1 text-xs leading-5 text-slate-500">Client Holding Report XLS/XLSX → authoritative delivery quantity and current value snapshot. Purchase cost is preserved when known and never fabricated.</p></div>
        <div className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-900">GrowVest Daily Trading Excel</p><p className="mt-1 text-xs leading-5 text-slate-500">Closed Equity Intraday, Futures, Call Options and Put Options → turnover, charges and realised P&amp;L. One investor and one broker per workbook.</p></div>
        <div className="rounded-xl border border-slate-200 p-4"><p className="font-bold text-slate-900">Angel One</p><p className="mt-1 text-xs leading-5 text-slate-500">DP Transaction Cum Holding PDF/XLS/XLSX/CSV → DP credit/debit movement plus authoritative closing delivery holding quantity/value.</p></div>
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><Banknote className="mr-1 inline" size={14} /> Trading rows are reporting-only and never flow into investment current value or Bucket List corpus. Daily Trading v1 imports CLOSED trades; open positions, margin and MTM statements remain separate source adapters.</div>
    </Card>

    {loading && !data ? <div className="grid min-h-64 place-items-center text-sm font-semibold text-slate-500"><Loader2 className="animate-spin" /></div> : rows.length ? <div className="grid gap-5">{rows.map((account) => <AccountCard key={account.id} account={account} />)}</div> : <EmptyState title="No broker accounts yet" description="Upload a supported Bajaj Broking holding/trade file or Angel One DP statement from Daily Portfolio Update. GrowVest will create the broker account after investor confirmation." />}
  </div>;
}
