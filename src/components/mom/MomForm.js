"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Trash2,
  UserRoundCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Field, inputClassName } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProgressNav from "@/components/ui/ProgressNav";
import SectionHeader from "@/components/ui/SectionHeader";
import { getMeeting } from "@/services/meetingService";
import { createMom, getMom, updateMom } from "@/services/momService";
import { sendMomCommunication } from "@/services/communicationService";
import { momSchema } from "@/lib/validation/momSchema";

function emptyDecision() {
  return { id: crypto.randomUUID(), description: "", owner: "", dueDate: "", clientVisible: true };
}

function emptyAction() {
  return { id: crypto.randomUUID(), description: "", assignedToName: "", assignedToUid: "", ownerType: "advisor", dueDate: "", priority: "medium", status: "pending", completionNote: "", clientVisible: false };
}

function defaultForm() {
  return {
    meetingId: "",
    discussionSummary: "",
    clientRequirements: "",
    goalsDiscussed: "",
    investmentsDiscussed: "",
    liabilitiesDiscussed: "",
    clientConcerns: "",
    familyInputs: "",
    advisorObservations: "",
    internalNotes: "",
    clientSummary: "",
    decisions: [emptyDecision()],
    actionItems: [emptyAction()],
    investorVisible: true,
    status: "draft",
    followUpRequired: false,
    followUpDate: "",
    followUpTime: "11:00",
    followUpPurpose: ""
  };
}

function momToForm(mom) {
  return {
    meetingId: mom.meetingId,
    discussionSummary: mom.discussionSummary || "",
    clientRequirements: mom.clientRequirements || "",
    goalsDiscussed: mom.goalsDiscussed || "",
    investmentsDiscussed: mom.investmentsDiscussed || "",
    liabilitiesDiscussed: mom.liabilitiesDiscussed || "",
    clientConcerns: mom.clientConcerns || "",
    familyInputs: mom.familyInputs || "",
    advisorObservations: mom.advisorObservations || "",
    internalNotes: mom.internalNotes || "",
    clientSummary: mom.clientSummary || "",
    decisions: mom.decisions?.length ? mom.decisions : [emptyDecision()],
    actionItems: mom.actionItems?.length ? mom.actionItems : [emptyAction()],
    investorVisible: mom.investorVisible !== false,
    status: mom.status || "draft",
    followUpRequired: Boolean(mom.followUpRequired),
    followUpDate: mom.followUpDate || "",
    followUpTime: mom.followUpTime || "11:00",
    followUpPurpose: mom.followUpPurpose || ""
  };
}

const STEPS = ["summary", "discussion", "decisions", "actions", "publish"];

function VisibilityBanner({ type = "client", children }) {
  const isClient = type === "client";
  const Icon = isClient ? Eye : EyeOff;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${isClient ? "border-blue-200 bg-blue-50/70 text-blue-900" : "border-slate-300 bg-slate-100 text-slate-800"}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isClient ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-700"}`}><Icon size={17} /></span>
      <div><p className="text-xs font-bold uppercase tracking-[0.14em]">{isClient ? "Visible to Investor" : "Internal only"}</p><p className="mt-1 text-xs leading-5 opacity-80">{children}</p></div>
    </div>
  );
}

export default function MomForm({ momId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const [form, setForm] = useState(defaultForm);
  const [mom, setMom] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(Boolean(momId));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [activeStep, setActiveStep] = useState("summary");

  useEffect(() => {
    async function load() {
      try {
        if (momId) {
          const loadedMom = await getMom(momId);
          if (!loadedMom) throw new Error("MOM was not found.");
          setMom(loadedMom);
          setForm(momToForm(loadedMom));
          setMeeting(await getMeeting(loadedMom.meetingId));
        } else {
          const meetingId = searchParams.get("meetingId");
          if (!meetingId) throw new Error("Open a meeting and select Create MOM.");
          const loadedMeeting = await getMeeting(meetingId);
          if (!loadedMeeting) throw new Error("Meeting was not found.");
          setMeeting(loadedMeeting);
          setForm((value) => ({
            ...value,
            meetingId,
            actionItems: [{ ...emptyAction(), assignedToName: loadedMeeting.advisorName || profile?.fullName || "", assignedToUid: loadedMeeting.advisorUid || profile?.id || "", ownerType: "advisor" }]
          }));
        }
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [momId, profile?.fullName, profile?.id, searchParams]);

  const stepItems = useMemo(() => {
    const summaryComplete = Boolean(form.discussionSummary.trim() && form.clientSummary.trim());
    const discussionComplete = Boolean(form.goalsDiscussed.trim() || form.investmentsDiscussed.trim() || form.clientConcerns.trim() || form.advisorObservations.trim());
    const decisionsComplete = form.decisions.some((item) => item.description.trim());
    const actionsComplete = form.actionItems.some((item) => item.description.trim());
    const publishComplete = !form.followUpRequired || Boolean(form.followUpDate && form.followUpPurpose.trim());
    return [
      { id: "summary", label: "Summaries", helper: "Internal record and client-safe recap", complete: summaryComplete },
      { id: "discussion", label: "Discussion", helper: "Goals, investments and observations", complete: discussionComplete },
      { id: "decisions", label: "Decisions", helper: "Agreed outcomes and owners", complete: decisionsComplete },
      { id: "actions", label: "Action items", helper: "Ownership, priority and due dates", complete: actionsComplete },
      { id: "publish", label: "Publish", helper: "Follow-up and Investor visibility", complete: publishComplete && summaryComplete }
    ];
  }, [form]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function updateRow(section, index, key, value) {
    setForm((current) => ({ ...current, [section]: current[section].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  }

  function addRow(section) {
    setForm((current) => ({ ...current, [section]: [...current[section], section === "decisions" ? emptyDecision() : emptyAction()] }));
  }

  function removeRow(section, index) {
    setForm((current) => ({ ...current, [section]: current[section].filter((_, itemIndex) => itemIndex !== index) }));
  }

  function goRelative(offset) {
    const index = STEPS.indexOf(activeStep);
    setActiveStep(STEPS[Math.max(0, Math.min(STEPS.length - 1, index + offset))]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function firstErrorStep(nextErrors) {
    const key = Object.keys(nextErrors)[0];
    if (["discussionSummary", "clientSummary"].includes(key)) return "summary";
    if (["clientRequirements", "goalsDiscussed", "investmentsDiscussed", "liabilitiesDiscussed", "clientConcerns", "familyInputs", "advisorObservations", "internalNotes"].includes(key)) return "discussion";
    if (key === "decisions") return "decisions";
    if (key === "actionItems") return "actions";
    return "publish";
  }

  async function save(status) {
    setSaving(true);
    setMessage("");
    setErrors({});
    const payload = { ...form, status, decisions: form.decisions.filter((item) => item.description.trim()), actionItems: form.actionItems.filter((item) => item.description.trim()) };
    const parsed = momSchema.safeParse(payload);
    if (!parsed.success) {
      const nextErrors = {};
      parsed.error.issues.forEach((issue) => { nextErrors[issue.path[0]] = issue.message; });
      setErrors(nextErrors);
      setActiveStep(firstErrorStep(nextErrors));
      setMessage("Review the highlighted fields before completing the MOM.");
      setSaving(false);
      return;
    }

    try {
      const saved = momId ? await updateMom(mom, parsed.data, profile) : await createMom(meeting, parsed.data, profile);
      if (status === "completed" && parsed.data.investorVisible && saved.investorEmail) {
        try {
          await sendMomCommunication(saved.id);
        } catch (emailError) {
          setMessage(`MOM completed, but Investor email could not be sent: ${emailError.message}`);
          setTimeout(() => router.push(`/mom/${saved.id}`), 1500);
          return;
        }
      }
      router.push(`/mom/${saved.id}`);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "MOM could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="gv-card p-8 text-sm text-slate-500">Loading MOM…</div>;

  const activeIndex = STEPS.indexOf(activeStep);
  const decisions = form.decisions.filter((item) => item.description.trim());
  const actions = form.actionItems.filter((item) => item.description.trim());

  return (
    <div className="grid gap-5 pb-24 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:pb-0">
      <aside className="hidden lg:sticky lg:top-24 lg:block"><ProgressNav items={stepItems} activeId={activeStep} onSelect={setActiveStep} title="MOM completion" description="Separate client-safe content from internal advisory notes." /></aside>

      <div className="min-w-0 grid gap-5">
        <div className="lg:hidden"><ProgressNav items={stepItems} activeId={activeStep} onSelect={setActiveStep} title="MOM completion" compact /></div>
        {message ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{message}</div> : null}

        {meeting ? <Card className="overflow-hidden"><div className="flex flex-col justify-between gap-3 bg-[#070b1e] p-5 text-white sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Linked meeting</p><p className="mt-2 font-heading text-xl font-bold text-white">{meeting.title}</p><p className="mt-1 text-sm text-slate-300">{meeting.investorName || meeting.leadName || "Internal"} · {meeting.meetingDate} · {meeting.startTime}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{meeting.meetingCode}</span></div></Card> : null}

        {activeStep === "summary" ? (
          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Step 1" title="Meeting summaries" description="Write a complete internal record and a clear client-facing recap. The two summaries serve different purposes." />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="grid gap-3"><VisibilityBanner type="internal">Detailed discussion record for Advisors, Admins and audit history.</VisibilityBanner><Field label="Discussion summary" required error={errors.discussionSummary}><textarea rows="10" className={inputClassName} value={form.discussionSummary} onChange={(event) => update("discussionSummary", event.target.value)} placeholder="Capture the complete discussion, context and rationale." /></Field></div>
              <div className="grid gap-3"><VisibilityBanner type="client">Only this summary is shared with the Investor when the MOM is published.</VisibilityBanner><Field label="Client-facing summary" required error={errors.clientSummary}><textarea rows="10" className={inputClassName} value={form.clientSummary} onChange={(event) => update("clientSummary", event.target.value)} placeholder="Summarise the discussion and agreed next steps in client-friendly language." /></Field></div>
            </div>
          </Card>
        ) : null}

        {activeStep === "discussion" ? (
          <div className="grid gap-5">
            <Card className="p-5 sm:p-6"><SectionHeader eyebrow="Step 2" title="Client discussion" description="Organise the meeting content by financial topic so the history remains searchable and useful." /><div className="mt-6 grid gap-4 md:grid-cols-2"><Field label="Client requirements"><textarea rows="4" className={inputClassName} value={form.clientRequirements} onChange={(event) => update("clientRequirements", event.target.value)} /></Field><Field label="Bucket List goals discussed"><textarea rows="4" className={inputClassName} value={form.goalsDiscussed} onChange={(event) => update("goalsDiscussed", event.target.value)} /></Field><Field label="Investments discussed"><textarea rows="4" className={inputClassName} value={form.investmentsDiscussed} onChange={(event) => update("investmentsDiscussed", event.target.value)} /></Field><Field label="Liabilities discussed"><textarea rows="4" className={inputClassName} value={form.liabilitiesDiscussed} onChange={(event) => update("liabilitiesDiscussed", event.target.value)} /></Field><Field label="Client concerns"><textarea rows="4" className={inputClassName} value={form.clientConcerns} onChange={(event) => update("clientConcerns", event.target.value)} /></Field><Field label="Family / decision-maker inputs"><textarea rows="4" className={inputClassName} value={form.familyInputs} onChange={(event) => update("familyInputs", event.target.value)} /></Field></div></Card>
            <Card className="p-5 sm:p-6"><VisibilityBanner type="internal">The following observations must never appear in the Investor Portal, client email or client-facing PDF.</VisibilityBanner><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Advisor observations"><textarea rows="5" className={inputClassName} value={form.advisorObservations} onChange={(event) => update("advisorObservations", event.target.value)} /></Field><Field label="Internal notes"><textarea rows="5" className={inputClassName} value={form.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></Field></div></Card>
          </div>
        ) : null}

        {activeStep === "decisions" ? (
          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Step 3" title="Decisions taken" description="Capture every agreed decision, owner and due date. Mark only safe decisions as visible to the Investor." action={<Button type="button" variant="secondary" onClick={() => addRow("decisions")}><Plus size={16} /> Add decision</Button>} />
            <div className="mt-6 grid gap-4">{form.decisions.map((item, index) => <div key={item.id || index} className="rounded-2xl border border-slate-200 p-4"><div className="grid gap-3 lg:grid-cols-[1fr_220px_170px_auto]"><Field label="Decision"><input className={inputClassName} value={item.description} onChange={(event) => updateRow("decisions", index, "description", event.target.value)} /></Field><Field label="Owner"><input className={inputClassName} value={item.owner} onChange={(event) => updateRow("decisions", index, "owner", event.target.value)} /></Field><Field label="Due date"><input type="date" className={inputClassName} value={item.dueDate} onChange={(event) => updateRow("decisions", index, "dueDate", event.target.value)} /></Field><div className="flex items-end"><button aria-label="Remove decision" type="button" onClick={() => removeRow("decisions", index)} className="grid h-11 w-11 place-items-center rounded-xl border border-red-200 text-red-600"><Trash2 size={17} /></button></div></div><label className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><input type="checkbox" checked={Boolean(item.clientVisible)} onChange={(event) => updateRow("decisions", index, "clientVisible", event.target.checked)} /> Visible to Investor</label></div>)}</div>
          </Card>
        ) : null}

        {activeStep === "actions" ? (
          <Card className="p-5 sm:p-6">
            <SectionHeader eyebrow="Step 4" title="Action items" description="Turn the discussion into accountable work with ownership, priority, status and deadline." action={<Button type="button" variant="secondary" onClick={() => addRow("actionItems")}><Plus size={16} /> Add action</Button>} />
            <div className="mt-6 grid gap-4">{form.actionItems.map((item, index) => <div key={item.id || index} className="rounded-2xl border border-slate-200 p-4"><div className="grid gap-3 lg:grid-cols-3"><Field label="Action"><input className={inputClassName} value={item.description} onChange={(event) => updateRow("actionItems", index, "description", event.target.value)} /></Field><Field label="Assigned to"><input className={inputClassName} value={item.assignedToName} onChange={(event) => updateRow("actionItems", index, "assignedToName", event.target.value)} /></Field><Field label="Owner type"><select className={inputClassName} value={item.ownerType} onChange={(event) => updateRow("actionItems", index, "ownerType", event.target.value)}><option value="advisor">Advisor</option><option value="investor">Investor</option><option value="admin">Admin</option><option value="other">Other</option></select></Field><Field label="Due date"><input type="date" className={inputClassName} value={item.dueDate} onChange={(event) => updateRow("actionItems", index, "dueDate", event.target.value)} /></Field><Field label="Priority"><select className={inputClassName} value={item.priority} onChange={(event) => updateRow("actionItems", index, "priority", event.target.value)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field><Field label="Status"><select className={inputClassName} value={item.status} onChange={(event) => updateRow("actionItems", index, "status", event.target.value)}><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><input type="checkbox" checked={Boolean(item.clientVisible)} onChange={(event) => updateRow("actionItems", index, "clientVisible", event.target.checked)} /> Visible to Investor</label><button type="button" onClick={() => removeRow("actionItems", index)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"><Trash2 size={15} /> Remove action</button></div></div>)}</div>
          </Card>
        ) : null}

        {activeStep === "publish" ? (
          <div className="grid gap-5">
            <Card className="p-5 sm:p-6"><SectionHeader eyebrow="Step 5" title="Follow-up and publishing" description="Choose whether the client-safe MOM appears in the Investor Portal and create the next follow-up." /><div className="mt-6 grid gap-3 md:grid-cols-2"><label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${form.investorVisible ? "border-blue-200 bg-blue-50/60" : "border-slate-200"}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-700"><Eye size={18} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">Publish client-facing MOM</span><span className="mt-1 block text-xs leading-5 text-slate-500">Only the client summary and client-visible decisions or actions will be shared.</span></span><input type="checkbox" checked={form.investorVisible} onChange={(event) => update("investorVisible", event.target.checked)} className="mt-2 h-4 w-4 accent-blue-700" /></label><label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${form.followUpRequired ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200"}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><UserRoundCheck size={18} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">Create next follow-up</span><span className="mt-1 block text-xs leading-5 text-slate-500">Add the next client touchpoint to the Advisor workflow.</span></span><input type="checkbox" checked={form.followUpRequired} onChange={(event) => update("followUpRequired", event.target.checked)} className="mt-2 h-4 w-4 accent-emerald-700" /></label></div>{form.followUpRequired ? <div className="mt-5 grid gap-4 md:grid-cols-3"><Field label="Follow-up date" required error={errors.followUpDate}><input type="date" className={inputClassName} value={form.followUpDate} onChange={(event) => update("followUpDate", event.target.value)} /></Field><Field label="Follow-up time"><input type="time" className={inputClassName} value={form.followUpTime} onChange={(event) => update("followUpTime", event.target.value)} /></Field><Field label="Purpose" required error={errors.followUpPurpose}><input className={inputClassName} value={form.followUpPurpose} onChange={(event) => update("followUpPurpose", event.target.value)} /></Field></div> : null}</Card>
            <Card className="overflow-hidden"><div className="bg-[#070b1e] p-5 text-white sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.17em] text-cyan-300">Completion review</p><h3 className="mt-2 font-heading text-2xl font-bold text-white">{meeting?.title || "Minutes of Meeting"}</h3><p className="mt-2 text-sm text-slate-300">Confirm the content count and publishing decision before completing the MOM.</p></div><div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:p-6"><div><p className="text-xs text-slate-500">Decisions</p><p className="mt-1 text-2xl font-bold text-slate-950">{decisions.length}</p></div><div><p className="text-xs text-slate-500">Actions</p><p className="mt-1 text-2xl font-bold text-slate-950">{actions.length}</p></div><div><p className="text-xs text-slate-500">Client-visible items</p><p className="mt-1 text-2xl font-bold text-blue-700">{decisions.filter((item) => item.clientVisible).length + actions.filter((item) => item.clientVisible).length}</p></div><div><p className="text-xs text-slate-500">Portal status</p><p className="mt-1 font-semibold text-slate-950">{form.investorVisible ? "Will publish" : "Internal only"}</p></div></div></Card>
          </div>
        ) : null}

        <div className="hidden items-center justify-between gap-3 lg:flex"><Button type="button" variant="secondary" onClick={() => activeIndex === 0 ? router.back() : goRelative(-1)}><ChevronLeft size={16} /> {activeIndex === 0 ? "Cancel" : "Back"}</Button><div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => save("draft")} disabled={saving}><Save size={17} /> Save draft</Button>{activeStep !== "publish" ? <Button type="button" onClick={() => goRelative(1)}>Continue <ChevronRight size={16} /></Button> : <Button type="button" onClick={() => save("completed")} disabled={saving}>{saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} Complete and publish</Button>}</div></div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"><div className="mx-auto grid max-w-xl grid-cols-[auto_1fr] gap-2"><Button type="button" variant="secondary" onClick={() => activeIndex === 0 ? router.back() : goRelative(-1)}><ChevronLeft size={16} /></Button>{activeStep !== "publish" ? <Button type="button" onClick={() => goRelative(1)}>Continue <ChevronRight size={16} /></Button> : <Button type="button" onClick={() => save("completed")} disabled={saving}>{saving ? <Loader2 size={17} className="animate-spin" /> : <ClipboardCheck size={17} />} Complete MOM</Button>}</div></div>
    </div>
  );
}
