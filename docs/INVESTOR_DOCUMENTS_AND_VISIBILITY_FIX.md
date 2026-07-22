# Investor Documents and Portal Visibility Fix

## Where staff upload documents

1. Open **Investors** in the staff workspace.
2. Open the required Investor profile.
3. Open **Access & Documents**.
4. Create a document request.
5. Use the Upload button on the created request to upload on behalf of the Investor.

## Where Investors upload documents

1. Staff must first create a document request.
2. The Investor opens **Investor Portal > Documents**.
3. The requested document card displays an **Upload document** button.
4. After upload, the status becomes **Uploaded** and waits for staff verification.

Supported files: PDF, JPG and PNG up to 10 MB.

## Fixes in this patch

- Investor Documents query now includes `investorVisible == true`, resolving the Firestore permission-denied query issue.
- Clear document request, upload and verification instructions have been added to both staff and Investor screens.
- Staff can upload on behalf of an Investor from the same document request card.
- Investor document cards show file name, size, request instructions, verification note and status guidance.
- Global heading and anchor styles are moved into the Tailwind base layer, so `text-white`, blue link text and other utility colours work correctly.
- Fixes invisible text in dark Investor Portal cards, including Home, Reports and Profile.
- Notification panel becomes a viewport-safe mobile drawer instead of overflowing outside the mobile screen.

## Files

- `src/app/globals.css`
- `src/services/documentService.js`
- `src/app/investor/documents/page.js`
- `src/components/investors/InvestorDocumentsPanel.js`
- `src/components/notifications/NotificationBell.js`

## Apply

Extract the patch into the project root and allow the files to replace existing versions.

```powershell
Ctrl + C
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
npm run dev
```

Test:

- `/investor/dashboard`
- `/investor/reports`
- `/investor/profile`
- `/investor/documents`
- `/investors/[investorId]` > Access & Documents

If the Investor still receives `permission-denied`, verify `users/{uid}.investorId` exactly matches the Investor document ID and deploy the current Firestore and Storage rules.
