"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Archive, CheckCircle2, Loader2, ScanSearch, Square } from "lucide-react";
import Button from "@/components/ui/Button";
import { archiveHistoricalFundbazaarBatch, getSystemWideMonthlyIntegrity, previewNextMonthClosingCapture, approveNextMonthClosingCapture } from "@/services/portfolioService";
import { formatCurrency } from "@/lib/utils/format";

function previousMonthKey() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const start = new Date(Date.UTC(Number(values.year), Number(values.month) - 2, 1));
  return start.toISOString().slice(0, 7);
}

const EMPTY_ARCHIVE = { scanned: 0, eligible: 0, archived: 0, existing: 0, skipped: 0, failed: 0 };
const STATUS_STYLES = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  review: "border-amber-200 bg-amber-50 text-amber-800",
  blocked: "border-red-200 bg-red-50 text-red-800"
};

export default function PortfolioSystemIntegrityPanel() {
  const [month, setMonth] = useState(previousMonthKey);
  const [audit, setAudit] = useState(null);
  const [archive, setArchive] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [captureReview, setCaptureReview] = useState(null);
  const [captureConfirmed, setCaptureConfirmed] = useState(false);
  const [captureNotice, setCaptureNotice] = useState("");
  const shouldStop = useRef(false);

  async function scanAll() {
    setBusy("audit");
    setError("");
    setCaptureReview(null);
    setCaptureConfirmed(false);
    shouldStop.current = false;
    setAudit({ month, scanned: 0, rows: [], counts: { ready: 0, review: 0, blocked: 0 } });
    let cursor = "";
    const seen = new Set();
    try {
      do {
        const page = await getSystemWideMonthlyIntegrity(month, cursor);
        const rows = Array.isArray(page.rows) ? page.rows : [];
        setAudit((current) => {
          const counts = { ...current.counts };
          rows.forEach((item) => { counts[item.status] = (counts[item.status] || 0) + 1; });
          return { ...current, scanned: current.scanned + Number(page.scannedCount || 0), rows: [...current.rows, ...rows], counts };
        });
        if (!page.nextCursor || seen.has(page.nextCursor)) break;
        seen.add(page.nextCursor);
        cursor = page.nextCursor;
      } while (!shouldStop.current);
    } catch (nextError) {
      setError(nextError?.message || "Unable to complete the monthly portfolio integrity scan.");
    } finally { setBusy(""); }
  }

  async function archiveAll() {
    setBusy("archive");
    setError("");
    shouldStop.current = false;
    setArchive({ ...EMPTY_ARCHIVE, failures: [] });
    let cursor = "";
    const seen = new Set();
    try {
      do {
        const page = await archiveHistoricalFundbazaarBatch(cursor);
        setArchive((current) => ({
          ...Object.fromEntries(Object.keys(EMPTY_ARCHIVE).map((key) => [key, current[key] + Number(page[key] || 0)])),
          failures: [...(current.failures || []), ...(page.details || []).filter((item) => item.status === "failed")].slice(0, 50)
        }));
        if (!page.nextCursor || seen.has(page.nextCursor)) break;
        seen.add(page.nextCursor);
        cursor = page.nextCursor;
      } while (!shouldStop.current);
    } catch (nextError) {
      setError(nextError?.message || "Unable to complete the historical valuation backfill.");
    } finally { setBusy(""); }
  }

  async function inspectCapture(row) {
    if (!row.captureCandidate?.id) return;
    setBusy(`inspect:${row.investorId}`);
    setError("");
    setCaptureNotice("");
    setCaptureReview(null);
    setCaptureConfirmed(false);
    try {
      const data = await previewNextMonthClosingCapture(row.investorId, month, row.captureCandidate.id);
      setCaptureReview(data);
    } catch (err) { setError(err?.message || "Unable to inspect this monthly closing capture."); }
    finally { setBusy(""); }
  }

  async function approveCapture(row) {
    if (!captureConfirmed || !captureReview?.ready || captureReview.investorId !== row.investorId
      || captureReview.snapshotId !== row.captureCandidate?.id) return;
    setBusy(`approve:${row.investorId}`);
    setError("");
    try {
      const data = await approveNextMonthClosingCapture(row.investorId, month, captureReview.snapshotId);
      setCaptureNotice(`Approved ${row.investorName}'s ${month} closing capture dated ${data.capturedDate}. Existing reports and live holdings were not changed. Rescan the reporting month to update statuses.`);
      setCaptureReview(null);
      setCaptureConfirmed(false);
    } catch (err) { setError(err?.message || "Monthly capture approval failed."); }
    finally { setBusy(""); }
  }

  const issues = (audit?.rows || []).filter((item) => item.status !== "ready");
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Admin · All investors</p>
        <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Historical valuations and monthly report integrity</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Archive Fundbazaar NAV history, scan month-end coverage across investors and explicitly approve eligible following-month captures. A November upload may contain October closing NAVs, but November investment activity must never enter October. Historical scans and approvals do not overwrite current holdings or existing reports.</p>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2 sm:p-6">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-950">1. Backfill dated source history</h3>
          <p className="mt-2 text-xs leading-5 text-slate-600">Save every eligible historic Fundbazaar Client Wise Valuation export under its actual NAV date. Existing archives are detected; missing or corrupt records are reported individually. This does not approve valuations for Monthly Reports.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={Boolean(busy)} type="button" onClick={archiveAll}>{busy === "archive" ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />} Archive past valuations</Button>
            {busy ? <Button type="button" variant="secondary" onClick={() => { shouldStop.current = true; }}><Square size={14} /> Stop after current batch</Button> : null}
          </div>
          {archive ? <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-700" aria-live="polite"><strong>{archive.scanned} import files scanned</strong><p className="mt-1">{archive.archived} archived · {archive.existing} already archived · {archive.failed} require attention · {archive.skipped} not eligible</p>{archive.failures?.length ? <p className="mt-2 text-amber-800">Example issues: {archive.failures.slice(0, 3).map((row) => `${row.fileId}: ${row.error}`).join("; ")}</p> : null}</div> : null}
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-950">2. Scan monthly closing coverage</h3>
          <p className="mt-2 text-xs leading-5 text-slate-600">Check the selected month across all active investors. Historical files are not automatically treated as verified complete month-end valuations, especially where other portfolio providers are involved.</p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">Reporting month<input type="month" className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900" value={month} disabled={Boolean(busy)} onChange={(event) => { setMonth(event.target.value); setAudit(null); }} /></label>
            <Button type="button" disabled={Boolean(busy) || !/^\d{4}-\d{2}$/.test(month)} onClick={scanAll}>{busy === "audit" ? <Loader2 size={15} className="animate-spin" /> : <ScanSearch size={15} />} Scan all investors</Button>
          </div>
          {audit ? <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-emerald-50 p-2"><strong className="block text-xl text-emerald-800">{audit.counts.ready}</strong>Ready*</div><div className="rounded-lg bg-amber-50 p-2"><strong className="block text-xl text-amber-800">{audit.counts.review}</strong>Review</div><div className="rounded-lg bg-red-50 p-2"><strong className="block text-xl text-red-800">{audit.counts.blocked}</strong>Blocked</div><p className="col-span-3 text-left text-slate-500">{audit.scanned} investor profiles scanned. *Ready means structural checks passed; staff approval is still required.</p></div> : null}
        </div>
      </div>
      {captureNotice ? <div className="mx-5 mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800" role="status">{captureNotice}</div> : null}
      {error ? <div className="mx-5 mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800"><AlertTriangle size={16} className="shrink-0" />{error}</div> : null}
      {audit && issues.length ? <div className="border-t border-slate-200 p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-950">Monthly report exceptions for {audit.month} ({issues.length})</h3>
        <div className="mt-3 max-h-[32rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {issues.map((row) => <div key={row.investorId} className="flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-950">{row.investorName} <span className="font-normal text-slate-500">{row.clientCode ? `(${row.clientCode})` : ""}</span></p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{row.message}</p>
                <p className="mt-1 text-[11px] text-slate-500">Snapshot: {row.snapshotDate || "None"}{row.snapshotDate ? ` (${formatCurrency(row.snapshotValue)})` : ""} · Archived NAV: {row.archivedValuationDate || "None"}</p>
              </div>
              <div className="flex shrink-0 items-start gap-2">
                <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[row.status] || STATUS_STYLES.blocked}`}>{row.status}</span>
                <Link href={`/investors/${encodeURIComponent(row.investorId)}?tab=portfolio`} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-blue-700">Open</Link>
              </div>
            </div>
            {row.captureCandidate && row.captureCandidate.needsReview ? <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <p className="text-xs text-blue-950">A capture on {row.captureCandidate.capturedDate} may contain the eligible {month} closing. Source NAV through {row.captureCandidate.effectiveDate}; it is not approved yet.</p>
              <button type="button" disabled={Boolean(busy)} onClick={() => inspectCapture(row)} className="mt-2 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-800 disabled:opacity-50">Review closing capture</button>
              {captureReview?.investorId === row.investorId ? <div className="mt-3 rounded-lg border border-blue-200 bg-white p-3">
                <p className={`text-xs font-bold ${captureReview.ready ? "text-emerald-800" : "text-red-700"}`}>{captureReview.ready ? "Eligible for administrator verification" : "This closing cannot be approved"}</p>
                {captureReview.blockers?.map((blocker, i) => <p key={i} className="mt-1 text-xs text-red-700">{blocker}</p>)}
                {captureReview.ready ? <>
                  <p className="mt-2 text-xs text-slate-700">Captured {captureReview.capturedDate}; NAV through {captureReview.effectiveDate}; closing {formatCurrency(captureReview.closingValue)}.</p>
                  <div className="mt-2 space-y-1">{captureReview.sources?.map((source) => <p key={source.source} className="text-xs text-slate-700">{source.source}: {source.holdingCount} holdings, {formatCurrency(source.closingValue)}, actual NAV date(s): {source.navDates?.join(", ") || "Missing"}</p>)}</div>
                  <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-700">
                    <input type="checkbox" className="mt-1" checked={captureConfirmed} onChange={(event) => setCaptureConfirmed(event.target.checked)} />
                    I have checked all portfolio sources, actual last eligible NAV dates, the complete October holdings and cash ledger, and verified that no November investment, withdrawal or switch is included in the October closing value.
                  </label>
                  <button type="button" disabled={!captureConfirmed || Boolean(busy)} onClick={() => approveCapture(row)} className="mt-3 rounded-md bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve verified {month} closing</button>
                </> : null}
              </div> : null}
            </div> : null}
          </div>)}
        </div>
      </div> : null}
      <div className="flex items-start gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-600"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-blue-700" /><p>Monthly Wealth Reviews remain blocked whenever the underlying verified closing value cannot be reconciled with all external contributions and withdrawals. A dated archive is evidence, not proof that all Fundbazaar, PMS, stock, ULIP and other portfolio assets are included.</p></div>
    </section>
  );
}
