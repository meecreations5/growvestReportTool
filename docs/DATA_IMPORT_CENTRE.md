# GrowVest Data Import Centre

## Version

`0.16.0`

## Route

```text
/data-imports
```

The Data Import Centre allows GrowVest staff to upload monthly portfolio data from CSV, XLSX or XLS files, map source columns, validate the data, correct or exclude failed rows, and apply the validated values to a monthly Investor report.

## Workflow

1. Upload File
2. Map Columns
3. Validate Data
4. Review Errors
5. Confirm Import
6. Use Data in Report

## Supported files

- CSV
- XLSX
- XLS
- Maximum file size: 5 MB
- Maximum imported rows per file: 300

The file is parsed in the browser. Original file bytes are not uploaded to Firebase Storage. The validated import metadata and normalised row data are stored in Firestore for audit and report reuse.

## Required mappings

- Instrument
- Asset Class
- Closing / Current Value

## Optional mappings

- Opening Value
- New Investment
- Withdrawal
- Profit / Loss
- Return Percentage
- Monthly SIP
- Quantity
- Transaction Date
- Notes

## Validation checks

- Missing instrument name
- Missing asset class
- Invalid financial values
- Negative current value
- Negative investment or withdrawal
- Closing-value reconciliation mismatch
- Duplicate instrument and asset-class combination
- Unusual return above 50 percent

Failed rows must be corrected or excluded before confirmation. Warning rows can be imported after review.

## Report mapping

A confirmed import populates:

- Portfolio Summary
- Total Current Corpus
- Total Monthly SIP
- New Money Added
- Investment Gain / Loss
- Opening Portfolio Value
- Total Withdrawals
- Asset-Class Holdings
- Portfolio Allocation
- Fund-wise Detailed Holdings
- Transactions section for investments and withdrawals

The monthly report remains editable after data is applied.

## Firestore collections

```text
dataImports/{importId}
monthlyReports/{reportId}
```

A data import record stores:

- Investor and reporting period
- Source file metadata
- Column mapping
- Validated rows
- Validation summary
- Normalised report payload
- Target or imported report ID
- Audit user and timestamps

## Permissions

- Super Admin: all imports
- Admin: all imports
- Advisor: imports for records assigned to that Advisor
- Investor: no Data Import Centre access

## New dependency

```text
xlsx@^0.18.5
```

Install dependencies with:

```powershell
npm install
```

Do not use `npm ci` until the local `package-lock.json` has been refreshed by `npm install` after applying the patch.

## Firebase deployment

Deploy the new Firestore rules and index:

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

## End-to-end test

```text
Open /data-imports
→ Download Sample CSV
→ Start New Data Import
→ Select Investor and month
→ Upload CSV or Excel file
→ Review automatic mappings
→ Run validation
→ Correct or exclude failed rows
→ Confirm import
→ Open/Create Monthly Report
→ Review Portfolio Data and Calculations
→ Save Draft
→ Confirm the Import History status changes to Used in Report
```

## Files added

```text
src/app/(portal)/data-imports/page.js
src/components/data-imports/DataImportCentre.js
src/components/data-imports/DataImportWizard.js
src/lib/constants/dataImport.js
src/lib/utils/dataImport.js
src/services/dataImportService.js
docs/DATA_IMPORT_CENTRE.md
```

## Files updated

```text
src/lib/constants/navigation.js
src/components/reports/ReportForm.js
src/components/reports/MonthlyWealthReport.js
src/components/reports/MonthlyReportPrintDocument.js
src/services/reportService.js
firestore.rules
firestore.indexes.json
package.json
package-lock.json
```
