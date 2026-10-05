# v0.34.28 — Reporting Period & Opening Review Flow

## Business scenario

GrowVest prepares Monthly Wealth Reviews after a calendar month closes. A September 2026 Monthly Wealth Review is therefore normally prepared between 1–5 October 2026. The date on which staff create the report must not move the report period to October.

## Rules

1. **Default reporting period = last completed calendar month.**
   - Example: 5 October 2026 -> September 2026.
2. **First-report detection preserves the selected business period.**
   - If an investor has no earlier investor-facing review, the workspace may switch to Opening Wealth Review, but it must not silently jump a September request to October.
   - The verified Portfolio Master snapshot then establishes the actual Opening baseline date.
3. **Same-month Monthly Review is valid after an earlier Opening baseline.**
   - Opening 11 September 2026 -> September Monthly cutoff 30 September 2026: allowed.
   - For that first same-month Monthly Review, Portfolio Master uses the verified Opening snapshot (11 September) as the performance/movement baseline rather than an unrelated August month-start snapshot.
   - Opening 30 September 2026 -> September Monthly cutoff 30 September 2026: not allowed; use October.
4. **Opening publication does not block internal Monthly preparation.**
   - If an Opening Wealth Review already exists but is not yet published, staff may prepare, complete and generate the secure PDF for the Monthly Wealth Review.
   - Investor publication/delivery remains blocked until the Opening Wealth Review is published.
5. **No Opening baseline at all still requires Opening first.**
   - GrowVest does not manufacture a Monthly comparison without an Opening or a genuine legacy published review.

## UX

The Reporting Period step now distinguishes:
- a true period conflict (monthly cutoff is not after the Opening baseline), and
- an unpublished Opening Review (informational operational warning with a link to open the Opening Review).

This prevents the old late-stage error: `Publish the Opening Wealth Review before creating a Monthly Wealth Review for this investor.`
