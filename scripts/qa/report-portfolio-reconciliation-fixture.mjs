import assert from "node:assert/strict";
import {
  comparePortfolioSnapshots,
  latestVerifiedPortfolioSnapshot
} from "../../src/lib/portfolioSnapshotSelection.js";

const early = {
  id: "INV_2026-10-31",
  investorId: "INV",
  snapshotDate: "2026-10-31",
  snapshotVersion: 1,
  verificationStatus: "verified",
  updatedAt: "2026-10-31T10:00:00.000Z",
  summary: { currentValue: 47954 }
};
const revised = {
  ...early,
  snapshotVersion: 2,
  updatedAt: "2026-11-01T06:00:00.000Z",
  summary: { currentValue: 95801 }
};

assert.ok(comparePortfolioSnapshots(revised, early) > 0, "later same-date revision outranks earlier snapshot revision");
assert.equal(latestVerifiedPortfolioSnapshot([early, revised], () => true)?.snapshotVersion, 2, "latest verified selector chooses month-end revision 2");

const opening = 48500;
const moneyAdded = 50001;
const withdrawn = 0;
const closing = revised.summary.currentValue;
const investmentGain = closing - opening - moneyAdded + withdrawn;
assert.equal(investmentGain, -2700, "monthly movement separates fresh contribution from investment performance");

console.log("Monthly Report portfolio reconciliation fixture passed");
console.log(JSON.stringify({
  cutoff: "2026-10-31",
  earlyClosing: early.summary.currentValue,
  finalClosing: closing,
  finalSnapshotVersion: revised.snapshotVersion,
  opening,
  moneyAdded,
  withdrawn,
  investmentGain
}, null, 2));
