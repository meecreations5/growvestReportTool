import { z } from "zod";

const nonNegative = z.coerce.number().min(0, "Value cannot be negative");

export const monthlyReportSchema = z.object({
  investorId: z.string().min(1, "Select an investor"),
  reportMonth: z.coerce.number().min(1).max(12),
  reportYear: z.coerce.number().min(2020).max(2100),
  statementDate: z.string().min(1, "Statement date is required"),
  title: z.string().trim().min(3, "Report title is required"),
  summary: z.object({
    totalCorpus: nonNegative,
    lifetimeTarget: nonNegative,
    overallProgress: nonNegative,
    monthlySip: nonNegative,
    newMoneyAdded: nonNegative,
    investmentGain: z.coerce.number()
  }),
  advisorNote: z.object({
    content: z.string().optional().default(""),
    highlight: z.string().optional().default("")
  }),
  holdings: z.array(z.any()).default([]),
  goals: z.array(z.any()).default([]),
  allocation: z.array(z.any()).default([]),
  funds: z.array(z.any()).default([]),
  nextSteps: z.array(z.any()).default([]),
  nextReview: z.object({
    date: z.string().optional().default(""),
    note: z.string().optional().default(""),
    mode: z.string().optional().default("")
  }),
  disclaimer: z.string().optional().default("")
});

export function validateCompletedReport(payload) {
  const errors = [];
  if (Number(payload.summary?.totalCorpus || 0) <= 0) errors.push("Total corpus must be greater than zero.");
  if (!payload.holdings?.some((item) => Number(item.currentValue || 0) > 0)) errors.push("Add at least one holdings breakdown row with a current value.");
  if (!payload.goals?.some((item) => item.name?.trim() && Number(item.targetAmount || 0) > 0)) errors.push("Add at least one Bucket List goal with a target amount.");
  if (!payload.advisorNote?.content?.trim()) errors.push("Advisor note is required before completion.");
  if (!payload.funds?.some((item) => item.instrumentName?.trim() && Number(item.currentValue || 0) > 0)) errors.push("Add at least one fund or instrument with a current value.");
  return errors;
}
