# Document Preview Stream Hotfix — v0.33.2

## Issue confirmed

In **Investors → Investor Profile → Access & Documents**, clicking **View** could remain on `Opening…` and the preview popup would never appear. The previous implementation attempted to read the protected Firebase Storage object directly in the browser with the Firebase `getBlob()` API. That browser-side read depends on Storage CORS/browser behavior and can stall even though the same file was uploaded successfully.

The shared card also used one `workingId` for Upload, View and status operations, so clicking View could incorrectly make the Upload button display `Uploading…` at the same time.

## Fix

1. Added authenticated endpoint:
   - `GET /api/investor-documents/[documentId]/file`
   - verifies the Firebase ID token / optional App Check through the existing `verifyAppRequest()` path;
   - checks Admin, current Advisor or linked Investor access;
   - validates that the stored path belongs to the requested Investor/document;
   - reads the protected object server-side with Firebase Admin Storage;
   - returns `private, no-store` content with the verified MIME type and `nosniff`.

2. `documentService.js` no longer uses browser Firebase Storage `getBlob()` for View/Download. It fetches the same-origin authenticated endpoint and creates a short-lived browser Object URL only after the authorised response is received.

3. The document preview popup now opens immediately and displays **Opening secure document…** while the protected file is loading. It remains cancellable with the close button, backdrop or Escape.

4. Staff and Investor document cards now use action-specific state (`upload:`, `view:`, `download:`, `status:`), so View no longer makes Upload appear to be running.

5. A 45-second client timeout prevents the View action from remaining stuck indefinitely and gives a retryable error instead.

## Files changed

- `src/app/api/investor-documents/[documentId]/file/route.js` — new
- `src/services/documentService.js`
- `src/components/documents/DocumentPreviewModal.js`
- `src/components/investors/InvestorDocumentsPanel.js`
- `src/app/investor/documents/page.js`
- `scripts/qa/release-audit.mjs`
- `docs/ACCESS_DOCUMENT_VIEW_AND_MANUAL_PORTFOLIO_UPLOAD_v0.33.2.md`
- `docs/DOCUMENT_PREVIEW_STREAM_HOTFIX_v0.33.2.md`

## UAT

Test with both a PDF and a JPG/PNG:

1. Open an Investor → **Access & Documents**.
2. Click **View** on a document that already has a file.
3. The popup should appear immediately with a loading state, then show the file.
4. During View, the Upload/Replace button must not say `Uploading…`.
5. Close with X, backdrop and Escape.
6. Test Download from the card and from the popup.
7. Repeat from **Investor Portal → Documents**.
