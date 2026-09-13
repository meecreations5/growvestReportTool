# GrowVest v0.34.23 - Report Alignment & Cover Clarity Reconciliation

## Scope
This release is presentation-only. It addresses the remaining alignment and cover-clarity issues observed in the generated Opening Wealth Review PDF. Portfolio values, calculations, report data, publication logic, permissions and section order are unchanged.

## Alignment corrections
- **Your Starting Point** is reduced again and its title/body block is vertically balanced against a smaller centred icon badge.
- The **Performance** information strip is reduced from an oversized panel to a compact callout, with the icon and text baseline centred on the same visual axis.
- The **Protection details not yet added** strip now uses the same left inset rhythm as the other report callouts instead of sitting too close to the panel edge.
- The **Grow and Invest With Us** banner uses a consistent compact height, smaller centred icon badge, and corrected title/subtitle baselines.
- The custom GrowVest leaf vector is redrawn as a centred outline so its visual weight no longer falls to the lower-right of circular badges.
- Matching browser report CSS is tightened so preview and secure PDF stay visually aligned.

## Cover clarity
The locked cover photograph remains the same scene, crop, dimensions and report composition. The packaged JPEG receives a stronger local-detail and edge-recovery pass before embedding. This improves the backpack, silhouette and mountain-ridge definition without stretching the image or changing its geometry. Because the source photograph itself is soft, this is the maximum non-generative correction available without replacing the photograph with a new original.

## Renderer parity
The secure PDF renderer is bumped to `2.4.9`. Browser and secure PDF continue to use the locked GrowVest Signature design.

## UAT focus
Generate a fresh Opening Wealth Review and inspect pages 1, 2, 7 and 9 at 100% PDF zoom. Confirm cover definition, centred callout content, consistent left insets, compact closing banner, upright Rupee symbols and unchanged financial values.
