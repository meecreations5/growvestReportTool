# GrowVest v0.31.2 — Firestore index-building fallback

Firestore can reject otherwise-valid composite queries while a newly deployed index is still building.

This hotfix keeps the optimized indexed queries as the primary path. If Firestore returns `failed-precondition` with an index-related message, the portfolio client temporarily falls back to investor-scoped equality queries and performs the final date sorting/filtering in memory.

Covered reads:

- latest portfolio snapshot
- investor intraday history
- recent portfolio imports for advisors
- monthly report closing/opening snapshot lookup
- monthly investment transaction lookup

The composite indexes in `firestore.indexes.json` should still be deployed and allowed to finish building because they are more efficient at scale.
