# GrowVest v0.34.13 - Release Validation

## Release

**Investor Launch Opening Wealth Review, Goal Reconciliation & Naming Standard**

Version: `0.34.13`
PWA cache: `v0.34.13-opening-review1`
Secure report PDF renderer: `2.3.0`

## Validation summary

- Release audit: **392 passed, 0 warnings, 0 failures**
- Opening Wealth Review reconciliation fixture: **PASS**
- Non-JSX changed JavaScript/MJS syntax checks: **23 files checked, 0 failures**
- Release hygiene: `.env`, `.env.local`, `.git`, `.next` and `node_modules` are not packaged

## Launch reconciliation fixture

The release fixture reproduces the launch case discussed during QA:

- Goal: General Wealth / Corpus Creation
- Current portfolio / goal corpus: INR 24,298
- Goal target: INR 10,00,000
- Active monthly SIP: INR 3,000
- Derived progress: 2.4%
- Derived status: SIP Running
- Invalid goal allocations: 0

The fixture validates that Portfolio Master, not stale manually stored goal-current values, is authoritative for current goal corpus and Active SIP.

## v0.34.13 controls validated

- First investor-facing report is automatically treated as an **Opening Wealth Review** when no prior published GrowVest Wealth Review exists.
- Opening baseline is tied to the verified Portfolio Master snapshot and does not infer previous-period movement or return.
- A Monthly Wealth Review cannot precede or share the Opening baseline month.
- Goal / Bucket List current corpus and Active SIP are derived from portfolio allocations.
- General Wealth legacy naming aliases reconcile to the canonical investor goal where available.
- Goal status is portfolio-derived: Completed, SIP Running, Invested / No Active SIP, or Not Started.
- Goal allocation changes carry an effective-from date into the next verified Portfolio Master snapshot.
- Pre-publish reconciliation validates portfolio total, Active SIP, asset allocation, goal corpus, allocation coverage, Opening baseline, and Portfolio Master readiness.
- Critical reconciliation mismatches block publication.
- Report naming is standardised to Opening Wealth Review / Monthly Wealth Review with `GV-OWR` / `GV-MWR` references.
- Immutable report-version IDs use padded `v001`, `v002`, ... naming.
- Default investor PDF filename pattern is `{CompanyName}_{ReportType}_{InvestorName}_{ReportPeriod}.pdf`.
- New server-only PDF storage paths are organised by investor, report type, period and immutable version while retaining the existing `monthly-reports` root for Storage-rule compatibility.
- Investor and staff report surfaces use Wealth Review terminology while legacy permission/collection keys remain unchanged for compatibility.

## Build note

A full `npm run lint` / `next build` was not executed inside this clean release directory because dependencies are intentionally not packaged and are not installed in the validation environment. Source-level release audit, the dedicated reconciliation fixture, and syntax validation of changed non-JSX JavaScript/MJS files all pass.

Before production rollout, deploy to the normal development/staging environment, run `npm ci`, `npm run lint`, `npm run build`, then generate and publish one real Opening Wealth Review to compare browser preview against the downloaded secure PDF.
