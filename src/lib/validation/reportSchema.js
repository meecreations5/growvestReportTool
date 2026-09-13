import { z } from "zod";
import { REPORT_TYPE } from "@/lib/constants/report";
import { buildReportReconciliation } from "@/lib/reportReconciliation";

const nonNegative = z.coerce.number().min(0, "Value cannot be negative");

export const monthlyReportSchema = z.object({
  investorId: z.string().min(1, "Select an investor"),
  reportType: z.enum([REPORT_TYPE.OPENING, REPORT_TYPE.MONTHLY]).optional().default(REPORT_TYPE.MONTHLY),
  reportMonth: z.coerce.number().min(1).max(12),
  reportYear: z.coerce.number().min(2020).max(2100),
  statementDate: z.string().min(1, "Statement date is required"),
  title: z.string().trim().min(3, "Report title is required"),
  openingBaseline: z.object({
    asOfDate: z.string().optional().default(""),
    sourceSnapshotId: z.string().optional().default(""),
    sourceSnapshotDate: z.string().optional().default(""),
    established: z.boolean().optional().default(false)
  }).nullable().optional(),
  summary: z.object({
    totalCorpus: nonNegative,
    lifetimeTarget: nonNegative,
    overallProgress: nonNegative,
    monthlySip: nonNegative,
    newMoneyAdded: nonNegative,
    totalWithdrawals: nonNegative.optional().default(0),
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
  reportingPeriod: z.object({
    monthKey: z.string().optional().default(""),
    startDate: z.string().optional().default(""),
    endDate: z.string().optional().default(""),
    portfolioCutoffDate: z.string().optional().default("")
  }).optional(),
  monthlyChanges: z.array(z.any()).default([]),
  profileActions: z.array(z.any()).default([]),
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
  const verification = payload.portfolioVerification;
  if (verification?.required) {
    if (!payload.sourcePortfolioSnapshotId || !verification.snapshotId) {
      errors.push("A verified Portfolio Master snapshot is required before completing this Wealth Review.");
    } else if (["blocked", "pending"].includes(String(verification.status || ""))) {
      errors.push("Portfolio verification is blocked. Resolve the Portfolio Master issues before completing the report.");
    } else if (verification.status === "review_required" && !verification.acknowledged) {
      errors.push("Review and confirm the portfolio verification warnings before completing the report.");
    }
  }
  const totalCorpus = Number(payload.summary?.totalCorpus || 0);
  const verificationCounts = verification?.counts || {};
  const hasExitEvidence = Number(verificationCounts.exitedHoldings || 0) > 0
    || Number(verificationCounts.transactions || 0) > 0
    || Number(payload.summary?.totalWithdrawals || 0) > 0
    || Boolean(verification?.openingSnapshotId)
    || payload.funds?.some((item) => Number(item.openingValue || 0) > 0 || Number(item.withdrawal || 0) > 0);
  const hasVerifiedClosingSource = !verification?.required
    || Boolean(payload.sourcePortfolioSnapshotId && verification?.snapshotId);
  const legitimateZeroClosingBalance = totalCorpus === 0 && hasExitEvidence && hasVerifiedClosingSource;

  if (totalCorpus <= 0 && !legitimateZeroClosingBalance) {
    errors.push("Total corpus must be greater than zero unless this is a verified fully-exited portfolio month.");
  }
  if (!legitimateZeroClosingBalance && !payload.holdings?.some((item) => Number(item.currentValue || 0) > 0)) {
    errors.push("Add at least one holdings breakdown row with a current value.");
  }
  if (!payload.advisorNote?.content?.trim()) errors.push("Partner commentary is required before completion.");
  if (!legitimateZeroClosingBalance && !payload.funds?.some((item) => item.instrumentName?.trim() && Number(item.currentValue || 0) > 0)) {
    errors.push("Add at least one fund or instrument with a current value.");
  }
  const reconciliation = buildReportReconciliation(payload);
  reconciliation.checks.filter((item) => item.status === "block").forEach((item) => {
    errors.push(`${item.label}: ${item.detail}`);
  });
  return [...new Set(errors)];
}
