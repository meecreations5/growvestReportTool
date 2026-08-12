"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  NotebookPen,
  Save,
  Target,
  UserRound,
  WalletCards
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestor, updateInvestorProfile } from "@/services/assessmentService";
import { updateInvestorKyc } from "@/services/investorKycService";
import {
  MARITAL_STATUSES,
  OCCUPATIONS,
  createEmptyGoal,
  createEmptyInvestment,
  createEmptyInvestmentPreference,
  createEmptyLiability,
  createEmptySurplusAllocation,
  getInvestmentPreferenceRows,
  recalculatePersonalProfile
} from "@/lib/constants/assessment";
import { investorProfileSchema } from "@/lib/validation/assessmentSchema";
import { formatCurrency } from "@/lib/utils/format";
import { BIRTHDAY_REMINDER_OPTIONS, DEFAULT_BIRTHDAY_REMINDER_OFFSETS } from "@/lib/utils/occasions";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import { Field, inputClassName } from "@/components/ui/Field";
import {
  ExistingInvestmentsEditor,
  GoalBucketEditor,
  LiabilitiesEditor,
  SurplusAllocationEditor
} from "@/components/assessment/RepeatableFinancialRows";
import InvestmentPreferencesEditor from "@/components/assessment/InvestmentPreferencesEditor";

const today = new Date().toISOString().slice(0, 10);

const EDIT_SECTIONS = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "goals", label: "Goals & Bucket List", icon: Target },
  { value: "portfolio", label: "Portfolio", icon: WalletCards },
  { value: "preferences", label: "Preferences", icon: ClipboardList },
  { value: "notes", label: "Advisor Notes", icon: NotebookPen }
];

function getGoals(investor) {
  const rows = investor.bucketList?.length ? investor.bucketList : investor.goals || [];
  if (!rows.length) return [createEmptyGoal({ primary: true })];
  const hasPrimary = rows.some((goal) => goal.isPrimary);
  return rows.map((goal, index) => ({ ...goal, id: goal.id || `goal-${index}`, isPrimary: hasPrimary ? Boolean(goal.isPrimary) : index === 0 }));
}

function makeValues(investor) {
  return {
    fullName: investor.fullName || "",
    contactNo: investor.contactNo || "",
    email: investor.email || "",
    city: investor.city || "",
    kyc: {
      panNumber: investor.panNumber || investor.panNormalized || "",
      aadhaarNumber: "",
      aadhaarConfigured: Boolean(investor.aadhaarConfigured),
      aadhaarLast4: investor.aadhaarLast4 || "",
      removeAadhaar: false
    },
    personalProfile: {
      dateOfBirth: investor.personalProfile?.dateOfBirth || "",
      age: investor.personalProfile?.age ?? "",
      birthdayReminderEnabled: investor.personalProfile?.birthdayReminderEnabled !== false,
      birthdayReminderDaysBefore: investor.personalProfile?.birthdayReminderDaysBefore ?? 7,
      birthdayReminderOffsets: investor.personalProfile?.birthdayReminderOffsets?.length
        ? investor.personalProfile.birthdayReminderOffsets
        : [investor.personalProfile?.birthdayReminderDaysBefore ?? 7],
      occupation: investor.personalProfile?.occupation || "",
      annualIncome: investor.personalProfile?.annualIncome ?? "",
      monthlySurplusMode: investor.personalProfile?.monthlySurplusMode || "fixed",
      monthlySurplusPercentage: investor.personalProfile?.monthlySurplusPercentage ?? "",
      monthlySurplus: investor.personalProfile?.monthlySurplus ?? "",
      numberOfDependants: investor.personalProfile?.numberOfDependants ?? "",
      maritalStatus: investor.personalProfile?.maritalStatus || "",
      currentInvestments: investor.personalProfile?.currentInvestments || "",
      activeLiabilities: investor.personalProfile?.activeLiabilities || ""
    },
    bucketList: getGoals(investor),
    existingInvestments: investor.existingInvestments?.length
      ? investor.existingInvestments
      : investor.currentInvestments
        ? [{ ...createEmptyInvestment(), type: "Other", notes: investor.currentInvestments }]
        : [],
    liabilities: investor.liabilities?.length
      ? investor.liabilities
      : investor.activeLiabilities
        ? [{ ...createEmptyLiability(), type: "Other", notes: investor.activeLiabilities }]
        : [],
    surplusAllocations: investor.surplusAllocations?.length ? investor.surplusAllocations : [],
    investmentPreferences: getInvestmentPreferenceRows(investor.investmentPreferences).length
      ? getInvestmentPreferenceRows(investor.investmentPreferences)
      : [createEmptyInvestmentPreference()],
    advisorNotes: {
      keyConcerns: investor.advisorNotes?.keyConcerns || "",
      objections: investor.advisorNotes?.objections || "",
      familyDynamics: investor.advisorNotes?.familyDynamics || "",
      additionalContext: investor.advisorNotes?.additionalContext || ""
    }
  };
}

function sectionForIssue(path) {
  const key = path.join(".");
  if (key.startsWith("kyc")) return "profile";
  if (key.startsWith("bucketList")) return "goals";
  if (key.startsWith("existingInvestments") || key.startsWith("liabilities")) return "portfolio";
  if (key.startsWith("surplusAllocations")) return "profile";
  if (key.startsWith("investmentPreferences")) return "preferences";
  if (key.startsWith("advisorNotes")) return "notes";
  return "profile";
}

function SectionIntro({ eyebrow, title, description }) {
  return (
    <div>
      <p className="gv-eyebrow">{eyebrow}</p>
      <h2 className="mt-1 font-heading text-2xl font-bold">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
    </div>
  );
}

export default function InvestorEditClient({ investorId }) {
  const { profile } = useAuth();
  const [investor, setInvestor] = useState(null);
  const [values, setValues] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [section, setSection] = useState("profile");

  useEffect(() => subscribeInvestor(investorId, (item) => {
    setInvestor(item);
    setValues(item ? makeValues(item) : null);
    setLoading(false);
    if (!item) setError("Investor profile was not found.");
  }, (nextError) => {
    console.error(nextError);
    setError("You do not have access to this investor profile.");
    setLoading(false);
  }), [investorId]);

  useEffect(() => {
    function warn(event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const activeIndex = EDIT_SECTIONS.findIndex((item) => item.value === section);
  const completion = useMemo(() => values ? {
    profile: Boolean(values.fullName && values.contactNo && values.personalProfile?.occupation),
    goals: Boolean(values.bucketList?.some((goal) => goal.name && Number(goal.targetAmount || 0) > 0)),
    portfolio: true,
    preferences: Boolean(getInvestmentPreferenceRows(values.investmentPreferences).length),
    notes: Object.values(values.advisorNotes || {}).some((value) => String(value || "").trim())
  } : {}, [values]);
  const tabs = EDIT_SECTIONS.map((item) => ({ ...item, label: `${item.label}${completion[item.value] ? " ✓" : ""}` }));

  function markChanged() {
    setDirty(true);
    setNotice("");
  }

  function updateRoot(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    markChanged();
  }

  function updateKyc(field, value) {
    setValues((current) => ({ ...current, kyc: { ...current.kyc, [field]: value } }));
    setErrors((current) => ({ ...current, [`kyc.${field}`]: undefined }));
    markChanged();
  }

  function updateSection(sectionName, field, value) {
    setValues((current) => {
      const nextSection = sectionName === "personalProfile"
        ? recalculatePersonalProfile({ ...current[sectionName], [field]: value })
        : { ...current[sectionName], [field]: value };
      return { ...current, [sectionName]: nextSection };
    });
    setErrors((current) => ({
      ...current,
      [`${sectionName}.${field}`]: undefined,
      ...(sectionName === "personalProfile" ? {
        "personalProfile.age": undefined,
        "personalProfile.monthlySurplus": undefined,
        "personalProfile.monthlySurplusPercentage": undefined,
        "personalProfile.annualIncome": undefined
      } : {})
    }));
    markChanged();
  }

  function updateArray(sectionName, index, field, value) {
    setValues((current) => ({ ...current, [sectionName]: current[sectionName].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
    setErrors((current) => ({ ...current, [`${sectionName}.${index}.${field}`]: undefined }));
    markChanged();
  }

  function addRow(sectionName, factory) {
    setValues((current) => ({ ...current, [sectionName]: [...current[sectionName], factory()] }));
    markChanged();
  }

  function removeRow(sectionName, index) {
    setValues((current) => ({ ...current, [sectionName]: current[sectionName].filter((_, itemIndex) => itemIndex !== index) }));
    markChanged();
  }

  function setPrimaryGoal(index) {
    setValues((current) => ({ ...current, bucketList: current.bucketList.map((goal, goalIndex) => ({ ...goal, isPrimary: goalIndex === index })) }));
    setErrors((current) => ({ ...current, "bucketList.0.isPrimary": undefined, [`bucketList.${index}.isPrimary`]: undefined }));
    markChanged();
  }

  function moveSection(direction) {
    const nextIndex = Math.min(EDIT_SECTIONS.length - 1, Math.max(0, activeIndex + direction));
    setSection(EDIT_SECTIONS[nextIndex].value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const result = investorProfileSchema.safeParse(values);
    if (!result.success) {
      const nextErrors = {};
      result.error.issues.forEach((issue) => { nextErrors[issue.path.join(".")] = issue.message; });
      setErrors(nextErrors);
      setSection(sectionForIssue(result.error.issues[0]?.path || []));
      setError("Review the highlighted fields before saving.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSaving(true);
    try {
      const nextPan = String(result.data.kyc?.panNumber || "").replace(/\s+/g, "").toUpperCase();
      const currentPan = String(investor.panNumber || investor.panNormalized || "").replace(/\s+/g, "").toUpperCase();
      const kycChanged = nextPan !== currentPan || Boolean(result.data.kyc?.aadhaarNumber) || result.data.kyc?.removeAadhaar === true;
      const kycResult = kycChanged
        ? await updateInvestorKyc(investor.id, result.data.kyc)
        : { panNumber: currentPan, aadhaarConfigured: Boolean(investor.aadhaarConfigured), aadhaarLast4: investor.aadhaarLast4 || "" };
      const updated = await updateInvestorProfile(investor, result.data, profile);
      const mergedInvestor = { ...updated, ...kycResult };
      setInvestor(mergedInvestor);
      setValues(makeValues(mergedInvestor));
      setDirty(false);
      setErrors({});
      setNotice("Investor profile updated successfully.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "Investor profile could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !values) return <div className="gv-card p-8 text-sm text-slate-500">Loading investor profile…</div>;
  if (!investor) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">{error || "Investor profile was not found."}</div>;

  return (
    <form onSubmit={handleSave} className="mx-auto grid max-w-[1400px] gap-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Link href={`/investors/${investor.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"><ArrowLeft size={16} /> Back to investor</Link>
          <p className="gv-eyebrow mt-4">Investor management</p>
          <h1 className="mt-1 font-heading text-3xl font-bold sm:text-4xl">Edit investor profile</h1>
          <p className="mt-2 text-sm text-slate-600">{investor.clientCode} · Update only the section you need, then save once.</p>
        </div>
        <Button type="submit" disabled={saving}><Save size={17} /> {saving ? "Saving…" : "Save profile"}</Button>
      </div>

      {error ? <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertTriangle size={19} /><p>{error}</p></div> : null}
      {notice ? <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 size={19} /><p>{notice}</p></div> : null}
      {dirty ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">You have unsaved changes.</div> : null}

      <div className="sticky top-[70px] z-20 -mx-1 bg-[var(--gv-surface)]/95 px-1 py-2 backdrop-blur">
        <SegmentedTabs items={tabs} value={section} onChange={setSection} ariaLabel="Edit investor sections" />
      </div>

      {section === "profile" ? (
        <Card className="p-5 sm:p-7">
          <SectionIntro eyebrow="Profile" title="Identity and financial capacity" description="Keep contact information and household financial capacity current." />
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Full name" required error={errors.fullName}><input className={inputClassName} value={values.fullName} onChange={(event) => updateRoot("fullName", event.target.value)} /></Field>
            <Field label="Contact number" required error={errors.contactNo}><input className={inputClassName} inputMode="tel" value={values.contactNo} onChange={(event) => updateRoot("contactNo", event.target.value)} /></Field>
            <Field label="Email" error={errors.email}><input className={inputClassName} type="email" value={values.email} onChange={(event) => updateRoot("email", event.target.value)} /></Field>
            <Field label="City"><input className={inputClassName} value={values.city} onChange={(event) => updateRoot("city", event.target.value)} /></Field>
            <Field label="PAN number" error={errors["kyc.panNumber"]} hint="Used for verified provider matching. Stored in uppercase."><input className={inputClassName} maxLength={10} autoCapitalize="characters" value={values.kyc.panNumber} onChange={(event) => updateKyc("panNumber", event.target.value.toUpperCase().replace(/\s+/g, ""))} placeholder="ABCDE1234F" /></Field>
            <Field label="Aadhaar number" error={errors["kyc.aadhaarNumber"]} hint={values.kyc.aadhaarConfigured ? `Stored securely · XXXX XXXX ${values.kyc.aadhaarLast4 || "••••"}. Enter 12 digits only to replace.` : "Optional. Full Aadhaar is encrypted server-side and never shown after save."}><input className={inputClassName} inputMode="numeric" autoComplete="off" maxLength={12} value={values.kyc.aadhaarNumber} onChange={(event) => updateKyc("aadhaarNumber", event.target.value.replace(/\D+/g, "").slice(0, 12))} placeholder={values.kyc.aadhaarConfigured ? "Enter new Aadhaar to replace" : "12-digit Aadhaar"} /></Field>
            {values.kyc.aadhaarConfigured ? <Field label="Stored Aadhaar"><label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={values.kyc.removeAadhaar} onChange={(event) => updateKyc("removeAadhaar", event.target.checked)} /> Remove stored Aadhaar on save</label></Field> : null}
            <Field label="Date of birth" error={errors["personalProfile.dateOfBirth"]}><input className={inputClassName} type="date" max={today} value={values.personalProfile.dateOfBirth} onChange={(event) => updateSection("personalProfile", "dateOfBirth", event.target.value)} /></Field>
            <Field label="Age" error={errors["personalProfile.age"]} hint={values.personalProfile.dateOfBirth ? "Calculated automatically from date of birth" : "Enter age when date of birth is unavailable"}><input className={`${inputClassName} ${values.personalProfile.dateOfBirth ? "bg-slate-50" : ""}`} type="number" min="18" max="120" value={values.personalProfile.age} readOnly={Boolean(values.personalProfile.dateOfBirth)} onChange={(event) => updateSection("personalProfile", "age", event.target.value)} /></Field>
            <Field label="Birthday reminder"><select className={inputClassName} value={values.personalProfile.birthdayReminderEnabled ? "on" : "off"} onChange={(event) => updateSection("personalProfile", "birthdayReminderEnabled", event.target.value === "on")}><option value="on">Enabled</option><option value="off">Disabled</option></select></Field>
            <div className="xl:col-span-2"><Field label="Birthday reminder schedule" hint="Choose one or more internal Advisor reminders. No birthday message is sent automatically."><div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">{BIRTHDAY_REMINDER_OPTIONS.map((days) => { const offsets = values.personalProfile.birthdayReminderOffsets?.length ? values.personalProfile.birthdayReminderOffsets : DEFAULT_BIRTHDAY_REMINDER_OFFSETS; const selected = offsets.includes(days); return <button key={days} type="button" disabled={!values.personalProfile.birthdayReminderEnabled} onClick={() => updateSection("personalProfile", "birthdayReminderOffsets", selected ? offsets.filter((item) => item !== days) : [...offsets, days].sort((a, b) => b - a))} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{days === 0 ? "On birthday" : `${days} day${days === 1 ? "" : "s"} before`}</button>; })}</div></Field></div>
            <Field label="Occupation" error={errors["personalProfile.occupation"]}><select className={inputClassName} value={values.personalProfile.occupation} onChange={(event) => updateSection("personalProfile", "occupation", event.target.value)}><option value="">Select occupation</option>{OCCUPATIONS.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Annual income (INR)" error={errors["personalProfile.annualIncome"]}><input className={inputClassName} type="number" min="0" value={values.personalProfile.annualIncome} onChange={(event) => updateSection("personalProfile", "annualIncome", event.target.value)} /></Field>
            <Field label="Surplus method"><select className={inputClassName} value={values.personalProfile.monthlySurplusMode} onChange={(event) => updateSection("personalProfile", "monthlySurplusMode", event.target.value)}><option value="fixed">Fixed monthly amount</option><option value="percentage">Percentage of monthly income</option></select></Field>
            {values.personalProfile.monthlySurplusMode === "percentage" ? <Field label="Surplus percentage" error={errors["personalProfile.monthlySurplusPercentage"]} hint="Calculated on annual income divided by 12"><div className="relative"><input className={`${inputClassName} pr-10`} type="number" min="0" max="100" step="0.1" value={values.personalProfile.monthlySurplusPercentage} onChange={(event) => updateSection("personalProfile", "monthlySurplusPercentage", event.target.value)} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span></div></Field> : <Field label="Monthly surplus (INR)" error={errors["personalProfile.monthlySurplus"]}><input className={inputClassName} type="number" min="0" value={values.personalProfile.monthlySurplus} onChange={(event) => updateSection("personalProfile", "monthlySurplus", event.target.value)} /></Field>}
            {values.personalProfile.monthlySurplusMode === "percentage" ? <Field label="Calculated monthly surplus" hint="Auto-calculated and saved as the investable monthly amount"><input className={`${inputClassName} bg-emerald-50 font-bold text-emerald-800`} value={formatCurrency(values.personalProfile.monthlySurplus)} readOnly /></Field> : null}
            <Field label="Dependants"><input className={inputClassName} type="number" min="0" value={values.personalProfile.numberOfDependants} onChange={(event) => updateSection("personalProfile", "numberOfDependants", event.target.value)} /></Field>
            <Field label="Marital status"><select className={inputClassName} value={values.personalProfile.maritalStatus} onChange={(event) => updateSection("personalProfile", "maritalStatus", event.target.value)}><option value="">Select status</option>{MARITAL_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          </div>
          <div className="mt-8 border-t border-slate-200 pt-7"><SectionIntro eyebrow="Cash flow" title="Monthly surplus allocation" description="Allocate available surplus as a fixed amount or percentage across investment, debt reduction, protection, goals and reserves." /><div className="mt-5"><SurplusAllocationEditor rows={values.surplusAllocations} monthlySurplus={values.personalProfile.monthlySurplus} errors={errors} onAdd={() => addRow("surplusAllocations", createEmptySurplusAllocation)} onRemove={(index) => removeRow("surplusAllocations", index)} onChange={(index, field, value) => updateArray("surplusAllocations", index, field, value)} /></div></div>
        </Card>
      ) : null}

      {section === "goals" ? (
        <Card className="p-5 sm:p-7">
          <SectionIntro eyebrow="Goals & Bucket List" title="Financial goals, corpus and life milestones" description="Goals are optional. Keep wealth under General Wealth Corpus or define one or more financial/Bucket List goals." />
          <div className="mt-6"><GoalBucketEditor goals={values.bucketList} errors={errors} onAdd={() => addRow("bucketList", createEmptyGoal)} onRemove={(index) => removeRow("bucketList", index)} onChange={(index, field, value) => updateArray("bucketList", index, field, value)} onSetPrimary={setPrimaryGoal} /></div>
        </Card>
      ) : null}

      {section === "portfolio" ? (
        <div className="grid gap-5">
          <Card className="p-5 sm:p-7"><SectionIntro eyebrow="Current portfolio" title="Existing investments" description="Capture structured investment records that will later feed the monthly report." /><div className="mt-6"><ExistingInvestmentsEditor rows={values.existingInvestments} errors={errors} onAdd={() => addRow("existingInvestments", createEmptyInvestment)} onRemove={(index) => removeRow("existingInvestments", index)} onChange={(index, field, value) => updateArray("existingInvestments", index, field, value)} /></div></Card>
          <Card className="p-5 sm:p-7"><SectionIntro eyebrow="Obligations" title="Liabilities and EMIs" description="Record active obligations that influence investment capacity and goal planning." /><div className="mt-6"><LiabilitiesEditor rows={values.liabilities} errors={errors} onAdd={() => addRow("liabilities", createEmptyLiability)} onRemove={(index) => removeRow("liabilities", index)} onChange={(index, field, value) => updateArray("liabilities", index, field, value)} /></div></Card>
        </div>
      ) : null}

      {section === "preferences" ? (
        <Card className="p-5 sm:p-7">
          <SectionIntro eyebrow="Contribution plans" title="Investment preferences" description="Add multiple preferences with independent investment type, frequency, amount and advisory areas." />
          <div className="mt-6"><InvestmentPreferencesEditor rows={values.investmentPreferences} errors={errors} onAdd={() => addRow("investmentPreferences", createEmptyInvestmentPreference)} onRemove={(index) => removeRow("investmentPreferences", index)} onChange={(index, field, value) => updateArray("investmentPreferences", index, field, value)} /></div>
        </Card>
      ) : null}

      {section === "notes" ? (
        <Card className="p-5 sm:p-7">
          <SectionIntro eyebrow="Internal only" title="Advisor context and observations" description="These notes remain internal and are never displayed in the Investor Portal." />
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Key concerns"><textarea className={`${inputClassName} min-h-32 resize-y`} value={values.advisorNotes.keyConcerns} onChange={(event) => updateSection("advisorNotes", "keyConcerns", event.target.value)} /></Field>
            <Field label="Objections"><textarea className={`${inputClassName} min-h-32 resize-y`} value={values.advisorNotes.objections} onChange={(event) => updateSection("advisorNotes", "objections", event.target.value)} /></Field>
            <Field label="Family dynamics"><textarea className={`${inputClassName} min-h-32 resize-y`} value={values.advisorNotes.familyDynamics} onChange={(event) => updateSection("advisorNotes", "familyDynamics", event.target.value)} /></Field>
            <Field label="Additional context"><textarea className={`${inputClassName} min-h-32 resize-y`} value={values.advisorNotes.additionalContext} onChange={(event) => updateSection("advisorNotes", "additionalContext", event.target.value)} /></Field>
          </div>
        </Card>
      ) : null}

      <div className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_50px_rgba(15,23,42,0.14)] backdrop-blur sm:flex sm:items-center sm:justify-between">
        <div className="hidden text-xs font-semibold text-slate-500 sm:block">Section {activeIndex + 1} of {EDIT_SECTIONS.length}</div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <Button type="button" variant="secondary" onClick={() => moveSection(-1)} disabled={activeIndex === 0}><ArrowLeft size={16} /> Back</Button>
          <Button type="submit" disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save"}</Button>
          <Button type="button" variant="secondary" onClick={() => moveSection(1)} disabled={activeIndex === EDIT_SECTIONS.length - 1}>Next <ArrowRight size={16} /></Button>
        </div>
      </div>
    </form>
  );
}
