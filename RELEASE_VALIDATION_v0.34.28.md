# GrowVest v0.34.28 Release Validation — Report Period / Opening Flow

## Validated business cases

- Preparing reports on **5 October 2026** defaults to **September 2026**.
- First-report auto-detection does not silently change a September business period to October.
- Opening baseline **11 Sep 2026** + Monthly cutoff **30 Sep 2026** is valid.
- The same-month Monthly Review uses the verified 11 Sep Opening snapshot as its opening performance baseline, so monthly gain/movement is measured from the actual GrowVest starting point.
- Opening baseline **30 Sep 2026** + Monthly cutoff **30 Sep 2026** remains invalid because no later September cutoff exists.
- A Monthly Wealth Review can be saved/completed and its secure PDF generated while the Opening Wealth Review is still unpublished.
- Investor publication/delivery of that Monthly Review remains blocked until the Opening Wealth Review is published.
- Investors with no Opening review and no genuine legacy published review still start with an Opening Wealth Review.

## Regression boundary

No portfolio calculation, NAV valuation, PMS freshness, Bucket List allocation, PDF financial rendering, report reconciliation, investor permissions, or immutable publication-history logic is changed by this release.

## QA result

- Release audit: **539 passed, 0 warnings, 0 failures**.
- Report period / Opening baseline fixture: passed.
- Opening Review goal reconciliation fixture: passed.
- Opening Portfolio Verification fixture: passed.
- PDF encoding fixture: passed.
- Manual PMS freshness fixture: passed.
- Full `npm ci` / Next.js build could not be completed in the isolated review environment because dependency installation exceeded the execution window; production/Vercel build remains the final deployment check.
