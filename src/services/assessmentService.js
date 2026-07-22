import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { USER_ROLES } from "@/lib/constants/roles";
import {
  ASSESSMENT_STATUS,
  calculateQualificationScore,
  calculateRiskProfile,
  calculateRiskScore,
  getPrimaryGoal,
  getQualificationStatus,
  getRecommendedProfile
} from "@/lib/constants/assessment";

function isPrivileged(currentUser) {
  return [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(currentUser.role);
}

export function sanitizeForFirestore(value) {
  if (value === undefined) return null;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item));
  }

  if (
    value !== null
    && typeof value === "object"
    && Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeForFirestore(item)])
    );
  }

  return value;
}

function removeEmptyRows(rows = [], identifyingFields = []) {
  return rows.filter((row) => identifyingFields.some((field) => {
    const value = row?.[field];
    return value !== "" && value !== null && value !== undefined && value !== 0;
  }));
}

function normaliseBucketList(bucketList = []) {
  const usable = removeEmptyRows(bucketList, ["name", "targetAmount", "timeline", "targetYear", "notes"]);
  return usable.map((goal, index) => ({
    ...goal,
    id: goal.id || `goal-${index + 1}`,
    name: goal.name || "",
    targetAmount: Number(goal.targetAmount || 0),
    currentAmount: Number(goal.currentAmount || 0),
    targetYear: goal.targetYear ? Number(goal.targetYear) : null,
    monthlyContribution: Number(goal.monthlyContribution || 0),
    priority: goal.priority || "Medium",
    type: goal.type || "Flexible",
    status: goal.status || "Planning",
    notes: goal.notes || "",
    isPrimary: Boolean(goal.isPrimary)
  }));
}

function normaliseInvestments(rows = []) {
  return removeEmptyRows(rows, ["type", "institution", "currentValue", "monthlyContribution", "notes"])
    .map((item, index) => ({
      ...item,
      id: item.id || `investment-${index + 1}`,
      type: item.type || "",
      institution: item.institution || "",
      currentValue: Number(item.currentValue || 0),
      monthlyContribution: Number(item.monthlyContribution || 0),
      startDate: item.startDate || "",
      maturityDate: item.maturityDate || "",
      notes: item.notes || ""
    }));
}

function normaliseLiabilities(rows = []) {
  return removeEmptyRows(rows, ["type", "lender", "outstandingAmount", "emiAmount", "notes"])
    .map((item, index) => ({
      ...item,
      id: item.id || `liability-${index + 1}`,
      type: item.type || "",
      lender: item.lender || "",
      outstandingAmount: Number(item.outstandingAmount || 0),
      emiAmount: Number(item.emiAmount || 0),
      interestRate: Number(item.interestRate || 0),
      remainingTenure: item.remainingTenure || "",
      notes: item.notes || ""
    }));
}

function normaliseInvestmentPreferences(value = []) {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? [value]
      : [];

  return rows
    .filter((item) =>
      item?.investmentType
      || Number(item?.sipAmount || 0) > 0
      || Number(item?.lumpSumAmount || 0) > 0
      || (Array.isArray(item?.productsOfInterest) && item.productsOfInterest.length > 0)
    )
    .map((item, index) => ({
      id: item.id || `preference-${index + 1}`,
      investmentType: item.investmentType || "",
      preferredFrequency: item.preferredFrequency || "Monthly",
      sipAmount: Number(item.sipAmount || 0),
      lumpSumAmount: Number(item.lumpSumAmount || 0),
      productsOfInterest: Array.isArray(item.productsOfInterest) ? item.productsOfInterest : []
    }));
}

function getPreferenceTotals(value = []) {
  return normaliseInvestmentPreferences(value).reduce(
    (totals, item) => ({
      sipAmount: totals.sipAmount + item.sipAmount,
      lumpSumAmount: totals.lumpSumAmount + item.lumpSumAmount
    }),
    { sipAmount: 0, lumpSumAmount: 0 }
  );
}

function createActivity({ lead, currentUser, action, title, description, metadata = {} }) {
  return {
    recordType: "lead",
    recordId: lead.id,
    leadId: lead.id,
    leadCode: lead.leadCode,
    leadName: lead.fullName,
    advisorUid: lead.assignedAdvisorUid,
    assignedAdvisorUid: lead.assignedAdvisorUid,
    action,
    title,
    description,
    metadata,
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp()
  };
}

function deriveLegacyGoals(bucketList) {
  const primary = getPrimaryGoal(bucketList) || {};
  const secondary = bucketList.find((goal) => !goal.isPrimary) || {};
  return {
    primaryGoal: primary.name || "",
    targetAmount: Number(primary.targetAmount || 0),
    timeline: primary.timeline || (primary.targetYear ? `By ${primary.targetYear}` : ""),
    secondaryGoal: secondary.name || "",
    goalNotes: primary.notes || ""
  };
}

function normaliseAssessment(lead, payload, currentUser, status, versionNumber) {
  const riskScore = calculateRiskScore(payload.riskAssessment);
  const calculatedRiskProfile = calculateRiskProfile(riskScore);
  const finalRiskProfile = payload.riskAssessment.advisorOverride || calculatedRiskProfile;
  const qualificationScore = calculateQualificationScore(payload.qualification);
  const qualificationStatus = getQualificationStatus(qualificationScore);
  const bucketList = normaliseBucketList(payload.bucketList);
  const existingInvestments = normaliseInvestments(payload.existingInvestments);
  const liabilities = normaliseLiabilities(payload.liabilities);
  const investmentPreferences = normaliseInvestmentPreferences(payload.investmentPreferences);

  return {
    leadId: lead.id,
    leadCode: lead.leadCode,
    leadName: lead.fullName,
    contactNo: lead.contactNo || "",
    email: lead.email || "",
    leadSource: lead.leadSource || "",
    assignedAdvisorUid: lead.assignedAdvisorUid,
    assignedAdvisorName: lead.assignedAdvisorName,
    assessmentDate: payload.assessmentDate,
    assessmentType: payload.assessmentType || "Initial Assessment",
    reassessmentReason: payload.reassessmentReason || "",
    personalProfile: payload.personalProfile,
    bucketList,
    goals: deriveLegacyGoals(bucketList),
    existingInvestments,
    liabilities,
    investmentPreferences,
    riskAssessment: {
      ...payload.riskAssessment,
      totalScore: riskScore,
      calculatedProfile: calculatedRiskProfile,
      finalProfile: finalRiskProfile,
      recommendedProfile: getRecommendedProfile(finalRiskProfile)
    },
    qualification: {
      ...payload.qualification,
      totalScore: qualificationScore,
      status: qualificationStatus
    },
    advisorNotes: payload.advisorNotes,
    status,
    versionNumber,
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName,
    updatedAt: serverTimestamp()
  };
}

export function subscribeAssessment(leadId, callback, onError) {
  return onSnapshot(
    doc(db, "clientAssessments", leadId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export function subscribeAssessmentVersions(leadId, callback, onError) {
  return onSnapshot(
    query(
      collection(db, "assessmentVersions"),
      where("leadId", "==", leadId),
      orderBy("versionNumber", "desc"),
      limit(20)
    ),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function saveAssessment(
  lead,
  payload,
  currentUser,
  { complete = false, existingAssessment = null } = {}
) {
  if (lead.convertedInvestorId) {
    throw new Error("This assessment is locked because the lead has already been converted to an investor.");
  }

  const assessmentRef = doc(db, "clientAssessments", lead.id);
  const leadRef = doc(db, "leads", lead.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const versionRef = doc(collection(db, "assessmentVersions"));
  const status = complete ? ASSESSMENT_STATUS.COMPLETED : ASSESSMENT_STATUS.DRAFT;
  const versionNumber = Number(existingAssessment?.versionNumber || 0) + 1;
  const assessment = normaliseAssessment(lead, payload, currentUser, status, versionNumber);
  const batch = writeBatch(db);

  const assessmentWrite = {
    ...assessment,
    completedAt: complete ? serverTimestamp() : existingAssessment?.completedAt || null
  };

  if (!existingAssessment) {
    assessmentWrite.createdByUid = currentUser.id;
    assessmentWrite.createdByName = currentUser.fullName;
    assessmentWrite.createdAt = serverTimestamp();
  }

  batch.set(assessmentRef, sanitizeForFirestore(assessmentWrite), { merge: true });
  batch.set(versionRef, sanitizeForFirestore({
    ...assessment,
    assessmentId: lead.id,
    savedAs: status,
    savedByUid: currentUser.id,
    savedByName: currentUser.fullName,
    savedAt: serverTimestamp()
  }));

  const leadUpdates = {
    assessmentId: lead.id,
    assessmentStatus: status,
    assessmentCompletedAt: complete ? serverTimestamp() : existingAssessment?.completedAt || null,
    qualificationScore: assessment.qualification.totalScore,
    qualificationStatus: assessment.qualification.status,
    riskProfile: assessment.riskAssessment.finalProfile,
    goalCount: assessment.bucketList.length,
    primaryGoal: getPrimaryGoal(assessment.bucketList)?.name || "",
    updatedAt: serverTimestamp()
  };

  if (complete && ["NEW", "CONTACTED", "WARM", "NOT QUALIFIED"].includes(lead.status)) {
    const nextStatus = assessment.qualification.status === "Qualified"
      ? "QUALIFIED"
      : assessment.qualification.status === "Not Ready"
        ? "NOT QUALIFIED"
        : "WARM";

    if (nextStatus !== lead.status) {
      leadUpdates.status = nextStatus;
      leadUpdates.statusChangedAt = serverTimestamp();
      leadUpdates.stageEnteredAt = serverTimestamp();
    }
  }

  batch.update(leadRef, sanitizeForFirestore(leadUpdates));

  const wasCompleted = existingAssessment?.status === ASSESSMENT_STATUS.COMPLETED;
  const action = complete
    ? wasCompleted ? "assessment_reassessed" : "assessment_completed"
    : "assessment_saved";
  const title = complete
    ? wasCompleted ? "Client assessment updated" : "Client assessment completed"
    : "Client assessment saved as draft";

  batch.set(
    activityRef,
    sanitizeForFirestore(createActivity({
      lead,
      currentUser,
      action,
      title,
      description: complete
        ? `Version ${versionNumber}. ${assessment.bucketList.length} goal(s) and ${assessment.investmentPreferences.length} investment preference(s). Risk profile: ${assessment.riskAssessment.finalProfile}. Qualification: ${assessment.qualification.status} (${assessment.qualification.totalScore}/5).`
        : `Assessment version ${versionNumber} was saved as draft.`,
      metadata: {
        assessmentStatus: status,
        assessmentType: assessment.assessmentType,
        reassessmentReason: assessment.reassessmentReason,
        versionNumber,
        goalCount: assessment.bucketList.length,
        investmentPreferenceCount: assessment.investmentPreferences.length,
        riskScore: assessment.riskAssessment.totalScore,
        riskProfile: assessment.riskAssessment.finalProfile,
        previousRiskProfile: existingAssessment?.riskAssessment?.finalProfile || "",
        qualificationScore: assessment.qualification.totalScore,
        qualificationStatus: assessment.qualification.status
      }
    }))
  );

  await batch.commit();
  return { ...assessment, completedAt: assessmentWrite.completedAt };
}

function getAssessmentBucketList(assessment) {
  if (assessment?.bucketList?.length) return normaliseBucketList(assessment.bucketList);

  const legacy = assessment?.goals || {};
  const rows = [];
  if (legacy.primaryGoal) {
    rows.push({
      id: "legacy-primary",
      name: legacy.primaryGoal,
      targetAmount: Number(legacy.targetAmount || 0),
      currentAmount: 0,
      timeline: legacy.timeline || "",
      targetYear: null,
      monthlyContribution: getPreferenceTotals(assessment?.investmentPreferences).sipAmount,
      priority: "High",
      type: "Fixed",
      status: "Planning",
      notes: legacy.goalNotes || "",
      isPrimary: true
    });
  }
  if (legacy.secondaryGoal) {
    rows.push({
      id: "legacy-secondary",
      name: legacy.secondaryGoal,
      targetAmount: 0,
      currentAmount: 0,
      timeline: "",
      targetYear: null,
      monthlyContribution: 0,
      priority: "Medium",
      type: "Flexible",
      status: "Planning",
      notes: "",
      isPrimary: false
    });
  }
  return rows;
}

export async function convertLeadToInvestor(lead, assessment, currentUser) {
  if (!assessment || assessment.status !== ASSESSMENT_STATUS.COMPLETED) {
    throw new Error("Complete the client assessment before converting this lead.");
  }
  if (assessment.qualification?.status !== "Qualified") {
    throw new Error("Only a qualified assessment can be converted into an investor profile.");
  }

  return runTransaction(db, async (transaction) => {
    const leadRef = doc(db, "leads", lead.id);
    const leadSnapshot = await transaction.get(leadRef);
    if (!leadSnapshot.exists()) throw new Error("Lead no longer exists.");
    const latestLead = leadSnapshot.data();

    if (latestLead.convertedInvestorId) {
      return { id: latestLead.convertedInvestorId, clientCode: latestLead.convertedClientCode };
    }

    const counterRef = doc(db, "counters", "investors");
    const counterSnapshot = await transaction.get(counterRef);
    const currentValue = counterSnapshot.exists() ? Number(counterSnapshot.data().value || 0) : 0;
    const nextValue = currentValue + 1;
    const clientCode = `GV-CL-${new Date().getFullYear()}-${String(nextValue).padStart(4, "0")}`;
    const investorRef = doc(collection(db, "investors"));
    const activityRef = doc(collection(db, "activityLogs"));
    const bucketList = getAssessmentBucketList(assessment);
    const existingInvestments = normaliseInvestments(assessment.existingInvestments || []);
    const liabilities = normaliseLiabilities(assessment.liabilities || []);
    const investmentPreferences = normaliseInvestmentPreferences(assessment.investmentPreferences);

    const investor = {
      clientCode,
      fullName: latestLead.fullName,
      contactNo: latestLead.contactNo || "",
      email: latestLead.email || "",
      city: latestLead.city || "",
      status: "active",
      leadId: lead.id,
      leadCode: latestLead.leadCode,
      leadSource: latestLead.leadSource || "",
      assessmentId: lead.id,
      assessmentVersionNumber: Number(assessment.versionNumber || 1),
      assignedAdvisorUid: latestLead.assignedAdvisorUid,
      assignedAdvisorName: latestLead.assignedAdvisorName,
      advisorUid: latestLead.assignedAdvisorUid,
      advisorName: latestLead.assignedAdvisorName,
      personalProfile: assessment.personalProfile,
      investmentPreferences,
      riskAssessment: assessment.riskAssessment,
      qualification: assessment.qualification,
      advisorNotes: assessment.advisorNotes,
      bucketList,
      goals: bucketList,
      existingInvestments,
      liabilities,
      currentInvestments: assessment.personalProfile?.currentInvestments || "",
      activeLiabilities: assessment.personalProfile?.activeLiabilities || "",
      portalUid: null,
      portalEnabled: false,
      convertedAt: serverTimestamp(),
      investorSince: serverTimestamp(),
      createdByUid: currentUser.id,
      createdByName: currentUser.fullName,
      updatedByUid: currentUser.id,
      updatedByName: currentUser.fullName,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    transaction.set(counterRef, { value: nextValue, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(investorRef, sanitizeForFirestore(investor));
    transaction.update(leadRef, {
      status: "CONVERTED",
      convertedInvestorId: investorRef.id,
      convertedClientCode: clientCode,
      convertedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.update(doc(db, "clientAssessments", lead.id), {
      convertedInvestorId: investorRef.id,
      convertedClientCode: clientCode,
      convertedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.set(activityRef, sanitizeForFirestore({
      recordType: "lead",
      recordId: lead.id,
      leadId: lead.id,
      investorId: investorRef.id,
      leadCode: latestLead.leadCode,
      clientCode,
      leadName: latestLead.fullName,
      advisorUid: latestLead.assignedAdvisorUid,
      assignedAdvisorUid: latestLead.assignedAdvisorUid,
      action: "lead_converted_to_investor",
      title: "Lead converted to investor",
      description: `${latestLead.fullName} was converted to investor ${clientCode} with ${bucketList.length} financial goal(s).`,
      metadata: { goalCount: bucketList.length },
      createdByUid: currentUser.id,
      createdByName: currentUser.fullName,
      createdAt: serverTimestamp()
    }));

    return { id: investorRef.id, clientCode };
  });
}

export function subscribeInvestors(currentUser, callback, onError) {
  const constraints = isPrivileged(currentUser)
    ? [where("isDeleted", "==", false), orderBy("createdAt", "desc"), limit(100)]
    : [where("assignedAdvisorUid", "==", currentUser.id), where("isDeleted", "==", false), orderBy("createdAt", "desc"), limit(100)];

  return onSnapshot(
    query(collection(db, "investors"), ...constraints),
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export function subscribeInvestor(investorId, callback, onError) {
  return onSnapshot(
    doc(db, "investors", investorId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError
  );
}

export async function updateInvestorProfile(investor, payload, currentUser) {
  const investorRef = doc(db, "investors", investor.id);
  const activityRef = doc(collection(db, "activityLogs"));
  const batch = writeBatch(db);
  const bucketList = normaliseBucketList(payload.bucketList);
  const existingInvestments = normaliseInvestments(payload.existingInvestments);
  const liabilities = normaliseLiabilities(payload.liabilities);
  const investmentPreferences = normaliseInvestmentPreferences(payload.investmentPreferences);
  const primaryGoal = getPrimaryGoal(bucketList);

  const updates = {
    fullName: payload.fullName,
    contactNo: payload.contactNo,
    email: payload.email,
    city: payload.city || "",
    personalProfile: payload.personalProfile,
    investmentPreferences,
    advisorNotes: payload.advisorNotes,
    bucketList,
    goals: bucketList,
    existingInvestments,
    liabilities,
    currentInvestments: existingInvestments.map((item) => `${item.type}: ${item.institution || "Not specified"}`).join("\n"),
    activeLiabilities: liabilities.map((item) => `${item.type}: ${item.lender || "Not specified"}`).join("\n"),
    primaryGoal: primaryGoal?.name || "",
    goalCount: bucketList.length,
    updatedByUid: currentUser.id,
    updatedByName: currentUser.fullName,
    updatedAt: serverTimestamp()
  };

  batch.update(investorRef, sanitizeForFirestore(updates));
  batch.set(activityRef, sanitizeForFirestore({
    recordType: "investor",
    recordId: investor.id,
    investorId: investor.id,
    clientCode: investor.clientCode,
    leadId: investor.leadId,
    leadCode: investor.leadCode,
    leadName: payload.fullName,
    advisorUid: investor.assignedAdvisorUid,
    assignedAdvisorUid: investor.assignedAdvisorUid,
    action: "investor_profile_updated",
    title: "Investor profile updated",
    description: `${payload.fullName}'s profile was updated with ${bucketList.length} goal(s), ${investmentPreferences.length} investment preference(s), ${existingInvestments.length} investment(s) and ${liabilities.length} liability record(s).`,
    metadata: {
      goalCount: bucketList.length,
      investmentPreferenceCount: investmentPreferences.length,
      investmentCount: existingInvestments.length,
      liabilityCount: liabilities.length
    },
    createdByUid: currentUser.id,
    createdByName: currentUser.fullName,
    createdAt: serverTimestamp()
  }));

  await batch.commit();
  return { ...investor, ...updates };
}
