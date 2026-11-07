import assert from "node:assert/strict";
import {
  isMonthlyCloseRecoveryCandidate,
  loadMonthlyReportSourceWithRecovery,
  monthlyCloseRecoveryKey
} from "../../src/lib/portfolioMonthlySourceRecovery.js";

let passed = 0;
async function check(label, verify) {
  await verify();
  passed += 1;
  console.log(`PASS ${label}`);
}

const oct = { investorId: "investor-test", monthKey: "2026-10", reportType: "monthly" };
const error = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
const stale = error("portfolio_closing_snapshot_missing_cash_flow", "The verified 2026-10-05 snapshot precedes 2 confirmed cash movements (Rs 5,000).", 409);
const verified = {
  snapshot: { id: "hist_Oct2026", snapshotDate: "2026-10-30", verificationStatus: "verified" },
  positions: [{ positionId: "folio-1", currentValue: 90000 }],
  transactions: [{ transactionDate: "2026-10-20", amount: 2500 }, { transactionDate: "2026-10-28", amount: 2500 }]
};

await check("report-month attempt key is investor/month stable", () => {
  assert.equal(monthlyCloseRecoveryKey("investor-test", "2026-10"), "investor-test|2026-10");
});
await check("only monthly 409 financial-coverage failures are recoverable", () => {
  assert.ok(isMonthlyCloseRecoveryCandidate({ ...oct, error: stale }));
  assert.equal(isMonthlyCloseRecoveryCandidate({ ...oct, reportType: "opening", error: stale }), false);
  assert.equal(isMonthlyCloseRecoveryCandidate({ ...oct, published: true, error: stale }), false);
  assert.equal(isMonthlyCloseRecoveryCandidate({ ...oct, error: error("portfolio_access_denied", "Forbidden", 403) }), false);
});
await check("old Oct 5 409 with two Rs 2,500 movements triggers one approved retry", async () => {
  let reads = 0; let closes = 0;
  const result = await loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => { reads += 1; if (reads === 1) throw stale; return verified; },
    closeMonth: async () => { closes += 1; return { approved: true }; }
  });
  assert.equal(closes, 1); assert.equal(reads, 2); assert.equal(result.autoClosed, true);
  assert.equal(result.source.snapshot.snapshotDate, "2026-10-30");
  assert.equal(result.source.transactions.reduce((s, x) => s + x.amount, 0), 5000);
});
await check("good existing report source is not changed or re-approved", async () => {
  let closes = 0;
  const result = await loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => verified, closeMonth: async () => { closes += 1; return { approved: true }; }
  });
  assert.equal(result.autoClosed, false); assert.equal(closes, 0);
});
await check("empty monthly source can recover when an eligible historical archive exists", async () => {
  let reads = 0;
  const result = await loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => (++reads === 1 ? { snapshot: null } : verified),
    closeMonth: async () => ({ alreadyApproved: true })
  });
  assert.equal(reads, 2); assert.equal(result.source.snapshot.id, "hist_Oct2026");
});
await check("two effect restarts share one in-flight approval promise", async () => {
  let closes = 0; const attempts = new Map();
  const closeMonth = async () => { closes += 1; await Promise.resolve(); return { approved: true }; };
  const loadSource = (() => { let loads = 0; return async () => (++loads <= 2 ? Promise.reject(stale) : verified); })();
  const results = await Promise.all([1, 2].map(() => loadMonthlyReportSourceWithRecovery({ ...oct, attempts, loadSource, closeMonth })));
  assert.equal(closes, 1); assert.ok(results.every(x => x.source.snapshot.id === "hist_Oct2026"));
});
await check("no source evidence remains blocked with original detailed reason", async () => {
  let closeCount = 0; const attempts = new Map();
  const closeMonth = async () => { closeCount += 1; throw error("monthly_close_no_historical_archive", "No original October Fundbazaar historical valuation was archived."); };
  await assert.rejects(
    loadMonthlyReportSourceWithRecovery({ ...oct, attempts, loadSource: async () => { throw stale; }, closeMonth }),
    (err) => err.code === "monthly_close_no_historical_archive" && err.message.includes("No original October")
  );
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts, loadSource: async () => { throw stale; }, closeMonth }), /No original October/);
  assert.equal(closeCount, 1);
  attempts.delete(monthlyCloseRecoveryKey(oct.investorId, oct.monthKey));
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts, loadSource: async () => { throw stale; }, closeMonth }), /No original October/);
  assert.equal(closeCount, 2);
});
await check("official NAV/AMFI failures remain blocked; nothing fabricated", async () => {
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => { throw stale; },
    closeMonth: async () => { throw error("monthly_close_official_nav_unavailable", "Official NAV on Saturday is not verifiable."); }
  }), (err) => err.code === "monthly_close_official_nav_unavailable" && err.message.includes("Saturday"));
});
await check("PMS or other-source exception remains explicit", async () => {
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => { throw stale; },
    closeMonth: async () => { throw error("monthly_close_requires_review", "Other investment sources are present; consolidate PMS and Fundbazaar."); }
  }), /consolidate PMS and Fundbazaar/);
});
await check("a false success response does not unlock a report", async () => {
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => { throw stale; }, closeMonth: async () => ({ ready: true })
  }), (err) => err.code === "monthly_close_not_confirmed");
});
await check("an approved month-end not discoverable by reports stays blocked explicitly", async () => {
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => { throw stale; }, closeMonth: async () => ({ approved: true })
  }), (err) => err.code === "monthly_close_snapshot_not_selected" && err.message.includes("report-source API still selected an earlier snapshot"));
});
await check("successful approval cannot silently return the previous Oct 5 snapshot", async () => {
  let reads = 0;
  const oldSnapshot = { snapshot: { id: "old_05", snapshotDate: "2026-10-05", verificationStatus: "verified" } };
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => { if (++reads === 1) throw stale; return oldSnapshot; },
    closeMonth: async () => ({ approved: true, snapshotId: "hist_Oct2026", valuationDate: "2026-10-30" })
  }), (err) => err.code === "monthly_close_snapshot_not_selected");
});
await check("unverified snapshot cannot be passed off as a recovered close", async () => {
  let reads = 0;
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => (++reads === 1 ? Promise.reject(stale) : { snapshot: { id: "pending", snapshotDate: "2026-10-30", verificationStatus: "pending_review" } }),
    closeMonth: async () => ({ approved: true, snapshotId: "pending", valuationDate: "2026-10-30" })
  }), (err) => err.code === "monthly_close_snapshot_not_verified");
});
await check("published and opening reports never create new historical approvals", async () => {
  for (const overrides of [{ published: true }, { reportType: "opening" }]) {
    let closes = 0;
    await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, ...overrides, attempts: new Map(),
      loadSource: async () => { throw stale; }, closeMonth: async () => { closes += 1; return { approved: true }; }
    }), (err) => err === stale);
    assert.equal(closes, 0);
  }
});
await check("nonfinancial authorization failures never trigger automatic close", async () => {
  let closes = 0;
  const forbidden = error("portfolio_access_denied", "Investor access not permitted.", 403);
  await assert.rejects(loadMonthlyReportSourceWithRecovery({ ...oct, attempts: new Map(),
    loadSource: async () => { throw forbidden; }, closeMonth: async () => { closes += 1; return { approved: true }; }
  }), (err) => err === forbidden);
  assert.equal(closes, 0);
});
console.log(`\n${passed} month-end source recovery checks passed.`);
