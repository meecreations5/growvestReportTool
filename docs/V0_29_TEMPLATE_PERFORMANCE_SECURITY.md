# Version 0.29.0 — Template reliability, performance, secure offline and security hardening

## Report template reliability
- The report editor re-reads the selected template directly from Firestore before applying it.
- The published template version and a fresh immutable snapshot are saved immediately on existing reports.
- Existing working PDFs are invalidated after template changes and must be regenerated.
- HTML, print preview and PDF continue to resolve the same report-level template snapshot.

## Performance
- Heavy report chart components are loaded only when the report view needs them.
- Firestore uses an in-memory cache only, reducing persistent sensitive data and stale-template behaviour.
- Existing workspace search caching, pagination/query limits and service-worker static caching remain enabled.

## Restricted offline data
- Firestore IndexedDB persistence is disabled for every role.
- Investor reports, portfolio records, documents, PDFs and MOM data are online-only.
- Only static PWA shell assets, branding and the offline status page may be cached by the service worker.

## Security hardening
- Sensitive financial records no longer persist in browser Firestore storage.
- Existing Firebase Rules, Storage Rules, security headers, API authorization and audit logging remain required.
- Run Firebase Emulator Suite rule tests before production enforcement and perform a separate penetration test before launch.

## UAT
1. Activate a report template.
2. Edit an existing report and select the template.
3. Confirm the success message shows the active version.
4. Open HTML preview and verify colours/layout.
5. Regenerate PDF and compare it with HTML.
6. Sign in as Investor, go offline and confirm financial pages do not expose cached data.
