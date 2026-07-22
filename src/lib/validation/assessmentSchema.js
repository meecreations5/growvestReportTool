import { z } from "zod";
import {
  GOAL_PRIORITIES,
  GOAL_STATUSES,
  GOAL_TYPES,
  INVESTMENT_FREQUENCIES,
  INVESTMENT_TYPES,
  MARITAL_STATUSES,
  OCCUPATIONS,
  RISK_PROFILES
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
  outstandingAmount: optionalNumber,
  emiAmount: optionalNumber,
  interestRate: optionalNumber,
  remainingTenure: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default("")
});

export const personalProfileSchema = z.object({
  age: optionalInteger,
  occupation: z.union([z.literal(""), z.enum(OCCUPATIONS)]),
  annualIncome: optionalNumber,
  monthlySurplus: optionalNumber,
  numberOfDependants: optionalInteger,
  maritalStatus: z.union([z.literal(""), z.enum(MARITAL_STATUSES)]),
  currentInvestments: z.string().trim().optional().default(""),
  activeLiabilities: z.string().trim().optional().default("")
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
  if (!usableGoals.length) {
    addIssue(issues, ["bucketList", 0, "name"], "Add at least one financial goal or bucket");
    return;
  }

  usableGoals.forEach((goal, index) => {
    if (!goal.name) addIssue(issues, ["bucketList", index, "name"], "Goal name is required");
    if (!goal.targetAmount || goal.targetAmount <= 0) addIssue(issues, ["bucketList", index, "targetAmount"], "Target amount must be greater than zero");
    if (!goal.timeline && !goal.targetYear) addIssue(issues, ["bucketList", index, "timeline"], "Enter a timeline or target year");
  });

  const primaryCount = usableGoals.filter((goal) => goal.isPrimary).length;
  if (primaryCount !== 1) addIssue(issues, ["bucketList", 0, "isPrimary"], "Select exactly one primary goal");
}

export function validateCompletedAssessment(data) {
  const base = assessmentSchema.safeParse(data);
  if (!base.success) return base;

  const parsed = base.data;
  const issues = [];

  if (!parsed.personalProfile.age) addIssue(issues, ["personalProfile", "age"], "Age is required to complete the assessment");
  if (!parsed.personalProfile.occupation) addIssue(issues, ["personalProfile", "occupation"], "Occupation is required to complete the assessment");
  if (parsed.personalProfile.monthlySurplus === undefined) addIssue(issues, ["personalProfile", "monthlySurplus"], "Monthly surplus is required");

  validateGoals(parsed.bucketList, issues);

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

export const investorProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  contactNo: z.string().trim().min(8, "Enter a valid contact number").max(15, "Enter a valid contact number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address")]),
  city: z.string().trim().optional().default(""),
  personalProfile: personalProfileSchema,
  bucketList: z.array(goalSchema).min(1, "Add at least one goal"),
  existingInvestments: z.array(existingInvestmentSchema).default([]),
  liabilities: z.array(liabilitySchema).default([]),
  investmentPreferences: investmentPreferencesSchema,
  advisorNotes: advisorNotesSchema
}).superRefine((data, context) => {
  const issues = [];
  validateGoals(data.bucketList, issues);
  for (const issue of issues) context.addIssue(issue);
});
