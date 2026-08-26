"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  FileText,
  History,
  Save,
  UserRoundCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeLead } from "@/services/leadService";
import {
  convertLeadToInvestor,
  saveAssessment,
  subscribeAssessment,
  subscribeAssessmentVersions
} from "@/services/assessmentService";
import {
  ASSESSMENT_STATUS,
  MARITAL_STATUSES,
  OCCUPATIONS,
  RISK_PROFILES,
  RISK_QUESTIONS,
  calculateQualificationScore,
  calculateRiskProfile,
  calculateRiskScore,
  calculateInvestmentPreferenceTotals,
  calculateTotalGoalTarget,
  recalculatePersonalProfile,
  createEmptyGoal,
  createEmptyInvestment,
  createEmptyInvestmentPreference,
  createEmptyLiability,
  createEmptySurplusAllocation,
  getInvestmentPreferenceRows,
  getPrimaryGoal,
  getQualificationStatus,
  getRecommendedProfile
} from "@/lib/constants/assessment";
import { assessmentSchema, validateCompletedAssessment } from "@/lib/validation/assessmentSchema";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { BIRTHDAY_REMINDER_OPTIONS, DEFAULT_BIRTHDAY_REMINDER_OFFSETS } from "@/lib/utils/occasions";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProgressNav from "@/components/ui/ProgressNav";
import { Field, inputClassName } from "@/components/ui/Field";
import {
  ExistingInvestmentsEditor,
  GoalBucketEditor,
  LiabilitiesEditor,
  SurplusAllocationEditor
} from "@/components/assessment/RepeatableFinancialRows";
import InvestmentPreferencesEditor from "@/components/assessment/InvestmentPreferencesEditor";

const today = new Date().toISOString().slice(0, 10);

const ASSESSMENT_SECTIONS = [
  { id: "assessment-linked", label: "Linked details", helper: "Client and advisor" },
  { id: "assessment-profile", label: "Financial profile", helper: "Capacity and dependants" },
  { id: "assessment-goals", label: "Goals & Bucket List", helper: "Optional goals and priorities" },
  { id: "assessment-investments", label: "Investments", helper: "Existing portfolio" },
  { id: "assessment-liabilities", label: "Liabilities", helper: "Loans and EMIs" },
  { id: "assessment-preferences", label: "Preferences", helper: "SIP and lump sum" },
  { id: "assessment-risk", label: "Risk profile", helper: "Suitability scoring" },
  { id: "assessment-qualification", label: "Qualification", helper: "Readiness score" },
  { id: "assessment-notes", label: "Advisor notes", helper: "Internal context" }
];

function assessmentSectionProgress(values) {
  if (!values) return {};
  const usedGoals = (values.bucketList || []).filter((goal) => goal.name || goal.targetAmount || goal.timeline || goal.targetYear);
  const usedInvestments = (values.existingInvestments || []).filter((item) => item.type || item.institution || item.currentValue);
  const usedLiabilities = (values.liabilities || []).filter((item) => item.type || item.lender || item.outstandingAmount);
  const usedPreferences = getInvestmentPreferenceRows(values.investmentPreferences);
  return {
    "assessment-linked": Boolean(values.assessmentDate && values.assessmentType),
    "assessment-profile": Boolean(values.personalProfile?.age && values.personalProfile?.occupation && values.personalProfile?.monthlySurplus !== ""),
    "assessment-goals": !usedGoals.length || usedGoals.every((goal) => goal.name && Number(goal.targetAmount || 0) > 0 && (goal.timeline || goal.targetYear)),
    "assessment-investments": !usedInvestments.length || usedInvestments.every((item) => item.type && Number(item.currentValue || 0) >= 0),
    "assessment-liabilities": !usedLiabilities.length || usedLiabilities.every((item) => item.type && Number(item.outstandingAmount || 0) >= 0),
    "assessment-preferences": Boolean(usedPreferences.length && usedPreferences.every((item) => item.investmentType && item.preferredFrequency)),
    "assessment-risk": RISK_QUESTIONS.every((item) => values.riskAssessment?.[item.key] !== "" && values.riskAssessment?.[item.key] !== undefined),
    "assessment-qualification": calculateQualificationScore(values.qualification) > 0,
    "assessment-notes": Object.values(values.advisorNotes || {}).some((item) => String(item || "").trim())
  };
}

function legacyBucketList(lead, assessment) {
  if (assessment?.bucketList?.length) return assessment.bucketList;
  if (assessment?.goals?.primaryGoal) {
    const rows = [{
      ...createEmptyGoal({ primary: true }),
      id: "legacy-primary",
      name: assessment.goals.primaryGoal,
      targetAmount: assessment.goals.targetAmount ?? "",
      timeline: assessment.goals.timeline || "",
      monthlyContribution: calculateInvestmentPreferenceTotals(assessment.investmentPreferences).sipAmount || "",
      notes: assessment.goals.goalNotes || ""
    }];
    if (assessment.goals.secondaryGoal) {
      rows.push({
        ...createEmptyGoal(),
        id: "legacy-secondary",
        name: assessment.goals.secondaryGoal
      });
    }
    return rows;
  }

  return [{
    ...createEmptyGoal({ primary: true }),
    name: lead?.purposeOfInvestment || "",
    targetAmount: lead?.amount ?? "",
    notes: lead?.notes || ""
  }];
}

function makeInitialValues(lead, assessment) {
  return {
    assessmentDate: assessment?.assessmentDate || today,
    assessmentType: assessment?.assessmentType || "Initial Assessment",
    reassessmentReason: assessment?.reassessmentReason || "",
    personalProfile: {
      dateOfBirth: assessment?.personalProfile?.dateOfBirth || "",
      age: assessment?.personalProfile?.age ?? "",
      birthdayReminderEnabled: assessment?.personalProfile?.birthdayReminderEnabled !== false,
      birthdayReminderDaysBefore: assessment?.personalProfile?.birthdayReminderDaysBefore ?? 7,
      birthdayReminderOffsets: assessment?.personalProfile?.birthdayReminderOffsets?.length
        ? assessment.personalProfile.birthdayReminderOffsets
        : [assessment?.personalProfile?.birthdayReminderDaysBefore ?? 7],
      occupation: assessment?.personalProfile?.occupation || "",
      annualIncome: assessment?.personalProfile?.annualIncome ?? "",
      monthlySurplusMode: assessment?.personalProfile?.monthlySurplusMode || "fixed",
      monthlySurplusPercentage: assessment?.personalProfile?.monthlySurplusPercentage ?? "",
      monthlySurplus: assessment?.personalProfile?.monthlySurplus ?? "",
      numberOfDependants: assessment?.personalProfile?.numberOfDependants ?? "",
      maritalStatus: assessment?.personalProfile?.maritalStatus || "",
      currentInvestments: assessment?.personalProfile?.currentInvestments || "",
      activeLiabilities: assessment?.personalProfile?.activeLiabilities || ""
    },
    bucketList: legacyBucketList(lead, assessment),
    existingInvestments: assessment?.existingInvestments?.length
      ? assessment.existingInvestments
      : assessment?.personalProfile?.currentInvestments
        ? [{ ...createEmptyInvestment(), type: "Other", notes: assessment.personalProfile.currentInvestments }]
        : [],
    liabilities: assessment?.liabilities?.length
      ? assessment.liabilities
      : assessment?.personalProfile?.activeLiabilities
        ? [{ ...createEmptyLiability(), type: "Other", notes: assessment.personalProfile.activeLiabilities }]
        : [],
    surplusAllocations: assessment?.surplusAllocations?.length ? assessment.surplusAllocations : [],
    investmentPreferences: getInvestmentPreferenceRows(assessment?.investmentPreferences).length
      ? getInvestmentPreferenceRows(assessment?.investmentPreferences)
      : [createEmptyInvestmentPreference()],
    riskAssessment: {
      marketFallResponse: assessment?.riskAssessment?.marketFallResponse ?? "",
      investmentHorizon: assessment?.riskAssessment?.investmentHorizon ?? "",
      expectedReturn: assessment?.riskAssessment?.expectedReturn ?? "",
      investableSavings: assessment?.riskAssessment?.investableSavings ?? "",
      advisorOverride: assessment?.riskAssessment?.advisorOverride || "",
      overrideReason: assessment?.riskAssessment?.overrideReason || ""
    },
    qualification: {
      goalDefined: assessment?.qualification?.goalDefined ?? 0,
      monthlySurplusConfirmed: assessment?.qualification?.monthlySurplusConfirmed ?? 0,
      timelineSuitable: assessment?.qualification?.timelineSuitable ?? 0,
      liabilitiesManageable: assessment?.qualification?.liabilitiesManageable ?? 0
    },
    advisorNotes: {
      keyConcerns: assessment?.advisorNotes?.keyConcerns || "",
      objections: assessment?.advisorNotes?.objections || "",
      familyDynamics: assessment?.advisorNotes?.familyDynamics || "",
      additionalContext: assessment?.advisorNotes?.additionalContext || ""
    }
  };
}

function SectionHeading({ number, title, subtitle, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-700",
    green: "bg-emerald-700",
    amber: "bg-amber-700",
    red: "bg-red-700",
    violet: "bg-violet-700",
    slate: "bg-slate-700"
  };
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black text-white ${tones[tone] || tones.blue}`}>{number}</span>
      <div>
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function ScorePill({ label, value, tone }) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800"
  };
  return (
    <div className={`rounded-2xl border p-4 ${styles[tone] || styles.blue}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function SummaryPanel({ lead, values, assessment, versions, saving, converting, onConvert }) {
  const riskScore = calculateRiskScore(values.riskAssessment);
  const calculatedProfile = calculateRiskProfile(riskScore);
  const finalProfile = values.riskAssessment.advisorOverride || calculatedProfile;
  const qualificationScore = calculateQualificationScore(values.qualification);
  const qualificationStatus = getQualificationStatus(qualificationScore);
  const statusTone = qualificationStatus === "Qualified" ? "green" : qualificationStatus === "Not Ready" ? "red" : "amber";
  const canConvert = assessment?.status === ASSESSMENT_STATUS.COMPLETED && qualificationStatus === "Qualified" && !lead.convertedInvestorId;
  const primaryGoal = getPrimaryGoal(values.bucketList);
  const preferenceTotals = calculateInvestmentPreferenceTotals(values.investmentPreferences);

  return (
    <div className="grid content-start gap-4 xl:sticky xl:top-24">
      <Card className="overflow-hidden">
        <div className="bg-slate-950 p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Live assessment summary</p>
          <h2 className="mt-2 text-xl font-black">{lead.fullName}</h2>
          <p className="mt-1 text-sm text-slate-300">{lead.leadCode} · {lead.assignedAdvisorName}</p>
        </div>
        <div className="grid gap-3 p-5">
          <ScorePill label="Risk score" value={`${riskScore} / 20`} tone="blue" />
          <ScorePill label="Risk profile" value={finalProfile || "Pending"} tone={finalProfile === "AGGRESSIVE" ? "red" : finalProfile === "MODERATE" ? "amber" : "green"} />
          <ScorePill label="Qualification" value={`${qualificationStatus} · ${qualificationScore} / 5`} tone={statusTone} />
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recommended profile</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{getRecommendedProfile(finalProfile)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Bucket-list brief</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Primary goal</dt><dd className="text-right font-bold text-slate-900">{primaryGoal?.name || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Goals</dt><dd className="text-right font-bold text-slate-900">{values.bucketList.length}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Combined target</dt><dd className="text-right font-bold text-slate-900">{formatCurrency(calculateTotalGoalTarget(values.bucketList))}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Preference plans</dt><dd className="text-right font-bold text-slate-900">{preferenceTotals.count}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Total SIP / Lump sum</dt><dd className="text-right font-bold text-slate-900">{formatCurrency(preferenceTotals.sipAmount)} / {formatCurrency(preferenceTotals.lumpSumAmount)}</dd></div>
            </dl>
          </div>
        </div>
      </Card>

      {assessment?.status === ASSESSMENT_STATUS.COMPLETED ? (
        <Link href={`/leads/${lead.id}/assessment/summary`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
          <FileText size={18} /> Proposal summary / print
        </Link>
      ) : null}

      {lead.convertedInvestorId ? (
        <Link href={`/investors/${lead.convertedInvestorId}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800">
          <UserRoundCheck size={18} /> Open investor profile
        </Link>
      ) : (
        <Button type="button" onClick={onConvert} disabled={!canConvert || saving || converting} className="w-full">
          <UserRoundCheck size={18} /> {converting ? "Converting…" : "Convert to investor"}
        </Button>
      )}

      {!lead.convertedInvestorId && !canConvert ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-800">
          Complete the assessment with a qualification score of at least 4/5 to enable investor conversion.
        </p>
      ) : null}

      <Card className="p-5">
        <div className="flex items-center gap-2"><History size={17} className="text-blue-700" /><p className="font-black text-slate-950">Assessment history</p></div>
        <div className="mt-4 grid gap-3">
          {versions.length ? versions.slice(0, 6).map((version) => (
            <div key={version.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-900">Version {version.versionNumber}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${version.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{version.status}</span></div>
              <p className="mt-1 text-xs text-slate-500">{version.savedByName || version.updatedByName || "User"} · {formatDate(version.savedAt || version.updatedAt)}</p>
              <p className="mt-2 text-xs font-semibold text-slate-700">{version.riskAssessment?.finalProfile || "Risk pending"} · {version.qualification?.status || "Qualification pending"}</p>
              {version.reassessmentReason ? <p className="mt-1 text-xs text-slate-500">Reason: {version.reassessmentReason}</p> : null}
            </div>
          )) : <p className="text-sm text-slate-500">History appears after the first save.</p>}
        </div>
      </Card>
    </div>
  );
}

export default function AssessmentPageClient({ leadId }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [lead, setLead] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [versions, setVersions] = useState([]);
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [editing, setEditing] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState(ASSESSMENT_SECTIONS[0].id);

  useEffect(() => {
    if (!profile || !leadId) return undefined;
    let leadLoaded = false;
    let assessmentLoaded = false;
    let latestLead = null;
    let latestAssessment = null;

    function hydrate() {
      if (!leadLoaded || !assessmentLoaded) return;
      setLead(latestLead);
      setAssessment(latestAssessment);
      setValues(makeInitialValues(latestLead, latestAssessment));
      setEditing(latestAssessment?.status !== ASSESSMENT_STATUS.COMPLETED && !latestLead?.convertedInvestorId);
      setDirty(false);
      setLoading(false);
    }

    const unsubscribeLead = subscribeLead(leadId, (item) => {
      latestLead = item;
      leadLoaded = true;
      hydrate();
    }, (error) => {
      console.error(error);
      setFormError("Unable to load the linked lead.");
      setLoading(false);
    });

    const unsubscribeAssessment = subscribeAssessment(leadId, (item) => {
      latestAssessment = item;
      assessmentLoaded = true;
      hydrate();
    }, (error) => {
      console.error(error);
      setFormError("Unable to load the client assessment.");
      setLoading(false);
    });

    const unsubscribeVersions = subscribeAssessmentVersions(leadId, profile, setVersions, (error) => {
      console.error("Unable to load assessment history", error);
    });

    return () => {
      unsubscribeLead?.();
      unsubscribeAssessment?.();
      unsubscribeVersions?.();
    };
  }, [leadId, profile]);

  useEffect(() => {
    if (!values) return undefined;
    const elements = ASSESSMENT_SECTIONS.map((item) => document.getElementById(item.id)).filter(Boolean);
    if (!elements.length || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-18% 0px -62% 0px", threshold: [0.05, 0.2, 0.5] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [values]);

  function scrollToSection(id) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    function warn(event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const riskScore = useMemo(() => calculateRiskScore(values?.riskAssessment), [values]);
  const calculatedRiskProfile = useMemo(() => calculateRiskProfile(riskScore), [riskScore]);
  const qualificationScore = useMemo(() => calculateQualificationScore(values?.qualification), [values]);
  const qualificationStatus = useMemo(() => getQualificationStatus(qualificationScore), [qualificationScore]);
  const readOnly = Boolean(lead?.convertedInvestorId) || (assessment?.status === ASSESSMENT_STATUS.COMPLETED && !editing);
  const sectionProgress = useMemo(() => assessmentSectionProgress(values), [values]);
  const progressItems = useMemo(() => ASSESSMENT_SECTIONS.map((item, index) => ({ ...item, number: index + 1, complete: Boolean(sectionProgress[item.id]) })), [sectionProgress]);

  function markChanged() {
    setDirty(true);
    setNotice("");
  }

  function updateSection(section, field, value) {
    setValues((current) => {
      const nextSection = section === "personalProfile"
        ? recalculatePersonalProfile({ ...current[section], [field]: value })
        : { ...current[section], [field]: value };
      return { ...current, [section]: nextSection };
    });
    setErrors((current) => ({
      ...current,
      [`${section}.${field}`]: undefined,
      ...(section === "personalProfile" ? {
        "personalProfile.age": undefined,
        "personalProfile.monthlySurplus": undefined,
        "personalProfile.monthlySurplusPercentage": undefined,
        "personalProfile.annualIncome": undefined
      } : {})
    }));
    markChanged();
  }

  function updateArray(section, index, field, value) {
    setValues((current) => ({
      ...current,
      [section]: current[section].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
    setErrors((current) => ({ ...current, [`${section}.${index}.${field}`]: undefined }));
    markChanged();
  }

  function addRow(section, factory) {
    setValues((current) => ({ ...current, [section]: [...current[section], factory()] }));
    markChanged();
  }

  function removeRow(section, index) {
    setValues((current) => ({ ...current, [section]: current[section].filter((_, itemIndex) => itemIndex !== index) }));
    markChanged();
  }

  function setPrimaryGoal(index) {
    setValues((current) => ({
      ...current,
      bucketList: current.bucketList.map((goal, goalIndex) => ({ ...goal, isPrimary: goalIndex === index }))
    }));
    setErrors((current) => ({ ...current, "bucketList.0.isPrimary": undefined, [`bucketList.${index}.isPrimary`]: undefined }));
    markChanged();
  }

  function issueMap(result) {
    const nextErrors = {};
    for (const issue of result.error.issues) nextErrors[issue.path.join(".")] = issue.message;
    return nextErrors;
  }

  async function persist({ complete }) {
    setFormError("");
    setNotice("");
    const result = complete ? validateCompletedAssessment(values) : assessmentSchema.safeParse(values);
    if (!result.success) {
      setErrors(issueMap(result));
      setFormError("Review the highlighted fields before continuing.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveAssessment(lead, result.data, profile, { complete, existingAssessment: assessment });
      const merged = { ...assessment, ...saved, id: lead.id, status: complete ? ASSESSMENT_STATUS.COMPLETED : ASSESSMENT_STATUS.DRAFT };
      setAssessment(merged);
      setValues(makeInitialValues(lead, merged));
      setErrors({});
      setDirty(false);
      setEditing(!complete);
      setNotice(complete ? "Assessment completed successfully." : "Draft saved successfully.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);
      setFormError(error.message || "Assessment could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert() {
    if (!window.confirm(`Convert ${lead.fullName} into an investor profile with ${values.bucketList.length} financial goal(s)?`)) return;
    setFormError("");
    setConverting(true);
    try {
      const investor = await convertLeadToInvestor(lead, assessment, profile);
      setDirty(false);
      router.push(`/investors/${investor.id}`);
    } catch (error) {
      console.error(error);
      setFormError(error.message || "Lead could not be converted to an investor.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setConverting(false);
    }
  }

  if (loading || !values) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading client assessment…</div>;
  if (!lead) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">The linked lead could not be found.</div>;

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={16} /> Back to lead</Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Client assessment</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${assessment?.status === ASSESSMENT_STATUS.COMPLETED ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {assessment?.status === ASSESSMENT_STATUS.COMPLETED ? `Completed · v${assessment.versionNumber || 1}` : assessment ? `Draft · v${assessment.versionNumber || 1}` : "New"}
            </span>
            {readOnly ? <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">Read only</span> : null}
          </div>
          <p className="mt-2 text-sm text-slate-600">SOP 1 assessment and bucket-list planning for {lead.fullName} · {lead.leadCode}</p>
          {assessment?.updatedByName ? <p className="mt-1 text-xs text-slate-500">Last updated by {assessment.updatedByName} · {formatDate(assessment.updatedAt)}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {assessment?.status === ASSESSMENT_STATUS.COMPLETED && !lead.convertedInvestorId && !editing ? (
            <Button type="button" variant="secondary" onClick={() => {
              setEditing(true);
              setValues((current) => ({ ...current, assessmentType: "Reassessment", reassessmentReason: "" }));
              setDirty(true);
            }}><Edit3 size={17} /> Start reassessment</Button>
          ) : null}
          {!readOnly ? (
            <>
              <Button type="button" variant="secondary" onClick={() => persist({ complete: false })} disabled={saving || converting}><Save size={17} /> Save draft</Button>
              <Button type="button" onClick={() => persist({ complete: true })} disabled={saving || converting}><CheckCircle2 size={17} /> {saving ? "Saving…" : assessment?.status === ASSESSMENT_STATUS.COMPLETED ? "Save reassessment" : "Complete assessment"}</Button>
            </>
          ) : null}
        </div>
      </div>

      {formError ? <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"><AlertTriangle size={20} className="mt-0.5 shrink-0" /><p>{formError}</p></div> : null}
      {notice ? <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 size={20} className="mt-0.5 shrink-0" /><p>{notice}</p></div> : null}
      {dirty ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">You have unsaved changes. Save the draft before leaving this page.</div> : null}

      <div className="xl:hidden">
        <ProgressNav items={progressItems} activeId={activeSection} onSelect={scrollToSection} compact title="Assessment sections" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_350px]">
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <ProgressNav items={progressItems} activeId={activeSection} onSelect={scrollToSection} title="Assessment progress" description="Move between sections without losing entered information." />
          </div>
        </aside>
        <fieldset disabled={readOnly} className="grid min-w-0 gap-6 disabled:opacity-[0.92]">
          <Card id="assessment-linked" className="scroll-mt-28 p-5 sm:p-7">
            <SectionHeading number="1" title="Linked details" subtitle="Lead identity and advisor assignment are inherited from the lead record." />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Lead ID"><input className={`${inputClassName} bg-slate-50`} value={lead.leadCode || ""} readOnly /></Field>
              <Field label="Full name"><input className={`${inputClassName} bg-slate-50`} value={lead.fullName || ""} readOnly /></Field>
              <Field label="Assessment date" required error={errors.assessmentDate}><input className={inputClassName} type="date" value={values.assessmentDate} onChange={(event) => { setValues((current) => ({ ...current, assessmentDate: event.target.value })); setErrors((current) => ({ ...current, assessmentDate: undefined })); markChanged(); }} /></Field>
              <Field label="Assessment type"><select className={inputClassName} value={values.assessmentType} onChange={(event) => { setValues((current) => ({ ...current, assessmentType: event.target.value })); markChanged(); }}><option>Initial Assessment</option><option>Reassessment</option></select></Field>
              {values.assessmentType === "Reassessment" ? <Field label="Reason for reassessment" required error={errors.reassessmentReason}><input className={inputClassName} value={values.reassessmentReason} onChange={(event) => { setValues((current) => ({ ...current, reassessmentReason: event.target.value })); setErrors((current) => ({ ...current, reassessmentReason: undefined })); markChanged(); }} placeholder="Example: goals changed or annual review" /></Field> : null}
              <Field label="Contact number"><input className={`${inputClassName} bg-slate-50`} value={lead.contactNo || ""} readOnly /></Field>
              <Field label="Email"><input className={`${inputClassName} bg-slate-50`} value={lead.email || ""} readOnly /></Field>
              <Field label="Lead source"><input className={`${inputClassName} bg-slate-50`} value={lead.leadSource || ""} readOnly /></Field>
              <Field label="Advisor"><input className={`${inputClassName} bg-slate-50`} value={lead.assignedAdvisorName || ""} readOnly /></Field>
            </div>
          </Card>

          <Card id="assessment-profile" className="scroll-mt-28 p-5 sm:p-7">
            <SectionHeading number="2" title="Personal and financial profile" subtitle="Capture the client's financial capacity and current obligations." tone="blue" />
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Date of birth" error={errors["personalProfile.dateOfBirth"]}><input className={inputClassName} type="date" max={today} value={values.personalProfile.dateOfBirth} onChange={(event) => updateSection("personalProfile", "dateOfBirth", event.target.value)} /></Field>
              <Field label="Age" error={errors["personalProfile.age"]} hint={values.personalProfile.dateOfBirth ? "Calculated automatically from date of birth" : "Enter age when date of birth is unavailable"}><input className={`${inputClassName} ${values.personalProfile.dateOfBirth ? "bg-slate-50" : ""}`} type="number" min="18" max="120" value={values.personalProfile.age} readOnly={Boolean(values.personalProfile.dateOfBirth)} onChange={(event) => updateSection("personalProfile", "age", event.target.value)} /></Field>
              <Field label="Birthday reminder"><select className={inputClassName} value={values.personalProfile.birthdayReminderEnabled ? "on" : "off"} onChange={(event) => updateSection("personalProfile", "birthdayReminderEnabled", event.target.value === "on")}><option value="on">Enabled</option><option value="off">Disabled</option></select></Field>
              <div className="md:col-span-2"><Field label="Birthday reminder schedule" hint="Internal Advisor reminders only; no automatic Investor message."><div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">{BIRTHDAY_REMINDER_OPTIONS.map((days) => { const offsets = values.personalProfile.birthdayReminderOffsets?.length ? values.personalProfile.birthdayReminderOffsets : DEFAULT_BIRTHDAY_REMINDER_OFFSETS; const selected = offsets.includes(days); return <button key={days} type="button" disabled={!values.personalProfile.birthdayReminderEnabled} onClick={() => updateSection("personalProfile", "birthdayReminderOffsets", selected ? offsets.filter((item) => item !== days) : [...offsets, days].sort((a, b) => b - a))} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{days === 0 ? "On birthday" : `${days} day${days === 1 ? "" : "s"} before`}</button>; })}</div></Field></div>
              <Field label="Occupation" error={errors["personalProfile.occupation"]}><select className={inputClassName} value={values.personalProfile.occupation} onChange={(event) => updateSection("personalProfile", "occupation", event.target.value)}><option value="">Select occupation</option>{OCCUPATIONS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Annual income (INR)" error={errors["personalProfile.annualIncome"]}><input className={inputClassName} type="number" min="0" value={values.personalProfile.annualIncome} onChange={(event) => updateSection("personalProfile", "annualIncome", event.target.value)} /></Field>
              <Field label="Surplus method"><select className={inputClassName} value={values.personalProfile.monthlySurplusMode} onChange={(event) => updateSection("personalProfile", "monthlySurplusMode", event.target.value)}><option value="fixed">Fixed monthly amount</option><option value="percentage">Percentage of monthly income</option></select></Field>
              {values.personalProfile.monthlySurplusMode === "percentage" ? <Field label="Surplus percentage" error={errors["personalProfile.monthlySurplusPercentage"]} hint="Calculated on annual income divided by 12"><div className="relative"><input className={`${inputClassName} pr-10`} type="number" min="0" max="100" step="0.1" value={values.personalProfile.monthlySurplusPercentage} onChange={(event) => updateSection("personalProfile", "monthlySurplusPercentage", event.target.value)} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span></div></Field> : <Field label="Monthly surplus (INR)" error={errors["personalProfile.monthlySurplus"]}><input className={inputClassName} type="number" min="0" value={values.personalProfile.monthlySurplus} onChange={(event) => updateSection("personalProfile", "monthlySurplus", event.target.value)} /></Field>}
              {values.personalProfile.monthlySurplusMode === "percentage" ? <Field label="Calculated monthly surplus" hint="Auto-calculated and saved as the investable monthly amount"><input className={`${inputClassName} bg-emerald-50 font-bold text-emerald-800`} value={formatCurrency(values.personalProfile.monthlySurplus)} readOnly /></Field> : null}
              <Field label="Number of dependants" error={errors["personalProfile.numberOfDependants"]}><input className={inputClassName} type="number" min="0" value={values.personalProfile.numberOfDependants} onChange={(event) => updateSection("personalProfile", "numberOfDependants", event.target.value)} /></Field>
              <Field label="Marital status" error={errors["personalProfile.maritalStatus"]}><select className={inputClassName} value={values.personalProfile.maritalStatus} onChange={(event) => updateSection("personalProfile", "maritalStatus", event.target.value)}><option value="">Select status</option>{MARITAL_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
            </div>
            <div className="mt-8 border-t border-slate-200 pt-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Monthly surplus allocation</p><p className="mt-1 text-sm text-slate-500">Allocate the available surplus between investments, loan repayment, emergency fund, insurance, goals, tax/cash reserve or trading capital.</p><div className="mt-5"><SurplusAllocationEditor rows={values.surplusAllocations} monthlySurplus={values.personalProfile.monthlySurplus} errors={errors} disabled={readOnly} onAdd={() => addRow("surplusAllocations", createEmptySurplusAllocation)} onRemove={(index) => removeRow("surplusAllocations", index)} onChange={(index, field, value) => updateArray("surplusAllocations", index, field, value)} /></div></div>
          </Card>

          <Card id="assessment-goals" className="scroll-mt-28 p-5 sm:p-7">
            <SectionHeading number="3" title="Goals, corpus and Bucket List" subtitle="Goals are optional. Keep wealth as General Wealth Corpus or define one or more financial goals." tone="green" />
            <GoalBucketEditor
              goals={values.bucketList}
              errors={errors}
              disabled={readOnly}
              onAdd={() => addRow("bucketList", createEmptyGoal)}
              onRemove={(index) => removeRow("bucketList", index)}
              onChange={(index, field, value) => updateArray("bucketList", index, field, value)}
              onSetPrimary={setPrimaryGoal}
            />
          </Card>

          <Card id="assessment-investments" className="scroll-mt-28 p-5 sm:p-7">
            <SectionHeading number="4" title="Existing investments" subtitle="Capture the client's current portfolio as structured records." tone="green" />
            <ExistingInvestmentsEditor
              rows={values.existingInvestments}
              errors={errors}
              disabled={readOnly}
              onAdd={() => addRow("existingInvestments", createEmptyInvestment)}
              onRemove={(index) => removeRow("existingInvestments", index)}
              onChange={(index, field, value) => updateArray("existingInvestments", index, field, value)}
            />
          </Card>

          <Card id="assessment-liabilities" className="scroll-mt-28 p-5 sm:p-7">
            <SectionHeading number="5" title="Liabilities and EMIs" subtitle="Record active loans and obligations that may affect investable capacity." tone="red" />
            <LiabilitiesEditor
              rows={values.liabilities}
              errors={errors}
              disabled={readOnly}
              onAdd={() => addRow("liabilities", createEmptyLiability)}
              onRemove={(index) => removeRow("liabilities", index)}
              onChange={(index, field, value) => updateArray("liabilities", index, field, value)}
            />
          </Card>

          <Card id="assessment-preferences" className="scroll-mt-28 p-5 sm:p-7">
            <SectionHeading number="6" title="Investment preferences" subtitle="Add multiple contribution plans with separate type, frequency, amounts and advisory areas." tone="amber" />
            <InvestmentPreferencesEditor
              rows={values.investmentPreferences}
              errors={errors}
              disabled={readOnly}
              onAdd={() => addRow("investmentPreferences", createEmptyInvestmentPreference)}
              onRemove={(index) => removeRow("investmentPreferences", index)}
              onChange={(index, field, value) => updateArray("investmentPreferences", index, field, value)}
            />
          </Card>

          <Card id="assessment-risk" className="scroll-mt-28 p-5 sm:p-7">
            <SectionHeading number="7" title="Risk profile" subtitle="Each response carries 1-5 points. The profile is calculated automatically from the 20-point score." tone="red" />
            <div className="grid gap-4">
              {RISK_QUESTIONS.map((item, index) => (
                <div key={item.key} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_280px] lg:items-center">
                    <div><p className="font-bold text-slate-950">Q{index + 1}. {item.question}</p><p className="mt-1 text-xs text-slate-500">{item.helper}</p></div>
                    <Field label="Response" required error={errors[`riskAssessment.${item.key}`]}>
                      <select className={inputClassName} value={values.riskAssessment[item.key]} onChange={(event) => updateSection("riskAssessment", item.key, event.target.value)}>
                        <option value="">Select answer</option>
                        {item.options.map((option) => <option key={option.value} value={option.value}>{option.value} — {option.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-4 rounded-2xl bg-slate-950 p-5 text-white md:grid-cols-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total risk score</p><p className="mt-2 text-2xl font-black">{riskScore} / 20</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Calculated profile</p><p className="mt-2 text-2xl font-black text-cyan-300">{calculatedRiskProfile || "Pending"}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Final profile</p><p className="mt-2 text-2xl font-black text-emerald-300">{values.riskAssessment.advisorOverride || calculatedRiskProfile || "Pending"}</p></div>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field label="Advisor override" hint="Leave blank to accept the calculated profile"><select className={inputClassName} value={values.riskAssessment.advisorOverride} onChange={(event) => updateSection("riskAssessment", "advisorOverride", event.target.value)}><option value="">Use calculated profile</option>{RISK_PROFILES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Override reason" error={errors["riskAssessment.overrideReason"]}><input className={inputClassName} value={values.riskAssessment.overrideReason} onChange={(event) => updateSection("riskAssessment", "overrideReason", event.target.value)} disabled={!values.riskAssessment.advisorOverride} placeholder="Required when overriding" /></Field>
            </div>
          </Card>

          <Card id="assessment-qualification" className="scroll-mt-28 p-5 sm:p-7">
            <SectionHeading number="8" title="Qualification score" subtitle="Goal clarity carries 2 points; the other three criteria carry 1 point each." tone="violet" />
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_220px] md:items-center"><div><p className="font-bold text-slate-900">Clear investment goal defined</p><p className="text-xs text-slate-500">Maximum 2 points</p></div><select className={inputClassName} value={values.qualification.goalDefined} onChange={(event) => updateSection("qualification", "goalDefined", event.target.value)}><option value={0}>0 — Not defined</option><option value={1}>1 — Partially defined</option><option value={2}>2 — Clearly defined</option></select></div>
              <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_220px] md:items-center"><div><p className="font-bold text-slate-900">Monthly surplus / investable amount confirmed</p><p className="text-xs text-slate-500">Maximum 1 point</p></div><select className={inputClassName} value={values.qualification.monthlySurplusConfirmed} onChange={(event) => updateSection("qualification", "monthlySurplusConfirmed", event.target.value)}><option value={0}>0 — No</option><option value={1}>1 — Yes</option></select></div>
              <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_220px] md:items-center"><div><p className="font-bold text-slate-900">Timeline of 3+ years</p><p className="text-xs text-slate-500">Maximum 1 point</p></div><select className={inputClassName} value={values.qualification.timelineSuitable} onChange={(event) => updateSection("qualification", "timelineSuitable", event.target.value)}><option value={0}>0 — No</option><option value={1}>1 — Yes</option></select></div>
              <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_220px] md:items-center"><div><p className="font-bold text-slate-900">No major liabilities blocking investment</p><p className="text-xs text-slate-500">Maximum 1 point</p></div><select className={inputClassName} value={values.qualification.liabilitiesManageable} onChange={(event) => updateSection("qualification", "liabilitiesManageable", event.target.value)}><option value={0}>0 — No</option><option value={1}>1 — Yes</option></select></div>
            </div>
            <div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl bg-violet-50 p-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-600">Total qualification score</p><p className="mt-1 text-2xl font-black text-violet-950">{qualificationScore} / 5</p></div><span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${qualificationStatus === "Qualified" ? "bg-emerald-100 text-emerald-800" : qualificationStatus === "Not Ready" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{qualificationStatus}</span></div>
          </Card>

          <Card id="assessment-notes" className="scroll-mt-28 p-5 sm:p-7">
            <SectionHeading number="9" title="Advisor notes" subtitle="Internal context used for future meetings and proposal preparation." tone="slate" />
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Key concerns raised"><textarea className={`${inputClassName} min-h-28 resize-y`} value={values.advisorNotes.keyConcerns} onChange={(event) => updateSection("advisorNotes", "keyConcerns", event.target.value)} /></Field>
              <Field label="Objections / hesitations"><textarea className={`${inputClassName} min-h-28 resize-y`} value={values.advisorNotes.objections} onChange={(event) => updateSection("advisorNotes", "objections", event.target.value)} /></Field>
              <Field label="Family dynamics / influencers"><textarea className={`${inputClassName} min-h-28 resize-y`} value={values.advisorNotes.familyDynamics} onChange={(event) => updateSection("advisorNotes", "familyDynamics", event.target.value)} /></Field>
              <Field label="Additional context"><textarea className={`${inputClassName} min-h-28 resize-y`} value={values.advisorNotes.additionalContext} onChange={(event) => updateSection("advisorNotes", "additionalContext", event.target.value)} /></Field>
            </div>
          </Card>

          {!readOnly ? (
            <div className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_50px_rgba(15,23,42,0.16)] backdrop-blur sm:static sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button type="button" variant="secondary" onClick={() => persist({ complete: false })} disabled={saving || converting}><Save size={17} /> Save draft</Button>
                <Button type="button" onClick={() => persist({ complete: true })} disabled={saving || converting}><ClipboardCheck size={17} /> {saving ? "Saving…" : assessment?.status === ASSESSMENT_STATUS.COMPLETED ? "Save reassessment" : "Complete assessment"}</Button>
              </div>
            </div>
          ) : null}
        </fieldset>

        <SummaryPanel lead={lead} values={values} assessment={assessment} versions={versions} saving={saving} converting={converting} onConvert={handleConvert} />
      </div>
    </div>
  );
}
