# GrowVest v0.34.5 — Investor Experience Reconciliation + Exact Home Transition Exact4

## Release validation

- Project QA audit: **332 passed / 0 warnings / 0 failures**.
- Exact Home reference: approved screenshot remains the visual source of truth.
- Hero-to-content structure: white content sheet overlaps the Royal Trust Blue hero by **26px** with **26px rounded top shoulders**.
- Quick actions sit inside the white sheet with a 14px side gutter and 18px radius.
- Monthly Review: Deep Premium Black feature block remains visible even before a review is published, using an honest placeholder state.
- Persistent phone navigation: **Home / Portfolio / GrowVest / Bucket List / Reports**.
- Profile remains accessible from the Home avatar and GrowVest action menu.
- Existing v0.34.5 SIP intelligence, verified portfolio notification, notification preferences and Investor Add Bucket List approval workflow are retained.
- Installed-PWA cache: `growvest-investor-v0.34.5-home-exact4` / `growvest-pages-v0.34.5-home-exact4`.

## Environment limitation

A dependency-backed `npm run lint` / `npm run build` is not certified in this packaged environment because `node_modules` is intentionally excluded. Run locally after `npm ci`.
