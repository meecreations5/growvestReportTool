# Access Document Popup + Manual Investment Template Code Manifest — v0.33.2

This hotfix is incremental to `v0.33.2_access_documents_manual_portfolio_hotfix`.

Changed/new files:

1. `src/services/documentService.js`
   - Secure file fetch now returns a temporary Object URL for in-app preview.
   - Preserves the document MIME type to avoid blank/black standalone PDF rendering.

2. `src/components/documents/DocumentPreviewModal.js`
   - New shared popup preview for PDF/JPG/PNG.
   - Supports Escape/backdrop close and Download without leaving GrowVest.

3. `src/components/investors/InvestorDocumentsPanel.js`
   - Staff View action opens the shared popup before/after verification.

4. `src/app/investor/documents/page.js`
   - Investor View action opens the same secure popup.

5. `public/templates/GrowVest_Manual_Investment_Template_v0.33.2.xlsx`
   - Approved simplified one-investor Manual Investment workbook embedded in the application.

6. `src/app/api/portfolio/manual-template/route.js`
   - Authenticated endpoint now serves the packaged approved workbook exactly.

7. `src/components/portfolio/ManualPortfolioExcelPanel.js`
   - Renamed workflow/button to Manual Investment terminology.
   - References the simplified Manual Investments + optional Transactions workbook.

8. `src/app/api/portfolio/investors/[investorId]/manual-import/route.js`
   - Parses the `Manual Investments` sheet and approved headers.
   - Supports Investment Date, SIP Status and scheduled SIP amount.
   - Supports the optional `Transactions (Optional)` sheet and writes confirmed manual transaction history.
   - Preserves General Wealth default and existing valid Bucket List mapping rules.
   - Keeps Buy/Sell/Income/Fee activity out of external cash-flow calculations; Switch remains internal and Redemption remains withdrawal.

9. `src/components/portfolio/InvestorPortfolioPanel.js`
   - Preserves the entered investment-type label for manually managed Other-category products such as AIF/NPS/PPF/EPF.

10. `src/lib/constants/report.js`
    - Monthly Report preserves the manual investment-type label instead of flattening these holdings to `Other`.

11. `docs/ACCESS_DOCUMENT_VIEW_AND_MANUAL_PORTFOLIO_UPLOAD_v0.33.2.md`
    - Updated workflow/UAT documentation.

12. `scripts/qa/release-audit.mjs`
    - Adds regression checks for popup preview and the embedded simplified workbook/import contract.

13. `docs/ACCESS_DOCUMENT_POPUP_MANUAL_INVESTMENT_CODE_MANIFEST_v0.33.2.md`
    - This manifest.
