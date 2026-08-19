"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, ShieldAlert, Trash2, UserCheck, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { inputClassName } from "@/components/ui/Field";
import {
  deleteInvestor,
  disableInvestor,
  enableInvestor,
  previewInvestorDelete
} from "@/services/investorLifecycleService";

const ADMIN_ROLES = new Set(["super_admin", "admin"]);

function Modal({ children, onClose, busy }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <p className="font-heading text-xl font-bold text-slate-950">Manage Investor Status</p>
          <button type="button" onClick={onClose} disabled={busy} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50" aria-label="Close"><X size={17} /></button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function ImpactRow({ label, value }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0"><span className="text-slate-600">{label}</span><strong className="tabular-nums text-slate-900">{Number(value || 0).toLocaleString("en-IN")}</strong></div>;
}

export default function InvestorLifecycleCard({ investor }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [mode, setMode] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!ADMIN_ROLES.has(profile?.role) || !investor?.id) return null;

  const inactive = String(investor.status || "active").toLowerCase() === "inactive" || investor.lifecycleStatus === "disabled";

  function reset() {
    if (busy) return;
    setMode("");
    setReason("");
    setConfirmation("");
    setPreview(null);
    setError("");
    setMessage("");
  }

  async function openDelete() {
    setMode("delete");
    setError("");
    setMessage("");
    setBusy("preview");
    try {
      const result = await previewInvestorDelete(investor.id);
      setPreview(result);
    } catch (nextError) {
      setError(nextError.message || "Unable to preview Investor deletion.");
    } finally {
      setBusy("");
    }
  }

  async function submitStatusAction() {
    if (reason.trim().length < 3) return;
    setBusy(mode);
    setError("");
    setMessage("");
    try {
      const result = mode === "enable"
        ? await enableInvestor(investor.id, reason)
        : await disableInvestor(investor.id, reason);
      setMessage(mode === "enable"
        ? (result.portalRestored ? "Investor enabled and previous portal access restored." : "Investor enabled. Portal access remains disabled until enabled separately.")
        : "Investor disabled. Portal login and SIP reminders are paused.");
    } catch (nextError) {
      setError(nextError.message || "Unable to update Investor status.");
    } finally {
      setBusy("");
    }
  }

  async function submitDelete() {
    if (reason.trim().length < 5 || confirmation.trim().toUpperCase() !== "DELETE") return;
    setBusy("delete");
    setError("");
    try {
      await deleteInvestor(investor.id, reason, confirmation);
      router.replace("/investors");
      router.refresh();
    } catch (nextError) {
      setError(nextError.message || "Unable to delete Investor.");
      setBusy("");
    }
  }

  return (
    <>
      <Card className="p-5 sm:p-6 xl:col-span-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2"><ShieldAlert size={19} className="text-amber-600" /><p className="font-heading text-xl font-bold text-slate-950">Investor Status & Deletion</p></div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Disable temporarily stops Investor Portal access and pauses SIP reminders while keeping the profile available to staff. Delete removes the Investor from active GrowVest lists while retaining financial, document, report and audit records for traceability.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className={`rounded-full px-2.5 py-1 ${inactive ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{inactive ? "Investor disabled" : "Investor active"}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Admin controlled</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {inactive ? (
              <Button type="button" variant="secondary" onClick={() => { setMode("enable"); setReason(""); setError(""); setMessage(""); }}><UserCheck size={16} /> Enable Investor</Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => { setMode("disable"); setReason(""); setError(""); setMessage(""); }}><Ban size={16} /> Disable Investor</Button>
            )}
            <Button type="button" variant="danger" onClick={openDelete}><Trash2 size={16} /> Delete Investor</Button>
          </div>
        </div>
      </Card>

      {mode === "disable" || mode === "enable" ? (
        <Modal onClose={reset} busy={Boolean(busy)}>
          <div className={`rounded-xl border p-4 ${mode === "disable" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className={`font-bold ${mode === "disable" ? "text-amber-900" : "text-emerald-900"}`}>{mode === "disable" ? `Disable ${investor.fullName}?` : `Enable ${investor.fullName}?`}</p>
            <p className={`mt-1 text-sm leading-6 ${mode === "disable" ? "text-amber-800" : "text-emerald-800"}`}>{mode === "disable" ? "The Investor remains in GrowVest for staff history, but portal login is blocked and lifecycle-paused SIP reminders stop until the Investor is enabled again." : "The Investor returns to active status. SIP reminders paused by Investor disablement resume. Previous portal access is restored only when it had been active before disablement."}</p>
          </div>
          <label className="mt-5 grid gap-2"><span className="text-xs font-bold text-slate-700">Reason <span className="text-red-600">*</span></span><textarea rows={3} className={inputClassName} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={mode === "disable" ? "Example: Investor relationship temporarily inactive." : "Example: Investor relationship resumed."} disabled={Boolean(busy)} /></label>
          {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          {message ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
          <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button type="button" variant="secondary" onClick={reset} disabled={Boolean(busy)}>Close</Button>{!message ? <Button type="button" variant={mode === "disable" ? "danger" : "primary"} onClick={submitStatusAction} disabled={Boolean(busy) || reason.trim().length < 3}>{busy ? <Loader2 className="animate-spin" size={16} /> : mode === "disable" ? <Ban size={16} /> : <UserCheck size={16} />}{mode === "disable" ? "Disable Investor" : "Enable Investor"}</Button> : null}</div>
        </Modal>
      ) : null}

      {mode === "delete" ? (
        <Modal onClose={reset} busy={Boolean(busy)}>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3"><Trash2 size={20} className="mt-0.5 shrink-0 text-red-700" /><div><p className="font-bold text-red-900">Delete {investor.fullName} from active GrowVest records?</p><p className="mt-1 text-sm leading-6 text-red-800">This is intentionally different from portfolio deletion. The Investor profile disappears from active Investor lists and portal access is terminated. Historical financial records are retained and are not silently erased.</p></div></div>
          </div>

          {busy === "preview" ? <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 className="animate-spin" size={16} /> Preparing impact preview...</div> : null}
          {preview?.impact ? (
            <div className="mt-5 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Records retained for history</p>
              <div className="mt-2 grid gap-x-6 md:grid-cols-2">
                <div><ImpactRow label="Portfolio holdings" value={preview.impact.portfolioHoldings} /><ImpactRow label="Investment transactions" value={preview.impact.investmentTransactions} /><ImpactRow label="Trading transactions" value={preview.impact.tradingTransactions} /><ImpactRow label="ULIP policies" value={preview.impact.ulipPolicies} /><ImpactRow label="Portfolio snapshots" value={preview.impact.portfolioSnapshots} /></div>
                <div><ImpactRow label="Published / monthly reports" value={preview.impact.monthlyReports} /><ImpactRow label="Documents" value={preview.impact.documents} /><ImpactRow label="Meetings" value={preview.impact.meetings} /><ImpactRow label="Advisor follow-ups" value={preview.impact.advisorFollowUps} /><ImpactRow label="Portal accounts" value={preview.impact.linkedPortalAccounts} /></div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">{preview.retentionNotice}</p>
            </div>
          ) : null}

          <label className="mt-5 grid gap-2"><span className="text-xs font-bold text-slate-700">Deletion reason <span className="text-red-600">*</span></span><textarea rows={3} className={inputClassName} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Duplicate Investor profile created during testing." disabled={Boolean(busy)} /></label>
          <label className="mt-4 grid gap-2"><span className="text-xs font-bold text-slate-700">Type DELETE to confirm <span className="text-red-600">*</span></span><input className={inputClassName} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="DELETE" autoComplete="off" disabled={Boolean(busy)} /></label>
          {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button type="button" variant="secondary" onClick={reset} disabled={Boolean(busy)}>Cancel</Button><Button type="button" variant="danger" onClick={submitDelete} disabled={Boolean(busy) || !preview?.impact || reason.trim().length < 5 || confirmation.trim().toUpperCase() !== "DELETE"}>{busy === "delete" ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Delete Investor</Button></div>
        </Modal>
      ) : null}
    </>
  );
}
