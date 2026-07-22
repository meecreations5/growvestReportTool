"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  IndianRupee,
  Mail,
  MessageSquarePlus,
  Pencil,
  Archive,
  RotateCcw,
  Phone,
  Target,
  UserRound
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeLead,
  subscribeLeadActivities,
  subscribeLeadFollowUps,
  setLeadArchived
} from "@/services/leadService";
import { subscribeAssessment } from "@/services/assessmentService";
import { calculateLeadTat } from "@/lib/utils/leadTat";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/date";
import Card from "@/components/ui/Card";
import StatusBadge from "./StatusBadge";
import TatBadge from "./TatBadge";
import FollowUpForm from "./FollowUpForm";
import FollowUpHistory from "./FollowUpHistory";
import LeadTimeline from "./LeadTimeline";
import LeadStatusPanel from "./LeadStatusPanel";

function InfoItem({ label, value, href, icon: Icon }) {
  const content = (
    <div className="flex gap-3">
      {Icon ? <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon size={17} /></div> : null}
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || "—"}</p>
      </div>
    </div>
  );

  return href && value ? <a href={href} className="rounded-xl transition hover:bg-slate-50">{content}</a> : content;
}

function MetricCard({ label, value, hint, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    cyan: "bg-cyan-50 text-cyan-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700"
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-black tracking-tight text-slate-950">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone] || tones.blue}`}><Icon size={19} /></div>
      </div>
    </Card>
  );
}

export default function LeadDetailClient({ leadId }) {
  const { profile } = useAuth();
  const [lead, setLead] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [activities, setActivities] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followUpsLoading, setFollowUpsLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [archiveBusy, setArchiveBusy] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile || !leadId) return undefined;
    const unsubscribers = [];

    unsubscribers.push(
      subscribeLead(
        leadId,
        (item) => {
          setLead(item);
          setLoading(false);
          if (!item) setError("Lead not found or it may have been removed.");
        },
        (err) => {
          console.error(err);
          setError("You do not have access to this lead, or it could not be loaded.");
          setLoading(false);
        }
      )
    );

    unsubscribers.push(
      subscribeLeadFollowUps(
        leadId,
        (items) => {
          setFollowUps(items);
          setFollowUpsLoading(false);
        },
        (err) => {
          console.error(err);
          setFollowUpsLoading(false);
        }
      )
    );

    unsubscribers.push(
      subscribeLeadActivities(
        leadId,
        (items) => {
          setActivities(items);
          setActivitiesLoading(false);
        },
        (err) => {
          console.error(err);
          setActivitiesLoading(false);
        }
      )
    );

    unsubscribers.push(
      subscribeAssessment(
        leadId,
        setAssessment,
        (err) => console.error("Unable to load assessment summary", err)
      )
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [profile, leadId]);

  const tat = useMemo(() => calculateLeadTat(lead, now), [lead, now]);

  async function handleArchiveToggle() {
    if (!lead || archiveBusy) return;
    const action = lead.isDeleted ? "restore" : "archive";
    if (!window.confirm(`Are you sure you want to ${action} ${lead.fullName}?`)) return;
    setArchiveBusy(true);
    try {
      await setLeadArchived(lead, !lead.isDeleted, profile);
    } catch (err) {
      console.error(err);
      setError(`Unable to ${action} this lead.`);
    } finally {
      setArchiveBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading lead profile…</div>;
  }

  if (error || !lead) {
    return (
      <div className="grid gap-4 rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3 text-red-700"><AlertTriangle size={22} /><p className="font-bold">{error || "Lead could not be loaded."}</p></div>
        <Link href="/leads" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-red-700 hover:underline"><ArrowLeft size={16} /> Back to leads</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Link href="/leads" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"><ArrowLeft size={16} /> Back to leads</Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{lead.fullName}</h1>
            <StatusBadge status={lead.status} />
            <TatBadge state={tat.state} />
          </div>
          <p className="mt-2 text-sm font-medium text-slate-500">{lead.leadCode} · Assigned to {lead.assignedAdvisorName || "Unassigned"}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!lead.isDeleted ? <a href="#add-follow-up" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"><MessageSquarePlus size={17} /> Add follow-up</a> : null}
          {!lead.isDeleted ? <Link href={`/leads/${lead.id}/edit`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Pencil size={17} /> Edit lead</Link> : null}
          {!lead.isDeleted ? <Link href={`/leads/${lead.id}/assessment`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><ClipboardCheck size={17} /> {assessment?.status === "completed" ? "View assessment" : assessment ? "Continue assessment" : "Start assessment"}</Link> : null}
          {profile?.role !== "advisor" ? <button type="button" onClick={handleArchiveToggle} disabled={archiveBusy} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${lead.isDeleted ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"}`}>{lead.isDeleted ? <RotateCcw size={17} /> : <Archive size={17} />} {archiveBusy ? "Saving…" : lead.isDeleted ? "Restore" : "Archive"}</button> : null}
          {lead.convertedInvestorId ? <Link href={`/investors/${lead.convertedInvestorId}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"><UserRound size={17} /> Open investor</Link> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Indicative amount" value={formatCurrency(lead.amount)} hint={lead.serviceType || "Service not set"} icon={IndianRupee} />
        <MetricCard label="Qualification score" value={assessment?.qualification?.totalScore != null ? `${assessment.qualification.totalScore} / 5` : lead.qualificationScore === "" || lead.qualificationScore == null ? "Not scored" : `${lead.qualificationScore} / 5`} hint={assessment?.qualification?.status || "SOP 1 readiness score"} icon={Target} tone="emerald" />
        <MetricCard label="Days in status" value={`${tat.daysInStatus.toFixed(tat.daysInStatus < 1 ? 1 : 0)} days`} hint={lead.status || "—"} icon={CalendarClock} tone="amber" />
        <MetricCard label="Follow-ups logged" value={String(followUps.length)} hint={lead.lastContactChannel ? `Last via ${lead.lastContactChannel}` : "No contact logged"} icon={MessageSquarePlus} tone="cyan" />
      </div>

      <Card className={`overflow-hidden ${tat.isBreached ? "border-red-200" : ""}`}>
        <div className={`grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center ${tat.isBreached ? "bg-red-50/60" : "bg-white"}`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">SOP 1 TAT monitor</p>
              <TatBadge state={tat.state} />
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-950">{tat.action}</h2>
            <p className="mt-2 text-sm text-slate-600">{tat.rule}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left lg:min-w-64 lg:text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Required by</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{formatDateTime(tat.dueAt)}</p>
            <p className={`mt-1 text-xs font-bold ${tat.isBreached ? "text-red-600" : "text-emerald-600"}`}>{tat.remainingLabel}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <div className="grid gap-6">
          <Card className="p-5 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Lead overview</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Contact and opportunity details</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <InfoItem label="Contact number" value={lead.contactNo} href={lead.contactNo ? `tel:${lead.contactNo}` : null} icon={Phone} />
              <InfoItem label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : null} icon={Mail} />
              <InfoItem label="Lead source" value={lead.leadSource} icon={UserRound} />
              <InfoItem label="Referrer" value={lead.referrer} icon={UserRound} />
              <InfoItem label="Date received" value={`${formatDate(lead.dateReceived)}${lead.timeReceived ? ` · ${lead.timeReceived}` : ""}`} icon={CalendarClock} />
              <InfoItem label="Purpose" value={lead.purposeOfInvestment} icon={Target} />
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Current next action</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{lead.nextAction || lead.notes || "No next action has been set."}</p>
              <p className="mt-2 text-xs text-slate-500">Manual follow-up date: {formatDate(lead.followUpDue)}</p>
            </div>
          </Card>

          {!lead.isDeleted ? <Card className="p-5 sm:p-6" id="add-follow-up">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Every touchpoint</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Add follow-up</h2>
              <p className="mt-2 text-sm text-slate-600">Record the channel, discussion, client response, outcome and next action.</p>
            </div>
            <FollowUpForm lead={lead} />
          </Card> : null}

          <Card className="p-5 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Follow-up log</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Contact history</h2>
            </div>
            <FollowUpHistory items={followUps} loading={followUpsLoading} />
          </Card>
        </div>

        <div className="grid content-start gap-6">
          {!lead.isDeleted ? <Card className="p-5 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Pipeline control</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Status and next action</h2>
            </div>
            <LeadStatusPanel lead={lead} />
          </Card> : null}

          <Card className="p-5 sm:p-6">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Audit trail</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Lead activity</h2>
            </div>
            <LeadTimeline items={activities} loading={activitiesLoading} />
          </Card>
        </div>
      </div>
    </div>
  );
}
