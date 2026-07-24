"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Mail,
  MessageCircle,
  Printer,
  SquareCheckBig,
  Users
} from "lucide-react";
import { recordMomWhatsAppOpened, subscribeMom } from "@/services/momService";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { downloadMomPdf, prepareMomWhatsAppMessage, sendMomCommunication } from "@/services/communicationService";
import { openWhatsAppChat } from "@/lib/utils/whatsapp";
import { formatDate } from "@/lib/utils/format";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BrandLogo from "@/components/branding/BrandLogo";

function statusTone(status) {
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  return "bg-amber-100 text-amber-800";
}

function actionTone(status) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "bg-blue-50 text-blue-700";
  if (status === "cancelled") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

export default function MomDetailClient({ momId }) {
  const { profile } = useAuth();
  const { branding } = useBranding();
  const [mom, setMom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [whatsappBusy, setWhatsAppBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => subscribeMom(momId, (item) => {
    setMom(item);
    setLoading(false);
  }, (error) => {
    console.error(error);
    setMessage("You do not have access to this MOM.");
    setLoading(false);
  }), [momId]);

  async function emailMom() {
    setBusy(true);
    setMessage("");
    try {
      await sendMomCommunication(mom.id);
      setMessage("MOM email sent successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function whatsappMom() {
    setWhatsAppBusy(true);
    setMessage("");
    try {
      const prepared = await prepareMomWhatsAppMessage(mom.id);
      await recordMomWhatsAppOpened(mom, profile);
      openWhatsAppChat({ mobile: prepared.mobile || mom.investorMobile, message: prepared.message });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWhatsAppBusy(false);
    }
  }

  async function pdfMom() {
    setPdfBusy(true);
    setMessage("");
    try {
      const result = await downloadMomPdf(mom.id);
      setMessage(`${result.fileName} downloaded successfully.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPdfBusy(false);
    }
  }

  if (loading) return <div className="gv-card p-8 text-sm text-slate-500">Loading MOM…</div>;
  if (!mom) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{message || "MOM was not found."}</div>;

  const openActions = (mom.actionItems || []).filter((item) => !["completed", "cancelled"].includes(item.status)).length;
  const clientVisibleItems = (mom.decisions || []).filter((item) => item.clientVisible).length + (mom.actionItems || []).filter((item) => item.clientVisible).length;

  return (
    <div className="mom-print-document relative grid gap-5 overflow-hidden pb-20 lg:pb-0">
      {branding.watermarkUrl ? <img src={branding.watermarkUrl} alt="" aria-hidden="true" className="mom-print-watermark" /> : null}
      <div className="hidden items-center justify-between border-b border-slate-200 pb-4 print:flex"><BrandLogo variant="wide" /><div className="text-right text-xs text-slate-500"><strong className="block text-slate-900">MINUTES OF MEETING</strong>{branding.legalName}</div></div>

      <Link href="/mom" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 print:hidden"><ArrowLeft size={16} /> Back to MOM</Link>

      <section className="overflow-hidden rounded-[var(--gv-radius-xl)] bg-[#070b1e] text-white shadow-[var(--gv-shadow-card)] print:bg-white print:text-slate-950 print:shadow-none">
        <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_auto] xl:items-end">
          <div><div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusTone(mom.status)}`}>{mom.status}</span><span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300 print:text-blue-700">{mom.momCode}</span></div><h1 className="mt-4 max-w-3xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl print:text-slate-950">{mom.meetingTitle}</h1><p className="mt-2 text-sm text-slate-300 print:text-slate-500">{formatDate(mom.meetingDate)} · {mom.investorName || mom.leadName || "Internal"}</p></div>
          <div className="flex flex-wrap gap-2 print:hidden"><Link href={`/mom/${mom.id}/edit`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white"><Edit3 size={16} /> Edit</Link><Button type="button" variant="secondary" onClick={pdfMom} disabled={pdfBusy}><Printer size={16} /> {pdfBusy ? "Generating…" : "Download PDF"}</Button>{mom.status === "completed" && mom.investorVisible ? <Button type="button" onClick={emailMom} disabled={busy}><Mail size={16} /> {busy ? "Sending…" : "Email Investor"}</Button> : null}</div>
        </div>
        <div className="grid border-t border-white/10 print:border-slate-200 sm:grid-cols-3">
          <div className="flex items-start gap-3 p-4 sm:p-5"><Users size={19} className="mt-0.5 text-cyan-300 print:text-blue-700" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Client</p><p className="mt-1 font-semibold text-white print:text-slate-950">{mom.investorName || mom.leadName || "Internal"}</p></div></div>
          <div className="flex items-start gap-3 border-white/10 p-4 sm:border-l sm:p-5 print:border-slate-200"><SquareCheckBig size={19} className="mt-0.5 text-cyan-300 print:text-blue-700" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Open actions</p><p className="mt-1 font-semibold text-white print:text-slate-950">{openActions}</p></div></div>
          <div className="flex items-start gap-3 border-white/10 p-4 sm:border-l sm:p-5 print:border-slate-200"><Eye size={19} className="mt-0.5 text-cyan-300 print:text-blue-700" /><div><p className="text-xs uppercase tracking-wide text-slate-400">Investor visibility</p><p className="mt-1 font-semibold text-white print:text-slate-950">{mom.investorVisible ? `${clientVisibleItems} shared item${clientVisibleItems === 1 ? "" : "s"}` : "Internal only"}</p></div></div>
        </div>
      </section>

      {message ? <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800 print:hidden">{message}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(310px,.8fr)]">
        <div className="grid gap-5">
          <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><EyeOff size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Internal discussion record</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">{mom.discussionSummary}</p></div></div></Card>
          <Card className="border-blue-200 bg-blue-50/30 p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700"><Eye size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Client-facing summary</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">{mom.clientSummary}</p></div></div></Card>

          <Card className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><p className="gv-eyebrow">Decisions</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{(mom.decisions || []).length}</span></div><div className="mt-4 grid gap-3">{(mom.decisions || []).map((item, index) => <div key={item.id || index} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-slate-900">{item.description}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.clientVisible ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{item.clientVisible ? "Investor" : "Internal"}</span></div><p className="mt-2 text-xs text-slate-500">Owner: {item.owner || "—"}{item.dueDate ? ` · Due ${item.dueDate}` : ""}</p></div>)}{!(mom.decisions || []).length ? <p className="text-sm text-slate-500">No decisions recorded.</p> : null}</div></Card>

          <Card className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><p className="gv-eyebrow">Action items</p><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{openActions} open</span></div><div className="mt-4 grid gap-3">{(mom.actionItems || []).map((item, index) => <div key={item.id || index} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><p className="font-semibold text-slate-900">{item.description}</p><span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${actionTone(item.status)}`}>{String(item.status || "pending").replace(/_/g, " ")}</span></div><p className="mt-2 text-xs text-slate-500">Assigned to {item.assignedToName || "—"}{item.dueDate ? ` · Due ${item.dueDate}` : ""} · {item.priority} priority</p><p className="mt-2 text-[10px] font-bold text-slate-400">{item.clientVisible ? "Visible to Investor" : "Internal action"}</p></div>)}{!(mom.actionItems || []).length ? <p className="text-sm text-slate-500">No action items recorded.</p> : null}</div></Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Advisor and follow-up</p><p className="mt-3 font-semibold text-slate-950">{mom.advisorName}</p><div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3"><CalendarClock size={17} className="mt-0.5 text-blue-700" /><div><p className="text-xs font-bold text-slate-500">Next follow-up</p><p className="mt-1 font-semibold text-slate-900">{mom.followUpRequired ? mom.followUpDate || "Scheduled" : "Not required"}</p><p className="mt-1 text-xs text-slate-500">{mom.followUpPurpose || "—"}</p></div></div></Card>
          <Card className="p-5 print:hidden"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Communication</p><div className="mt-3 grid gap-2">{mom.status === "completed" && mom.investorVisible ? <Button type="button" onClick={emailMom} disabled={busy}><Mail size={16} /> {busy ? "Sending…" : "Email Investor"}</Button> : null}{mom.investorMobile ? <Button type="button" variant="secondary" onClick={whatsappMom} disabled={whatsappBusy}><MessageCircle size={16} /> {whatsappBusy ? "Preparing…" : "Open WhatsApp"}</Button> : null}</div></Card>
          <Card className="p-5 print:hidden"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Linked records</p><div className="mt-3 grid gap-2"><Link href={`/meetings/${mom.meetingId}`} className="font-semibold text-blue-700 hover:underline">Open meeting</Link>{mom.investorId ? <Link href={`/investors/${mom.investorId}`} className="font-semibold text-blue-700 hover:underline">Open Investor</Link> : null}</div></Card>
          <Card className="border-slate-300 bg-slate-100 p-5"><div className="flex items-start gap-3"><EyeOff size={18} className="mt-0.5 text-slate-600" /><div><p className="text-xs font-bold uppercase tracking-wide text-slate-600">Internal notes</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{mom.internalNotes || "No internal notes."}</p></div></div></Card>
        </aside>
      </div>

      <footer className="hidden justify-between border-t border-slate-200 pt-4 text-xs text-slate-500 print:flex"><span>{branding.supportEmail} · {branding.website}</span><span>{branding.documentFooterTagline || branding.tagline}</span></footer>

      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden print:hidden"><Button type="button" variant="secondary" onClick={pdfMom} disabled={pdfBusy}><Printer size={16} /> {pdfBusy ? "Generating…" : "PDF"}</Button>{mom.status === "completed" && mom.investorVisible ? <Button type="button" onClick={emailMom} disabled={busy}><Mail size={16} /> Email</Button> : <Link href={`/mom/${mom.id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-semibold text-white"><Edit3 size={16} /> Edit</Link>}</div>
    </div>
  );
}
