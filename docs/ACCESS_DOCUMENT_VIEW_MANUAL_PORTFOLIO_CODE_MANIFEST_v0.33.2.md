# Access & Documents View + Manual Portfolio Upload — Code Manifest v0.33.2

This patch is applied on top of the GrowVest v0.33.2 Profile Withdrawal / Report Delete workflow build.

## Changed / added files

1. `src/services/documentService.js`
   - Adds secure in-browser document viewing from the existing Firebase Storage object.

2. `src/components/investors/InvestorDocumentsPanel.js`
   - Adds **View** in Investor Profile → Access & Documents while retaining Download/Verify/Reject.

3. `src/app/investor/documents/page.js`
   - Adds **View** for Investor-visible uploaded/verified documents.

4. `src/app/api/portfolio/manual-template/route.js`
   - Updates the single-Investor Manual Portfolio workbook naming to v0.33.2 and clarifies General Wealth default mapping.

5. `src/components/portfolio/ManualPortfolioExcelPanel.js`
   - Clarifies that this upload is for investments maintained manually rather than by provider feed and labels the template action as **Download Holdings Template**.

6. `scripts/qa/release-audit.mjs`
   - Adds regression checks for document viewing and Manual Portfolio template/default-bucket behaviour.

7. `docs/ACCESS_DOCUMENT_VIEW_AND_MANUAL_PORTFOLIO_UPLOAD_v0.33.2.md`
   - Documents staff/investor document viewing and both Manual Portfolio Excel workflows.

8. `docs/ACCESS_DOCUMENT_VIEW_MANUAL_PORTFOLIO_CODE_MANIFEST_v0.33.2.md`
   - This manifest.

## Existing Manual Portfolio formats confirmed

- Single Investor current-holdings workbook: `GrowVest_Manual_Portfolio_Template_v0.33.2.xlsx`
- Full multi-Investor Manual Portfolio Management workbook: `GrowVest_Manual_Portfolio_Management_Multi_Investor_Template_v0.33.2.xlsx`
