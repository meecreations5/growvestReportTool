/**
 * A single, shared monthly-report loader that attempts a source-verified
 * historical close ONCE when ordinary Portfolio Master selection cannot
 * cover the reporting month. This function never invents a NAV, cash flow,
 * snapshot or approval. The authenticated POST endpoint makes the decision.
 *
 * `attempts` is an instance-scoped Map of promises. React effect restarts
 * share the same in-flight attempt; manual refresh clears the matching key.
 */
const RECOVERABLE_SOURCE_ERRORS = new Set([
  "portfolio_closing_snapshot_missing_cash_flow",
  "portfolio_historical_snapshot_outdated",
  "portfolio_monthly_invalid_source_dates",
  "portfolio_source_coverage_incomplete"
]);

/**
 * Expected financial validation outcomes must be rendered in the report UI.
 * A newer dated archive is not a Next.js runtime exception: report-source
 * deliberately returns 409 until a complete month-end source is approved.
 * Keep this classification shared with the recovery workflow so a new 409
 * cannot accidentally become a development-console error again.
 */
const EXPECTED_MONTHLY_SOURCE_ERRORS = new Set([
  ...RECOVERABLE_SOURCE_ERRORS,
  "post_cutoff_capture_not_approved",
  "historical_source_invalid",
  "historical_valuation_not_eligible",
  "monthly_close_previous_approval_stale"
]);

export function isExpectedMonthlySourceError(error) {
  const code = String(error?.code || "");
  const status = Number(error?.statusCode || 0);
  if (code === "monthly_close_forbidden" && status === 403) return true;
  return status === 409 && (EXPECTED_MONTHLY_SOURCE_ERRORS.has(code) || code.startsWith("monthly_close_"));
}

export function monthlyCloseRecoveryKey(investorId, monthKey) {
  return `${String(investorId || "").trim()}|${String(monthKey || "").slice(0, 7)}`;
}

export function isMonthlyCloseRecoveryCandidate({ reportType, investorId, monthKey, published = false, error = null, source = null }) {
  if (reportType !== "monthly" || !investorId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthKey || "")) || published) return false;
  if (error) return Number(error.statusCode) === 409 && RECOVERABLE_SOURCE_ERRORS.has(String(error.code || ""));
  return !source?.snapshot?.id;
}

function recoveryFailure(error, prefix = "Automatic monthly closing could not be completed") {
  const detail = String(error?.message || "Historical closing evidence needs review.").trim();
  const failed = new Error(`${prefix}: ${detail} The report remains blocked until a complete, eligible month-end source is available.`);
  failed.code = String(error?.code || "monthly_close_requires_review");
  failed.statusCode = Number(error?.statusCode) || 409;
  return failed;
}

export async function loadMonthlyReportSourceWithRecovery({
  loadSource,
  closeMonth,
  investorId,
  monthKey,
  reportType = "monthly",
  published = false,
  attempts
}) {
  if (typeof loadSource !== "function" || typeof closeMonth !== "function" || !(attempts instanceof Map)) {
    throw new Error("Monthly source recovery requires a loader, month-close action and attempt cache.");
  }
  let source = null;
  let initialError = null;
  try {
    source = await loadSource();
  } catch (error) {
    initialError = error;
  }
  const candidate = isMonthlyCloseRecoveryCandidate({ reportType, investorId, monthKey, published, error: initialError, source });
  if (!candidate) {
    if (initialError) throw initialError;
    return { source, autoClosed: false };
  }

  const key = monthlyCloseRecoveryKey(investorId, monthKey);
  let attempt = attempts.get(key);
  if (!attempt) {
    // Set the promise before awaiting so concurrent mounts/rerenders do not
    // approve the same archived valuation twice.
    attempt = Promise.resolve().then(closeMonth);
    attempts.set(key, attempt);
  }
  let result;
  try {
    result = await attempt;
  } catch (error) {
    throw recoveryFailure(error);
  }
  if (!result?.approved && !result?.alreadyApproved) {
    throw recoveryFailure({
      code: "monthly_close_not_confirmed",
      message: "The month-end approval endpoint did not confirm a verified snapshot."
    });
  }
  try {
    const reloaded = await loadSource();
    if (!reloaded?.snapshot?.id) {
      throw recoveryFailure({
        code: "monthly_close_snapshot_not_selected",
        message: "The historical close was approved, but the report still cannot select the resulting Portfolio Master snapshot."
      }, "Verified month-end snapshot is not connected to this report");
    }
    // An HTTP 200 is insufficient when the selector still returns the old
    // snapshot. Match the newly approved source, or a independently verified
    // newer closing source for the same reporting period.
    const approvedSnapshotId = String(result.snapshotId || "");
    const approvedValuationDate = String(result.valuationDate || "").slice(0, 10);
    const currentDate = String(reloaded.snapshot.snapshotDate || "").slice(0, 10);
    if (approvedSnapshotId && reloaded.snapshot.id !== approvedSnapshotId
      && (!approvedValuationDate || currentDate < approvedValuationDate)) {
      throw recoveryFailure({
        code: "monthly_close_snapshot_not_selected",
        message: "The month-end approval succeeded but report-source still returned an earlier Portfolio Master snapshot."
      }, "Verified month-end snapshot is not connected to this report");
    }
    if (reloaded.snapshot.verificationStatus !== "verified") {
      throw recoveryFailure({
        code: "monthly_close_snapshot_not_verified",
        message: "The report source did not return a verified closing portfolio."
      });
    }
    return { source: reloaded, autoClosed: true, monthEndResult: result };
  } catch (error) {
    if (error.code === "monthly_close_snapshot_not_selected") throw error;
    if (RECOVERABLE_SOURCE_ERRORS.has(String(error.code || ""))) {
      throw recoveryFailure({
        code: "monthly_close_snapshot_not_selected",
        message: "The archived source was approved, but the report-source API still selected an earlier snapshot. The new verified snapshot is not being selected; check its investor, verification status, snapshot date and stored positions."
      }, "Verified closing snapshot is not reaching the Wealth Review");
    }
    throw recoveryFailure(error, "A historical close was approved, but the report could not load the verified month-end snapshot");
  }
}
