# v0.34.5 Exact Home Transition Correction — Exact4

The approved Home screenshot remains the visual source of truth. This correction addresses the remaining hero-to-content composition mismatch without changing Investor App data logic.

## Locked transition
- Royal Trust Blue hero remains full width and retains its approved height.
- A separate white content sheet overlaps the hero upward by **26px**.
- The sheet exposes **26px rounded top-left and top-right shoulders** over the blue hero.
- The quick-action tray does not use an independent negative-margin float.
- The tray sits **inside** the rounded white sheet with the approved 14px side gutter and 18px radius.
- The first content section begins 14px below the tray for the compact reference rhythm.
- The Deep Premium Black Monthly Review block is always present. If no review is published yet, it shows an honest placeholder state linking to Reports.
- GrowVest Partner remains below Monthly Review.
- Persistent mobile navigation remains **Home / Portfolio / GrowVest / Bucket List / Reports**.
- Installed PWA cache is `v0.34.5-home-exact4`.
