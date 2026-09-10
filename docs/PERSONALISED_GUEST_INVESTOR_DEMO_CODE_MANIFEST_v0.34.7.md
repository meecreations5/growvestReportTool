# v0.34.7 Personalised Guest Investor Demo — Code Manifest

## Lead-on-agreement refinement

### `src/components/investor/DemoInvestorCta.js`
- Replaces passive navigation with an explicit server call.
- Clicking **Become part of GrowVest** creates/reuses the Demo Lead before opening the enrichment screen.
- Shows progress and inline failure state.
- Makes the contact intent explicit in the full CTA.

### `src/app/api/demo/prospect/route.js`
- Supports `express_interest` and `enrich` actions.
- Creates the normal `leads` document immediately on `express_interest`.
- Uses a deterministic Lead document ID to prevent duplicate Leads from repeated clicks.
- Starts the existing SOP 1 Lead to Conversion flow with `status: NEW`.
- Returns the existing Lead when the same Demo session re-engages.
- Updates the same Lead on enrichment.
- Prevents public enrichment from overwriting staff-entered normal Lead fields.
- Writes Lead timeline/activity events for creation, re-interest and enrichment.

### `src/app/investor/demo-interest/page.js`
- Treats the Lead as already created when opened from the CTA.
- Removes the second consent gate that previously delayed Lead creation until form submission.
- Captures optional enrichment only.
- Allows the guest to skip enrichment and continue exploring the Demo.

### `public/sw.js`
- Cache version bumped so installed Investor PWAs receive the updated CTA/lead flow.

### `scripts/qa/release-audit.mjs`
- Adds release assertions for immediate Lead creation, idempotency, normal SOP 1 handoff and same-Lead enrichment.
