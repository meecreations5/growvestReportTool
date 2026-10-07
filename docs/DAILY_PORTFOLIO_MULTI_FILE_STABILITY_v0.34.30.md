# v0.34.30 — Daily Portfolio Multi-File Stability

## Problem
Daily Portfolio Update worked more reliably for one Fundbazaar file after v0.34.29, but selecting multiple portfolio files still pushed the whole selection through one multipart preview request and one long commit request. That made the bulk workflow vulnerable to request-size/time limits and allowed one failed Firestore BulkWriter to affect the rest of the batch.

## Fix
- Multi-file preview now analyses **one file per request** while keeping every analysed file under one GrowVest preview batch.
- The browser sends a stable `batchId`, `uploadOffset` and `finalizeBatch` flag so file order, mapping and batch totals remain intact.
- Multi-file commit now applies **one analysed report per request**.
- Every committed report gets its own Firestore BulkWriter. A write failure in one report cannot poison the writer for the next report.
- Fundbazaar daily coverage is rebuilt only on the final commit request, avoiding repeated expensive batch-wide work.
- Final imported count, investor count, duplicate count, issues and portfolio value are recomputed from all files in the batch, not only from the final request.
- Daily Portfolio Update shows `Analysing X/Y` and `Updating X/Y`, including the current file name during commit.

## Operational behaviour
Staff can still select many Fundbazaar, Bajaj Broking, Angel One, ULIP, GrowVest Standard or Trading files at once. The UI remains one bulk operation; internally GrowVest processes the files sequentially so one large morning upload does not depend on one oversized/long-running HTTP request.

If one report has a file-level problem, the other ready reports continue to be processed and the failed report remains visible as an exception.
