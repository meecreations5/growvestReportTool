# Report Template Persistence and Investor OTP Fix

Version: 0.25.3

## Report-template correction

- Selecting a template on an existing report now saves it immediately instead of waiting only for delayed autosave.
- Report-level `templateId` and `templateVersion` override stale values inside older snapshots.
- HTML and A4 previews remount when the applied template/version changes.
- Existing PDF metadata is cleared and the report is marked for PDF regeneration.
- Active templates with unpublished editor changes show a warning; draft template changes must be activated before a report can use them.
- PDF renderer metadata is now `2.1.0`.

## Firebase Phone OTP correction

The Phone provider toggle alone is not sufficient for current Firebase projects. Configure all of the following in the same Firebase project used by the deployed web app:

1. Authentication → Sign-in method → Phone: Enabled.
2. Authentication → Settings → SMS region policy: allow India (+91).
3. Authentication → Settings → Authorized domains: add `insights.growvest.info`.
4. Project settings → Your apps → Web app: ensure `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` and `appId` are copied from the same app into production environment variables.
5. Billing: enable it if Firebase requires it for real SMS delivery.

The login screen now reports this checklist for `auth/operation-not-allowed` instead of incorrectly claiming only that the Phone provider is disabled.
