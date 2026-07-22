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
import {
  MARITAL_STATUSES,
  OCCUPATIONS,
  createEmptyGoal,
  createEmptyInvestment,
  createEmptyInvestmentPreference,
  createEmptyLiability,
  getInvestmentPreferenceRows
} from "@/lib/constants/assessment";
import { investorProfileSchema } from "@/lib/validation/assessmentSchema";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import { Field, inputClassName } from "@/components/ui/Field";
import {
  ExistingInvestmentsEditor,
  GoalBucketEditor,
  LiabilitiesEditor
} from "@/components/assessment/RepeatableFinancialRows";
import InvestmentPreferencesEditor from "@/components/assessment/InvestmentPreferencesEditor";

const EDIT_SECTIONS = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "goals", label: "Bucket List", icon: Target },
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
    personalProfile: {
      age: investor.personalProfile?.age ?? "",
      occupation: investor.personalProfile?.occupation || "",
      annualIncome: investor.personalProfile?.annualIncome ?? "",
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
  if (key.startsWith("bucketList")) return "goals";
  if (key.startsWith("existingInvestments") || key.startsWith("liabilities")) return "portfolio";
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

  function updateSection(sectionName, field, value) {
    setValues((current) => ({ ...current, [sectionName]: { ...current[sectionName], [field]: value } }));
    setErrors((current) => ({ ...current, [`${sectionName}.${field}`]: undefined }));
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
      const updated = await updateInvestorProfile(investor, result.data, profile);
      setInvestor(updated);
      setValues(makeValues(updated));
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
            <Field label="Age" error={errors["personalProfile.age"]}><input className={inputClassName} type="number" min="18" max="120" value={values.personalProfile.age} onChange={(event) => updateSection("personalProfile", "age", event.target.value)} /></Field>
            <Field label="Occupation" error={errors["personalProfile.occupation"]}><select className={inputClassName} value={values.personalProfile.occupation} onChange={(event) => updateSection("personalProfile", "occupation", event.target.value)}><option value="">Select occupation</option>{OCCUPATIONS.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Annual income (INR)"><input className={inputClassName} type="number" min="0" value={values.personalProfile.annualIncome} onChange={(event) => updateSection("personalProfile", "annualIncome", event.target.value)} /></Field>
            <Field label="Monthly surplus (INR)"><input className={inputClassName} type="number" min="0" value={values.personalProfile.monthlySurplus} onChange={(event) => updateSection("personalProfile", "monthlySurplus", event.target.value)} /></Field>
            <Field label="Dependants"><input className={inputClassName} type="number" min="0" value={values.personalProfile.numberOfDependants} onChange={(event) => updateSection("personalProfile", "numberOfDependants", event.target.value)} /></Field>
            <Field label="Marital status"><select className={inputClassName} value={values.personalProfile.maritalStatus} onChange={(event) => updateSection("personalProfile", "maritalStatus", event.target.value)}><option value="">Select status</option>{MARITAL_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          </div>
        </Card>
      ) : null}

      {section === "goals" ? (
        <Card className="p-5 sm:p-7">
          <SectionIntro eyebrow="Bucket List" title="Financial goals and life milestones" description="Add multiple goals, select one primary goal and define target values, timelines and contribution plans." />
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
