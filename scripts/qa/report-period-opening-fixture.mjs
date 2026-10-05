import assert from "node:assert/strict";
import {
  isMonthlyPeriodAfterOpening,
  openingReportMonthKey,
  previousCompletedMonthPeriod,
  sameMonthOpeningBaselineDate
} from "../../src/lib/reportPeriodRules.js";

assert.deepEqual(previousCompletedMonthPeriod(2026, 10), { month: 9, year: 2026 });
assert.deepEqual(previousCompletedMonthPeriod(2027, 1), { month: 12, year: 2026 });

const septemberOpening = {
  reportType: "opening",
  reportMonthKey: "2026-09",
  statementDate: "2026-09-11"
};
assert.equal(openingReportMonthKey(septemberOpening), "2026-09");
assert.equal(isMonthlyPeriodAfterOpening(septemberOpening, "2026-09", "2026-09-30"), true);
assert.equal(isMonthlyPeriodAfterOpening(septemberOpening, "2026-09", "2026-09-11"), false);
assert.equal(isMonthlyPeriodAfterOpening(septemberOpening, "2026-08", "2026-08-31"), false);
assert.equal(isMonthlyPeriodAfterOpening(septemberOpening, "2026-10", "2026-10-31"), true);
assert.equal(sameMonthOpeningBaselineDate(septemberOpening, "2026-09-30"), "2026-09-11");
assert.equal(sameMonthOpeningBaselineDate(septemberOpening, "2026-10-31"), "");

const monthEndOpening = {
  reportType: "opening",
  reportMonthKey: "2026-09",
  statementDate: "2026-09-30"
};
assert.equal(isMonthlyPeriodAfterOpening(monthEndOpening, "2026-09", "2026-09-30"), false);
assert.equal(isMonthlyPeriodAfterOpening(monthEndOpening, "2026-10", "2026-10-31"), true);

console.log("Report period / Opening baseline fixture passed");
console.log(JSON.stringify({
  preparationDateExample: "2026-10-05",
  defaultReportingPeriod: "2026-09",
  sameMonthOpeningExample: "Opening 2026-09-11 -> Monthly 2026-09-30 allowed",
  publicationRule: "Monthly draft/PDF may be prepared before Opening publication; investor publish remains gated"
}, null, 2));
