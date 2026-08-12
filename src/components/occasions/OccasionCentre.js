"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CakeSlice,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestors } from "@/services/assessmentService";
import { createOccasion, getOccasions, updateOccasion } from "@/services/occasionService";
import {
  BIRTHDAY_REMINDER_OPTIONS,
  DEFAULT_BIRTHDAY_REMINDER_OFFSETS,
  OCCASION_RELATIONSHIPS,
  OCCASION_TYPES
} from "@/lib/utils/occasions";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import Skeleton from "@/components/ui/Skeleton";
import { Field, inputClassName } from "@/components/ui/Field";

function displayDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function daysLabel(days) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function statusClasses(status) {
  if (status === "Completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Skipped") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function OccasionDialog({ open, investors, onClose, onCreated }) {
  const [form, setForm] = useState({
    investorId: "",
    personName: "",
    relationship: "Spouse",
    occasionType: "Birthday",
    occasionDate: "",
    reminderEnabled: true,
    reminderOffsets: DEFAULT_BIRTHDAY_REMINDER_OFFSETS,
    notes: ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({ investorId: "", personName: "", relationship: "Spouse", occasionType: "Birthday", occasionDate: "", reminderEnabled: true, reminderOffsets: DEFAULT_BIRTHDAY_REMINDER_OFFSETS, notes: "" });
  }, [open]);

  if (!open) return null;

  function toggleOffset(value) {
    setForm((current) => ({
      ...current,
      reminderOffsets: current.reminderOffsets.includes(value)
        ? current.reminderOffsets.filter((item) => item !== value)
        : [...current.reminderOffsets, value].sort((a, b) => b - a)
    }));
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await createOccasion(form);
      onCreated?.();
      onClose?.();
    } catch (nextError) {
      setError(nextError.message || "Unable to add occasion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <Card className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><p className="gv-eyebrow">Relationship occasion</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">Add family / personal occasion</h2><p className="mt-1 text-sm text-slate-500">No message is sent automatically. GrowVest only reminds the assigned Advisor.</p></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500"><X size={16} /></button>
        </div>
        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Investor" required><select className={inputClassName} value={form.investorId} onChange={(event) => setForm((current) => ({ ...current, investorId: event.target.value }))}><option value="">Select investor</option>{investors.map((item) => <option key={item.id} value={item.id}>{item.fullName} {item.clientCode ? `· ${item.clientCode}` : ""}</option>)}</select></Field>
          <Field label="Person name" required><input className={inputClassName} value={form.personName} onChange={(event) => setForm((current) => ({ ...current, personName: event.target.value }))} placeholder="Spouse / child / family member" /></Field>
          <Field label="Relationship"><select className={inputClassName} value={form.relationship} onChange={(event) => setForm((current) => ({ ...current, relationship: event.target.value }))}>{OCCASION_RELATIONSHIPS.filter((item) => item !== "Investor").map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Occasion type"><select className={inputClassName} value={form.occasionType} onChange={(event) => setForm((current) => ({ ...current, occasionType: event.target.value }))}>{OCCASION_TYPES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Occasion date" required><input className={inputClassName} type="date" value={form.occasionDate} onChange={(event) => setForm((current) => ({ ...current, occasionDate: event.target.value }))} /></Field>
          <Field label="Reminder"><select className={inputClassName} value={form.reminderEnabled ? "on" : "off"} onChange={(event) => setForm((current) => ({ ...current, reminderEnabled: event.target.value === "on" }))}><option value="on">Enabled</option><option value="off">Disabled</option></select></Field>
          <div className="sm:col-span-2">
            <Field label="Reminder schedule" hint="Choose one or more reminders. Notifications go only to the assigned Advisor/Staff.">
              <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {BIRTHDAY_REMINDER_OPTIONS.map((days) => {
                  const selected = form.reminderOffsets.includes(days);
                  return <button key={days} type="button" disabled={!form.reminderEnabled} onClick={() => toggleOffset(days)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{days === 0 ? "On the day" : `${days} day${days === 1 ? "" : "s"} before`}</button>;
                })}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2"><Field label="Internal note"><textarea className={inputClassName} rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional relationship context. Do not enter highly sensitive information." /></Field></div>
        </div>
        <div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !form.investorId || !form.personName || !form.occasionDate}>{busy ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />} Add Occasion</Button></div>
      </Card>
    </div>
  );
}

export default function OccasionCentre() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, today: 0, next7: 0, next30: 0, completed: 0, pending: 0 });
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("30");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await getOccasions({ days: 366 });
      setItems(result.items || []);
      setSummary(result.summary || {});
    } catch (nextError) {
      setError(nextError.message || "Birthday & occasion data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (profile?.id) load(); }, [profile?.id]);
  useEffect(() => {
    const investorId = searchParams.get("investorId");
    if (!investorId || !items.length) return;
    const matched = items.find((item) => item.investorId === investorId);
    if (matched) {
      setSearch(matched.investorName || matched.clientCode || "");
      setFilter("all");
    }
  }, [items, searchParams]);
  useEffect(() => {
    if (!profile?.id) return undefined;
    return subscribeInvestors(profile, setInvestors, (nextError) => console.error("Unable to load investors for occasions", nextError));
  }, [profile]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || [item.personName, item.investorName, item.clientCode, item.relationship, item.occasionType].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      if (!matchesSearch) return false;
      if (filter === "today") return item.daysUntil === 0;
      if (filter === "7") return item.daysUntil <= 7;
      if (filter === "30") return item.daysUntil <= 30;
      if (filter === "pending") return item.touchpointStatus === "Pending";
      if (filter === "completed") return item.touchpointStatus === "Completed";
      return true;
    });
  }, [filter, items, search]);

  async function touchpoint(item, action, channel = "", note = "") {
    setBusyId(`${item.id}:${action}`);
    try {
      await updateOccasion(item.id, { action, channel, note });
      await load();
    } catch (nextError) {
      setError(nextError.message || "Occasion could not be updated.");
    } finally {
      setBusyId("");
    }
  }

  const tabs = [
    { value: "today", label: "Today", count: summary.today || 0 },
    { value: "7", label: "Next 7 days", count: summary.next7 || 0 },
    { value: "30", label: "Next 30 days", count: summary.next30 || 0 },
    { value: "pending", label: "Pending", count: summary.pending || 0 },
    { value: "completed", label: "Completed", count: summary.completed || 0 },
    { value: "all", label: "All upcoming", count: summary.total || 0 }
  ];

  return (
    <div className="grid gap-6 pb-16">
      <PageHeader eyebrow="Relationship Management" title="Birthday & Occasion Management" description="Plan meaningful relationship touchpoints for Investors and their families. Reminders stay internal until an Advisor chooses to call, WhatsApp, email or meet the Investor." action={<><Button variant="secondary" onClick={load}><RefreshCw size={16} /> Refresh</Button><Button onClick={() => setDialogOpen(true)}><Plus size={16} /> Add Occasion</Button></>} />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Today", value: summary.today || 0, icon: CakeSlice, tone: "bg-rose-50 text-rose-700" },
          { label: "Next 7 days", value: summary.next7 || 0, icon: CalendarDays, tone: "bg-blue-50 text-blue-700" },
          { label: "Next 30 days", value: summary.next30 || 0, icon: Sparkles, tone: "bg-violet-50 text-violet-700" },
          { label: "Pending touchpoints", value: summary.pending || 0, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
          { label: "Completed", value: summary.completed || 0, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" }
        ].map((item) => { const Icon = item.icon; return <Card key={item.label} className="p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</p><p className="mt-2 font-heading text-3xl font-bold text-slate-950">{item.value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${item.tone}`}><Icon size={19} /></span></div></Card>; })}
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <SegmentedTabs items={tabs} value={filter} onChange={setFilter} ariaLabel="Occasion filters" />
        <label className="relative"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search investor or family member" /></label>
      </div>

      {loading ? <div className="grid gap-3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-40" />)}</div> : visible.length ? (
        <div className="grid gap-3">
          {visible.map((item) => (
            <Card key={`${item.id}-${item.eventYear}`} className="overflow-hidden p-0">
              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)] lg:items-center">
                <div className="flex min-w-0 gap-4">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${item.occasionType === "Birthday" ? "bg-rose-50 text-rose-700" : item.occasionType === "Anniversary" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}><CakeSlice size={21} /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate font-heading text-lg font-bold text-slate-950">{item.personName}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{item.relationship}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClasses(item.touchpointStatus)}`}>{item.touchpointStatus}</span></div>
                    <p className="mt-1 text-sm text-slate-600">{item.occasionType} · {displayDate(item.eventDate)} · <strong className={item.daysUntil <= 3 ? "text-rose-700" : "text-blue-700"}>{daysLabel(item.daysUntil)}</strong></p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span><UsersRound size={13} className="mr-1 inline" /> Investor: <Link className="font-semibold text-blue-700 hover:underline" href={`/investors/${item.investorId}`}>{item.investorName}</Link></span>{item.turningAge !== null && item.turningAge !== undefined ? <span>Turning {item.turningAge}</span> : null}{item.anniversaryYears ? <span>{item.anniversaryYears} years</span> : null}<span>Advisor: {item.advisorName || "Assigned staff"}</span></div>
                    {item.notes ? <p className="mt-2 text-xs leading-5 text-slate-500">{item.notes}</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                  {item.touchpointStatus === "Pending" ? <>
                    <Button size="sm" variant="secondary" disabled={Boolean(busyId)} onClick={() => touchpoint(item, "complete", "Call")}><Phone size={14} /> Called</Button>
                    <Button size="sm" variant="secondary" disabled={Boolean(busyId)} onClick={() => touchpoint(item, "complete", "WhatsApp")}><MessageCircle size={14} /> WhatsApp</Button>
                    <Button size="sm" variant="secondary" disabled={Boolean(busyId)} onClick={() => touchpoint(item, "complete", "Email")}><Mail size={14} /> Email</Button>
                    <Button size="sm" disabled={Boolean(busyId)} onClick={() => touchpoint(item, "complete", "Other")}><CheckCircle2 size={14} /> Wish Completed</Button>
                    <Button size="sm" variant="quiet" disabled={Boolean(busyId)} onClick={() => touchpoint(item, "skip")} >Skip</Button>
                  </> : <Button size="sm" variant="secondary" disabled={Boolean(busyId)} onClick={() => touchpoint(item, "reopen")}><RefreshCw size={14} /> Reopen</Button>}
                  {item.custom ? <Button size="sm" variant="quiet" disabled={Boolean(busyId)} onClick={() => touchpoint(item, "archive")}><X size={14} /> Remove</Button> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-500 sm:px-5"><span>Reminder: {item.reminderOffsets?.length ? item.reminderOffsets.map((days) => days === 0 ? "day of" : `${days}d`).join(" · ") : "Disabled"}</span><span>{item.touchpointChannel ? `Completed via ${item.touchpointChannel}` : "No automatic Investor message"}</span></div>
            </Card>
          ))}
        </div>
      ) : <Card className="grid min-h-64 place-items-center p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-700"><CakeSlice size={22} /></span><h3 className="mt-4 font-heading text-xl font-bold text-slate-950">No occasions in this view</h3><p className="mt-2 text-sm text-slate-500">Add dates of birth to Investor profiles or create family/anniversary occasions.</p></div></Card>}

      <OccasionDialog open={dialogOpen} investors={investors} onClose={() => setDialogOpen(false)} onCreated={load} />
    </div>
  );
}
