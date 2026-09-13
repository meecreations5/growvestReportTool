import assert from "node:assert/strict";
import {
  resolveHoldingChangeVerification,
  resolveReconciliationVerification
} from "../../src/lib/reportVerification.js";

const openingHoldings = resolveHoldingChangeVerification({
  isOpening: true,
  positions: Array.from({ length: 25 }, (_, index) => ({ id: `holding-${index + 1}` })),
  openingSnapshot: { id: "prior-snapshot" },
  openingPositions: [{ id: "legacy-holding" }]
});
assert.equal(openingHoldings.comparisonApplicable, false);
assert.equal(openingHoldings.status, "pass");
assert.equal(openingHoldings.label, "Opening portfolio holdings");
assert.equal(openingHoldings.newHoldings.length, 0);
assert.equal(openingHoldings.exitedHoldings.length, 0);
assert.match(openingHoldings.detail, /25 active holdings establish/);
assert.match(openingHoldings.detail, /next Monthly Wealth Review/);

const warningOnly = resolveReconciliationVerification({
  status: "mismatch",
  issues: [
    { code: "missing_source_date", severity: "warn", title: "Source date missing", description: "Review source date." },
    { code: "aging_source", severity: "info", title: "Source aging", description: "FYI" }
  ]
});
assert.equal(warningOnly.status, "warn", "detailed issue severity should override stale aggregate mismatch status when no blocking issue exists");
assert.equal(warningOnly.blockingIssueCount, 0);
assert.equal(warningOnly.warningIssueCount, 1);
assert.equal(warningOnly.issues.length, 1);


const infoOnly = resolveReconciliationVerification({
  status: "mismatch",
  issues: [
    { code: "new_general_wealth_holdings", severity: "info", title: "Opening holdings", description: "Informational only." }
  ]
});
assert.equal(infoOnly.status, "pass", "an aggregate stale/mismatch flag must not hard-block when detailed Portfolio Intelligence contains informational issues only");
assert.equal(infoOnly.issues.length, 0);

const blocking = resolveReconciliationVerification({
  status: "verified",
  issues: [
    { code: "valuation_mismatch", severity: "block", title: "Valuation mismatch", description: "Value does not reconcile." },
    { code: "missing_source_date", severity: "warn", title: "Source date missing", description: "Review source date." }
  ]
});
assert.equal(blocking.status, "block");
assert.equal(blocking.blockingIssueCount, 1);
assert.equal(blocking.warningIssueCount, 1);
assert.equal(blocking.issues.length, 2);

const legacyMismatch = resolveReconciliationVerification(null, "mismatch");
assert.equal(legacyMismatch.status, "block", "legacy mismatch without detailed issues must remain blocking");

const monthlyChanges = resolveHoldingChangeVerification({
  isOpening: false,
  positions: [{ id: "a" }, { id: "b" }],
  openingSnapshot: { id: "previous" },
  openingPositions: [{ id: "a" }, { id: "c" }]
});
assert.equal(monthlyChanges.comparisonApplicable, true);
assert.equal(monthlyChanges.status, "warn");
assert.deepEqual(monthlyChanges.newHoldings.map((item) => item.id), ["b"]);
assert.deepEqual(monthlyChanges.exitedHoldings.map((item) => item.id), ["c"]);

console.log("Opening Portfolio Verification stability fixture passed");
console.log(JSON.stringify({
  opening: {
    label: openingHoldings.label,
    comparisonApplicable: openingHoldings.comparisonApplicable,
    newHoldings: openingHoldings.newHoldings.length,
    exitedHoldings: openingHoldings.exitedHoldings.length
  },
  warningOnly: {
    status: warningOnly.status,
    blocking: warningOnly.blockingIssueCount,
    warnings: warningOnly.warningIssueCount
  },
  blocking: {
    status: blocking.status,
    blocking: blocking.blockingIssueCount,
    warnings: blocking.warningIssueCount
  }
}, null, 2));
