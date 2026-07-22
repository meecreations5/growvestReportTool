"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BellRing,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Trash2,
  UserRoundCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Field, inputClassName } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProgressNav from "@/components/ui/ProgressNav";
import SectionHeader from "@/components/ui/SectionHeader";
import { meetingSchema } from "@/lib/validation/meetingSchema";
import {
  DEFAULT_TIME_ZONE,
  MEETING_PROVIDERS,
  MEETING_TYPES,
  isOnlineMeetingProvider,
  meetingProviderLabel,
  meetingTypeLabel
} from "@/lib/constants/meeting";
import {
  createMeeting,
  getMeeting,
  getMeetingLinkedOptions,
  updateMeeting,
  recordMeetingWhatsAppOpened
} from "@/services/meetingService";
import { sendMeetingCommunication } from "@/services/communicationService";
import { buildInvestorMeetingWhatsAppMessage } from "@/lib/utils/meetingMessages";
import { closeWhatsAppPlaceholder, navigateWhatsAppWindow, openWhatsAppPlaceholder } from "@/lib/utils/whatsapp";

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function defaultValues() {
  return {
    linkedType: "investor",
    investorId: "",
    leadId: "",
    title: "Portfolio Review",
    meetingType: "portfolio_review",
    meetingProvider: "microsoft_teams",
    meetingDate: localDate(),
    startTime: "11:00",
    endTime: "12:00",
    timeZone: DEFAULT_TIME_ZONE,
    meetingLink: "",
    location: "",
    instructions: "",
    agendaText: "Review current portfolio\nReview Bucket List goals\nAgree next steps",
    attendees: [],
    investorVisible: true,
    sendInvestorEmail: true,
    sendAdvisorEmail: true,
    createInAppNotifications: true,
    reminder24Hours: true,
    reminder1Hour: true
  };
}

function meetingToForm(meeting) {
  return {
    linkedType: meeting.linkedType || "investor",
    investorId: meeting.investorId || "",
    leadId: meeting.leadId || "",
    title: meeting.title || "",
    meetingType: meeting.meetingType || "portfolio_review",
    meetingProvider: meeting.meetingProvider || "microsoft_teams",
    meetingDate: meeting.meetingDate || localDate(),
    startTime: meeting.startTime || "11:00",
    endTime: meeting.endTime || "12:00",
    timeZone: meeting.timeZone || DEFAULT_TIME_ZONE,
    meetingLink: meeting.meetingLink || "",
    location: meeting.location || "",
    instructions: meeting.instructions || "",
    agendaText: (meeting.agenda || []).join("\n"),
    attendees: meeting.attendees || [],
    investorVisible: meeting.investorVisible !== false,
    sendInvestorEmail: meeting.communicationSettings?.sendInvestorEmail !== false,
    sendAdvisorEmail: meeting.communicationSettings?.sendAdvisorEmail !== false,
    createInAppNotifications: meeting.communicationSettings?.createInAppNotifications !== false,
    reminder24Hours: meeting.communicationSettings?.reminder24Hours !== false,
    reminder1Hour: meeting.communicationSettings?.reminder1Hour !== false
  };
}

const STEP_IDS = ["context", "schedule", "participants", "agenda", "notifications", "review"];

function switchCard({ checked, onChange, icon: Icon, title, description, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    cyan: "bg-cyan-50 text-cyan-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700"
  };
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${checked ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone] || tones.blue}`}><Icon size={18} /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-2 h-4 w-4 accent-blue-700" />
    </label>
  );
}

export default function MeetingForm({ meetingId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [form, setForm] = useState(defaultValues);
  const [meeting, setMeeting] = useState(null);
  const [investors, setInvestors] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(Boolean(meetingId));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [activeStep, setActiveStep] = useState("context");

  useEffect(() => {
    if (!profile) return;
    getMeetingLinkedOptions(profile)
      .then(({ investors: investorRows, leads: leadRows }) => {
        setInvestors(investorRows);
        setLeads(leadRows);
        if (!meetingId) {
          const investorId = searchParams.get("investorId");
          const leadId = searchParams.get("leadId");
          if (investorId) setForm((value) => ({ ...value, linkedType: "investor", investorId }));
          if (leadId) setForm((value) => ({ ...value, linkedType: "lead", leadId }));
        }
      })
      .catch((error) => setMessage(error.message));
  }, [meetingId, profile, searchParams]);

  useEffect(() => {
    if (!meetingId) return;
    getMeeting(meetingId)
      .then((item) => {
        if (!item) throw new Error("Meeting was not found.");
        setMeeting(item);
        setForm(meetingToForm(item));
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [meetingId]);

  const linkedRecord = useMemo(() => {
    if (form.linkedType === "investor") return investors.find((item) => item.id === form.investorId) || null;
    if (form.linkedType === "lead") return leads.find((item) => item.id === form.leadId) || null;
    return null;
  }, [form.investorId, form.leadId, form.linkedType, investors, leads]);

  useEffect(() => {
    if (!linkedRecord || meetingId) return;
    const primary = {
      id: "primary-client",
      name: linkedRecord.fullName || "",
      email: linkedRecord.email || "",
      mobile: linkedRecord.contactNo || linkedRecord.mobile || "",
      type: form.linkedType,
      required: true,
      sendEmail: true,
      sendWhatsApp: true
    };
    setForm((value) => ({ ...value, attendees: [primary, ...value.attendees.filter((item) => item.id !== "primary-client")] }));
  }, [form.linkedType, linkedRecord, meetingId]);

  const stepItems = useMemo(() => {
    const contextComplete = form.linkedType === "internal" || Boolean(form.linkedType === "investor" ? form.investorId : form.leadId);
    const scheduleComplete = Boolean(form.title && form.meetingType && form.meetingProvider && form.meetingDate && form.startTime && form.endTime)
      && (!isOnlineMeetingProvider(form.meetingProvider) || Boolean(form.meetingLink))
      && (form.meetingProvider !== "physical" || Boolean(form.location));
    const participantsComplete = form.linkedType === "internal" || form.attendees.some((item) => item.name?.trim());
    const agendaComplete = Boolean(form.agendaText.trim());
    const notificationsComplete = true;
    return [
      { id: "context", label: "Client context", helper: "Investor, lead or internal", complete: contextComplete },
      { id: "schedule", label: "Schedule", helper: "Date, time and meeting mode", complete: scheduleComplete },
      { id: "participants", label: "Participants", helper: "Attendees and delivery choices", complete: participantsComplete },
      { id: "agenda", label: "Agenda", helper: "Discussion plan and instructions", complete: agendaComplete },
      { id: "notifications", label: "Notifications", helper: "Email, reminders and portal", complete: notificationsComplete },
      { id: "review", label: "Review", helper: "Confirm before scheduling", complete: contextComplete && scheduleComplete && participantsComplete && agendaComplete }
    ];
  }, [form]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateAttendee(index, key, value) {
    setForm((current) => ({
      ...current,
      attendees: current.attendees.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  }

  function addAttendee() {
    setForm((current) => ({
      ...current,
      attendees: [...current.attendees, { id: crypto.randomUUID(), name: "", email: "", mobile: "", type: "family_member", required: false, sendEmail: true, sendWhatsApp: false }]
    }));
  }

  function removeAttendee(index) {
    setForm((current) => ({ ...current, attendees: current.attendees.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function goRelative(offset) {
    const index = STEP_IDS.indexOf(activeStep);
    const next = STEP_IDS[Math.max(0, Math.min(STEP_IDS.length - 1, index + offset))];
    setActiveStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function firstErrorStep(nextErrors) {
    const key = Object.keys(nextErrors)[0];
    if (["linkedType", "investorId", "leadId"].includes(key)) return "context";
    if (["title", "meetingType", "meetingProvider", "meetingDate", "startTime", "endTime", "meetingLink", "location", "timeZone"].includes(key)) return "schedule";
    if (key === "attendees") return "participants";
    if (key === "agenda") return "agenda";
    return "review";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setErrors({});
    const payload = { ...form, agenda: form.agendaText.split("\n").map((item) => item.trim()).filter(Boolean) };
    delete payload.agendaText;
    const parsed = meetingSchema.safeParse(payload);
    if (!parsed.success) {
      const nextErrors = {};
      parsed.error.issues.forEach((issue) => { nextErrors[issue.path[0]] = issue.message; });
      setErrors(nextErrors);
      setActiveStep(firstErrorStep(nextErrors));
      setMessage("Review the highlighted fields before scheduling the meeting.");
      setSaving(false);
      return;
    }

    const clientMobile = linkedRecord?.contactNo || linkedRecord?.mobile || meeting?.investorMobile || meeting?.leadMobile || "";
    const shouldPrepareWhatsApp = Boolean(clientMobile && parsed.data.attendees?.some((item) => item.sendWhatsApp && ["investor", "lead"].includes(item.type)));
    const whatsappWindow = shouldPrepareWhatsApp ? openWhatsAppPlaceholder() : null;

    try {
      const saved = meetingId
        ? await updateMeeting(meeting, parsed.data, profile, linkedRecord)
        : await createMeeting(parsed.data, profile, linkedRecord);

      const eventType = meetingId && (meeting.meetingDate !== parsed.data.meetingDate || meeting.startTime !== parsed.data.startTime || meeting.endTime !== parsed.data.endTime)
        ? "meeting_rescheduled"
        : "meeting_scheduled";

      if (shouldPrepareWhatsApp) {
        try {
          navigateWhatsAppWindow(whatsappWindow, { mobile: clientMobile, message: buildInvestorMeetingWhatsAppMessage(saved) });
          recordMeetingWhatsAppOpened(saved, profile).catch((logError) => console.error(logError));
        } catch (whatsappError) {
          closeWhatsAppPlaceholder(whatsappWindow);
          setMessage(`Meeting saved, but WhatsApp could not be opened: ${whatsappError.message}`);
        }
      }

      try {
        await sendMeetingCommunication(saved.id, eventType);
      } catch (emailError) {
        console.error(emailError);
        sessionStorage.setItem("meetingCommunicationMessage", `Meeting saved, but email could not be sent: ${emailError.message}`);
        router.push(`/meetings/${saved.id}`);
        return;
      }

      sessionStorage.setItem("meetingCommunicationMessage", shouldPrepareWhatsApp ? "Meeting saved. Email sent and WhatsApp message prepared." : "Meeting saved and email sent successfully.");
      router.push(`/meetings/${saved.id}`);
    } catch (error) {
      closeWhatsAppPlaceholder(whatsappWindow);
      console.error(error);
      setMessage(error.message || "Meeting could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="gv-card p-8 text-sm text-slate-500">Loading meeting…</div>;

  const activeIndex = STEP_IDS.indexOf(activeStep);
  const clientName = linkedRecord?.fullName || meeting?.investorName || meeting?.leadName || (form.linkedType === "internal" ? "Internal team" : "Not selected");

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 pb-24 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:pb-0">
      <aside className="hidden lg:sticky lg:top-24 lg:block">
        <ProgressNav items={stepItems} activeId={activeStep} onSelect={setActiveStep} title="Meeting setup" description="Complete each step before notifying participants." />
      </aside>

      <div className="min-w-0 grid gap-5">
        <div className="lg:hidden"><ProgressNav items={stepItems} activeId={activeStep} onSelect={setActiveStep} title="Meeting setup" compact /></div>
        {message ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{message}</div> : null}

        {activeStep === "context" ? (
          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Step 1" title="Who is this meeting for?" description="Link the meeting to an Investor or lead so their profile, Advisor and communication details are carried forward." />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Linked record type" required error={errors.linkedType}><select className={inputClassName} value={form.linkedType} onChange={(event) => update("linkedType", event.target.value)}><option value="investor">Investor</option><option value="lead">Lead</option><option value="internal">Internal meeting</option></select></Field>
              {form.linkedType === "investor" ? <Field label="Investor" required error={errors.investorId}><select className={inputClassName} value={form.investorId} onChange={(event) => update("investorId", event.target.value)}><option value="">Select investor</option>{investors.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.clientCode}</option>)}</select></Field> : null}
              {form.linkedType === "lead" ? <Field label="Lead" required error={errors.leadId}><select className={inputClassName} value={form.leadId} onChange={(event) => update("leadId", event.target.value)}><option value="">Select lead</option>{leads.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.leadCode}</option>)}</select></Field> : null}
            </div>
            {linkedRecord ? <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Linked profile</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Client</p><p className="font-semibold text-slate-950">{linkedRecord.fullName}</p></div><div><p className="text-xs text-slate-500">Reference</p><p className="font-semibold text-slate-950">{linkedRecord.clientCode || linkedRecord.leadCode || "—"}</p></div><div><p className="text-xs text-slate-500">Advisor</p><p className="font-semibold text-slate-950">{linkedRecord.advisorName || linkedRecord.assignedAdvisorName || profile?.fullName || "—"}</p></div></div></div> : null}
          </Card>
        ) : null}

        {activeStep === "schedule" ? (
          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Step 2" title="Schedule and meeting mode" description="Choose the purpose, date and joining method. Online meetings require a valid meeting link." />
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Meeting title" required error={errors.title}><input className={inputClassName} value={form.title} onChange={(event) => update("title", event.target.value)} /></Field>
              <Field label="Meeting type" required error={errors.meetingType}><select className={inputClassName} value={form.meetingType} onChange={(event) => update("meetingType", event.target.value)}>{MEETING_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
              <Field label="Meeting provider" required error={errors.meetingProvider}><select className={inputClassName} value={form.meetingProvider} onChange={(event) => update("meetingProvider", event.target.value)}>{MEETING_PROVIDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
              <Field label="Meeting date" required error={errors.meetingDate}><input type="date" className={inputClassName} value={form.meetingDate} onChange={(event) => update("meetingDate", event.target.value)} /></Field>
              <Field label="Start time" required error={errors.startTime}><input type="time" className={inputClassName} value={form.startTime} onChange={(event) => update("startTime", event.target.value)} /></Field>
              <Field label="End time" required error={errors.endTime}><input type="time" className={inputClassName} value={form.endTime} onChange={(event) => update("endTime", event.target.value)} /></Field>
              {isOnlineMeetingProvider(form.meetingProvider) ? <Field label="Meeting link" required error={errors.meetingLink} hint="Paste a Teams, Google Meet, Zoom or secure joining link."><input type="url" className={inputClassName} value={form.meetingLink} onChange={(event) => update("meetingLink", event.target.value)} placeholder="https://..." /></Field> : null}
              {form.meetingProvider === "physical" ? <Field label="Meeting location" required error={errors.location}><input className={inputClassName} value={form.location} onChange={(event) => update("location", event.target.value)} /></Field> : null}
              <Field label="Time zone" error={errors.timeZone}><input className={inputClassName} value={form.timeZone} onChange={(event) => update("timeZone", event.target.value)} /></Field>
            </div>
          </Card>
        ) : null}

        {activeStep === "participants" ? (
          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Step 3" title="Participants" description="Add family members or external attendees and choose how each person should be contacted." action={<Button type="button" variant="secondary" onClick={addAttendee}><Plus size={16} /> Add attendee</Button>} />
            <div className="mt-6 grid gap-4">
              {form.attendees.map((item, index) => (
                <div key={item.id || index} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px_auto]">
                    <Field label="Name"><input className={inputClassName} value={item.name} onChange={(event) => updateAttendee(index, "name", event.target.value)} /></Field>
                    <Field label="Email"><input type="email" className={inputClassName} value={item.email} onChange={(event) => updateAttendee(index, "email", event.target.value)} /></Field>
                    <Field label="Type"><select className={inputClassName} value={item.type} onChange={(event) => updateAttendee(index, "type", event.target.value)}><option value="investor">Investor</option><option value="lead">Lead</option><option value="family_member">Family Member</option><option value="advisor">Advisor</option><option value="admin">Admin</option><option value="external">External</option></select></Field>
                    <div className="flex items-end"><button aria-label="Remove attendee" type="button" onClick={() => removeAttendee(index)} disabled={item.id === "primary-client"} className="grid h-11 w-11 place-items-center rounded-xl border border-red-200 text-red-600 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={17} /></button></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={item.sendEmail !== false} onChange={(event) => updateAttendee(index, "sendEmail", event.target.checked)} /> Email invitation</label><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={Boolean(item.sendWhatsApp)} onChange={(event) => updateAttendee(index, "sendWhatsApp", event.target.checked)} /> Prepare WhatsApp message</label></div>
                </div>
              ))}
              {!form.attendees.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No attendees added. Internal meetings can continue without external attendees.</div> : null}
            </div>
          </Card>
        ) : null}

        {activeStep === "agenda" ? (
          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Step 4" title="Agenda and instructions" description="Set a focused agenda so the Advisor and Investor know what will be discussed and prepared." />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Agenda" required error={errors.agenda} hint="Enter one agenda item per line."><textarea rows="9" className={inputClassName} value={form.agendaText} onChange={(event) => update("agendaText", event.target.value)} /></Field>
              <Field label="Additional instructions" hint="Client-safe preparation notes, documents or joining guidance."><textarea rows="9" className={inputClassName} value={form.instructions} onChange={(event) => update("instructions", event.target.value)} /></Field>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Agenda preview</p><ol className="mt-3 grid gap-2">{form.agendaText.split("\n").map((item) => item.trim()).filter(Boolean).map((item, index) => <li key={`${item}-${index}`} className="flex gap-3 text-sm text-slate-700"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{index + 1}</span><span>{item}</span></li>)}</ol></div>
          </Card>
        ) : null}

        {activeStep === "notifications" ? (
          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Step 5" title="Notifications and reminders" description="Choose the automatic email and in-app notifications. WhatsApp remains a prepared click-to-chat message." />
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {switchCard({ checked: form.sendInvestorEmail, onChange: (event) => update("sendInvestorEmail", event.target.checked), icon: Mail, title: "Email Investor or lead", description: "Send the branded invitation and .ics calendar attachment." })}
              {switchCard({ checked: form.sendAdvisorEmail, onChange: (event) => update("sendAdvisorEmail", event.target.checked), icon: UserRoundCheck, title: "Email assigned Advisor", description: "Send an internal confirmation to the meeting owner.", tone: "cyan" })}
              {switchCard({ checked: form.createInAppNotifications, onChange: (event) => update("createInAppNotifications", event.target.checked), icon: BellRing, title: "Create in-app notifications", description: "Add alerts to the Investor and Advisor notification centres.", tone: "green" })}
              {switchCard({ checked: form.investorVisible, onChange: (event) => update("investorVisible", event.target.checked), icon: Eye, title: "Visible in Investor Portal", description: "Allow the Investor to view date, agenda and joining details." })}
              {switchCard({ checked: form.reminder24Hours, onChange: (event) => update("reminder24Hours", event.target.checked), icon: Clock3, title: "24-hour reminder", description: "Queue the first meeting reminder one day before.", tone: "amber" })}
              {switchCard({ checked: form.reminder1Hour, onChange: (event) => update("reminder1Hour", event.target.checked), icon: MessageCircle, title: "1-hour reminder", description: "Queue the final reminder shortly before the meeting.", tone: "amber" })}
            </div>
          </Card>
        ) : null}

        {activeStep === "review" ? (
          <div className="grid gap-5">
            <Card className="overflow-hidden">
              <div className="bg-[#070b1e] p-5 text-white sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Ready to schedule</p><h2 className="mt-2 font-heading text-2xl font-bold text-white">{form.title || "Untitled meeting"}</h2><p className="mt-2 text-sm text-slate-300">Review all client-facing details before invitations and reminders are created.</p></div>
              <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
                <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Client / context</p><p className="mt-2 text-lg font-semibold text-slate-950">{clientName}</p><p className="text-sm text-slate-500">{form.linkedType === "internal" ? "Internal meeting" : linkedRecord?.clientCode || linkedRecord?.leadCode || "Linked record"}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Schedule</p><p className="mt-2 text-lg font-semibold text-slate-950">{form.meetingDate || "Date pending"} · {form.startTime || "—"}–{form.endTime || "—"}</p><p className="text-sm text-slate-500">{meetingTypeLabel(form.meetingType)} · {meetingProviderLabel(form.meetingProvider)}</p></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Participants</p><p className="mt-2 text-lg font-semibold text-slate-950">{form.attendees.filter((item) => item.name?.trim()).length}</p><p className="text-sm text-slate-500">{form.attendees.filter((item) => item.sendEmail).length} email · {form.attendees.filter((item) => item.sendWhatsApp).length} WhatsApp</p></div>
                <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Reminders</p><div className="mt-2 flex flex-wrap gap-2">{form.reminder24Hours ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">24 hours</span> : null}{form.reminder1Hour ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">1 hour</span> : null}{form.investorVisible ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Portal visible</span> : null}</div></div>
              </div>
            </Card>
            <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ClipboardCheck size={19} /></span><div><h3 className="font-heading text-xl">What happens next</h3><ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600"><li>• The meeting is saved against the selected client record.</li><li>• Brevo sends enabled email invitations and the calendar attachment.</li><li>• WhatsApp opens with a prepared message when selected.</li><li>• The meeting appears in the Advisor and Investor timelines.</li></ul></div></div></Card>
          </div>
        ) : null}

        <div className="hidden items-center justify-between gap-3 lg:flex">
          <Button type="button" variant="secondary" onClick={() => activeIndex === 0 ? router.back() : goRelative(-1)}><ChevronLeft size={16} /> {activeIndex === 0 ? "Cancel" : "Back"}</Button>
          {activeStep !== "review" ? <Button type="button" onClick={() => goRelative(1)}>Continue <ChevronRight size={16} /></Button> : <Button type="submit" disabled={saving}>{saving ? <Loader2 size={17} className="animate-spin" /> : <CalendarPlus size={17} />}{meetingId ? "Update and notify" : "Schedule and notify"}</Button>}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => activeIndex === 0 ? router.back() : goRelative(-1)}><ChevronLeft size={16} /> {activeIndex === 0 ? "Cancel" : "Back"}</Button>
          {activeStep !== "review" ? <Button type="button" onClick={() => goRelative(1)}>Continue <ChevronRight size={16} /></Button> : <Button type="submit" disabled={saving}>{saving ? <Loader2 size={17} className="animate-spin" /> : <CalendarPlus size={17} />} Schedule</Button>}
        </div>
      </div>
    </form>
  );
}
