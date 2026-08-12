import { z } from "zod";
import {
  GOAL_PRIORITIES,
  GOAL_STATUSES,
  GOAL_TYPES,
  INVESTMENT_FREQUENCIES,
  INVESTMENT_TYPES,
  MARITAL_STATUSES,
  MONTHLY_SURPLUS_MODES,
  SURPLUS_ALLOCATION_TYPES,
  OCCUPATIONS,
  RISK_PROFILES,
  calculateAgeFromDateOfBirth,
  calculateMonthlySurplus
} from "@/lib/constants/assessment";

const optionalNumber = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().min(0).optional()
);

const optionalInteger = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().int().min(0).optional()
);

const scoreOneToFive = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().int().min(1).max(5).optional()
);

export const goalSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().optional().default(""),
  targetAmount: optionalNumber,
  currentAmount: optionalNumber,
  timeline: z.string().trim().optional().default(""),
  targetYear: optionalInteger,
  monthlyContribution: optionalNumber,
  priority: z.union([z.literal(""), z.enum(GOAL_PRIORITIES)]).default("Medium"),
  type: z.union([z.literal(""), z.enum(GOAL_TYPES)]).default("Flexible"),
  status: z.union([z.literal(""), z.enum(GOAL_STATUSES)]).default("Planning"),
  notes: z.string().trim().optional().default(""),
  isPrimary: z.boolean().default(false)
});

export const existingInvestmentSchema = z.object({
  id: z.string().optional(),
  type: z.string().trim().optional().default(""),
  institution: z.string().trim().optional().default(""),
  currentValue: optionalNumber,
  monthlyContribution: optionalNumber,
  startDate: z.string().optional().default(""),
  maturityDate: z.string().optional().default(""),
  notes: z.string().trim().optional().default("")
});

export const liabilitySchema = z.object({
  id: z.string().optional(),
  type: z.string().trim().optional().default(""),
  lender: z.string().trim().optional().default(""),
  originalLoanAmount: optionalNumber,
  outstandingAmount: optionalNumber,
  emiAmount: optionalNumber,
  interestRate: optionalNumber,
  remainingTenure: z.string().trim().optional().default(""),
  extraRepayment: optionalNumber,
  targetClosureDate: z.string().optional().default(""),
  notes: z.string().trim().optional().default("")
});

export const personalProfileSchema = z.object({
  dateOfBirth: z.string().trim().optional().default(""),
  age: optionalInteger,
  birthdayReminderEnabled: z.boolean().default(true),
  birthdayReminderDaysBefore: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? 7 : value,
    z.coerce.number().int().min(0).max(30)
  ),
  birthdayReminderOffsets: z.preprocess(
    (value) => Array.isArray(value) ? value : undefined,
    z.array(z.coerce.number().int().refine((value) => [0, 1, 3, 7, 14, 30].includes(value))).optional()
  ),
  occupation: z.union([z.literal(""), z.enum(OCCUPATIONS)]),
  annualIncome: optionalNumber,
  monthlySurplusMode: z.enum(MONTHLY_SURPLUS_MODES).default("fixed"),
  monthlySurplusPercentage: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().min(0).max(100).optional()
  ),
  monthlySurplus: optionalNumber,
  numberOfDependants: optionalInteger,
  maritalStatus: z.union([z.literal(""), z.enum(MARITAL_STATUSES)]),
  currentInvestments: z.string().trim().optional().default(""),
  activeLiabilities: z.string().trim().optional().default("")
}).superRefine((profile, context) => {
  if (profile.dateOfBirth && calculateAgeFromDateOfBirth(profile.dateOfBirth) === "") {
    context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a valid date of birth" });
  }
}).transform((profile) => ({
  ...profile,
  birthdayReminderOffsets: profile.birthdayReminderEnabled === false
    ? []
    : [...new Set((profile.birthdayReminderOffsets?.length ? profile.birthdayReminderOffsets : [profile.birthdayReminderDaysBefore ?? 7]).map(Number))].sort((a, b) => b - a),
  age: profile.dateOfBirth ? calculateAgeFromDateOfBirth(profile.dateOfBirth) : profile.age,
  monthlySurplus: profile.monthlySurplusMode === "percentage"
    ? calculateMonthlySurplus({
        annualIncome: profile.annualIncome,
        mode: profile.monthlySurplusMode,
        fixedAmount: profile.monthlySurplus,
        percentage: profile.monthlySurplusPercentage
      })
    : profile.monthlySurplus
}));


export const surplusAllocationSchema = z.object({
  id: z.string().optional(),
  category: z.union([z.literal(""), z.enum(SURPLUS_ALLOCATION_TYPES)]).default(""),
  mode: z.enum(["fixed", "percentage"]).default("fixed"),
  fixedAmount: optionalNumber,
  percentage: z.preprocess(
    (value) => value === "" || value === null || value === undefined ? undefined : value,
    z.coerce.number().min(0).max(100).optional()
  ),
  notes: z.string().trim().optional().default("")
});

export const investmentPreferenceSchema = z.object({
  id: z.string().optional(),
  investmentType: z.union([z.literal(""), z.enum(INVESTMENT_TYPES)]),
  preferredFrequency: z.union([z.literal(""), z.enum(INVESTMENT_FREQUENCIES)]),
  sipAmount: optionalNumber,
  lumpSumAmount: optionalNumber,
  productsOfInterest: z.array(z.string()).default([])
});

export const investmentPreferencesSchema = z.array(investmentPreferenceSchema).default([]);

export const advisorNotesSchema = z.object({
  keyConcerns: z.string().trim().optional().default(""),
  objections: z.string().trim().optional().default(""),
  familyDynamics: z.string().trim().optional().default(""),
  additionalContext: z.string().trim().optional().default("")
});

export const assessmentSchema = z.object({
  assessmentDate: z.string().min(1, "Assessment date is required"),
  assessmentType: z.enum(["Initial Assessment", "Reassessment"]).default("Initial Assessment"),
  reassessmentReason: z.string().trim().optional().default(""),
  personalProfile: personalProfileSchema,
  bucketList: z.array(goalSchema).default([]),
  existingInvestments: z.array(existingInvestmentSchema).default([]),
  liabilities: z.array(liabilitySchema).default([]),
  surplusAllocations: z.array(surplusAllocationSchema).default([]),
  investmentPreferences: investmentPreferencesSchema,
  riskAssessment: z.object({
    marketFallResponse: scoreOneToFive,
    investmentHorizon: scoreOneToFive,
    expectedReturn: scoreOneToFive,
    investableSavings: scoreOneToFive,
    advisorOverride: z.union([z.literal(""), z.enum(RISK_PROFILES)]),
    overrideReason: z.string().trim().optional().default("")
  }),
  qualification: z.object({
    goalDefined: z.coerce.number().int().min(0).max(2),
    monthlySurplusConfirmed: z.coerce.number().int().min(0).max(1),
    timelineSuitable: z.coerce.number().int().min(0).max(1),
    liabilitiesManageable: z.coerce.number().int().min(0).max(1)
  }),
  advisorNotes: advisorNotesSchema
});

function addIssue(issues, path, message) {
  issues.push({ path, message, code: "custom" });
}

function validateGoals(goals, issues) {
  const usableGoals = goals.filter((goal) => goal.name || goal.targetAmount || goal.timeline || goal.targetYear);
  if (!usableGoals.length) return;

  usableGoals.forEach((goal, index) => {
    if (!goal.name) addIssue(issues, ["bucketList", index, "name"], "Goal name is required");
    if (!goal.targetAmount || goal.targetAmount <= 0) addIssue(issues, ["bucketList", index, "targetAmount"], "Target amount must be greater than zero");
    if (!goal.timeline && !goal.targetYear) addIssue(issues, ["bucketList", index, "timeline"], "Enter a timeline or target year");
  });

  const primaryCount = usableGoals.filter((goal) => goal.isPrimary).length;
  if (primaryCount !== 1) addIssue(issues, ["bucketList", 0, "isPrimary"], "Select exactly one primary goal");
}

function validateSurplusAllocations(rows, issues) {
  rows.forEach((item, index) => {
    const isUsed = Boolean(
      item.category
      || item.fixedAmount !== undefined
      || item.percentage !== undefined
      || item.notes
    );
    if (!isUsed) return;

    if (!item.category) {
      addIssue(issues, ["surplusAllocations", index, "category"], "Select the surplus allocation purpose");
    }
    if (item.mode === "percentage" && item.percentage === undefined) {
      addIssue(issues, ["surplusAllocations", index, "percentage"], "Enter the allocation percentage");
    }
    if (item.mode === "fixed" && item.fixedAmount === undefined) {
      addIssue(issues, ["surplusAllocations", index, "fixedAmount"], "Enter the allocation amount");
    }
  });
}

export function validateCompletedAssessment(data) {
  const base = assessmentSchema.safeParse(data);
  if (!base.success) return base;

  const parsed = base.data;
  const issues = [];

  if (!parsed.personalProfile.age) addIssue(issues, ["personalProfile", "age"], "Age or date of birth is required to complete the assessment");
  if (!parsed.personalProfile.occupation) addIssue(issues, ["personalProfile", "occupation"], "Occupation is required to complete the assessment");
  if (parsed.personalProfile.monthlySurplusMode === "percentage") {
    if (!Number(parsed.personalProfile.annualIncome || 0)) addIssue(issues, ["personalProfile", "annualIncome"], "Annual income is required for percentage-based surplus");
    if (parsed.personalProfile.monthlySurplusPercentage === undefined) addIssue(issues, ["personalProfile", "monthlySurplusPercentage"], "Enter the surplus percentage");
  } else if (parsed.personalProfile.monthlySurplus === undefined) {
    addIssue(issues, ["personalProfile", "monthlySurplus"], "Monthly surplus is required");
  }

  validateGoals(parsed.bucketList, issues);
  validateSurplusAllocations(parsed.surplusAllocations, issues);

  if (parsed.assessmentType === "Reassessment" && !parsed.reassessmentReason) {
    addIssue(issues, ["reassessmentReason"], "Enter the reason for reassessment");
  }
  if (parsed.riskAssessment.advisorOverride && !parsed.riskAssessment.overrideReason) {
    addIssue(issues, ["riskAssessment", "overrideReason"], "Explain why the calculated risk profile is being overridden");
  }

  const usablePreferences = parsed.investmentPreferences
    .map((item, index) => ({ item, index }))
    .filter(({ item }) =>
      item.investmentType
      || item.sipAmount !== undefined
      || item.lumpSumAmount !== undefined
      || item.productsOfInterest.length
    );

  if (!usablePreferences.length) {
    addIssue(issues, ["investmentPreferences", 0, "investmentType"], "Add at least one investment preference");
  }

  usablePreferences.forEach(({ item, index }) => {
    if (!item.investmentType) addIssue(issues, ["investmentPreferences", index, "investmentType"], "Investment type is required");
    if (!item.preferredFrequency) addIssue(issues, ["investmentPreferences", index, "preferredFrequency"], "Preferred frequency is required");
  });

  for (const key of ["marketFallResponse", "investmentHorizon", "expectedReturn", "investableSavings"]) {
    if (!parsed.riskAssessment[key]) addIssue(issues, ["riskAssessment", key], "Select an answer");
  }

  parsed.existingInvestments.forEach((item, index) => {
    if ((item.institution || item.currentValue || item.monthlyContribution) && !item.type) {
      addIssue(issues, ["existingInvestments", index, "type"], "Select the investment type");
    }
  });

  parsed.liabilities.forEach((item, index) => {
    if ((item.lender || item.outstandingAmount || item.emiAmount) && !item.type) {
      addIssue(issues, ["liabilities", index, "type"], "Select the liability type");
    }
  });

  if (!issues.length) return base;
  return { success: false, error: { issues } };
}

const investorKycSchema = z.object({
  panNumber: z.string().trim().transform((value) => value.toUpperCase()).refine((value) => !value || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value), "Enter a valid PAN number").default(""),
  aadhaarNumber: z.string().trim().refine((value) => !value || /^\d{12}$/.test(value.replace(/\s+/g, "")), "Enter a valid 12-digit Aadhaar number").default(""),
  aadhaarConfigured: z.boolean().optional().default(false),
  aadhaarLast4: z.string().trim().optional().default(""),
  removeAadhaar: z.boolean().optional().default(false)
});

export const investorProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  contactNo: z.string().trim().min(8, "Enter a valid contact number").max(15, "Enter a valid contact number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address")]),
  city: z.string().trim().optional().default(""),
  kyc: investorKycSchema.default({ panNumber: "", aadhaarNumber: "", aadhaarConfigured: false, aadhaarLast4: "", removeAadhaar: false }),
  personalProfile: personalProfileSchema,
  bucketList: z.array(goalSchema).default([]),
  existingInvestments: z.array(existingInvestmentSchema).default([]),
  liabilities: z.array(liabilitySchema).default([]),
  surplusAllocations: z.array(surplusAllocationSchema).default([]),
  investmentPreferences: investmentPreferencesSchema,
  advisorNotes: advisorNotesSchema
}).superRefine((data, context) => {
  const issues = [];
  validateGoals(data.bucketList, issues);
  validateSurplusAllocations(data.surplusAllocations, issues);
  if (data.personalProfile.monthlySurplusMode === "percentage") {
    if (!Number(data.personalProfile.annualIncome || 0)) {
      addIssue(issues, ["personalProfile", "annualIncome"], "Annual income is required for percentage-based surplus");
    }
    if (data.personalProfile.monthlySurplusPercentage === undefined) {
      addIssue(issues, ["personalProfile", "monthlySurplusPercentage"], "Enter the surplus percentage");
    }
  }
  for (const issue of issues) context.addIssue(issue);
});
