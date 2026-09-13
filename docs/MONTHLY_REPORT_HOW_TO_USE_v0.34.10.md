# GrowVest v0.34.10 - Monthly Report How-To-Use Guide

## Purpose

This guide explains the correct operational sequence for creating, reviewing, generating and delivering a GrowVest Monthly Wealth Progress Report.

The report has three distinct output states:

1. Working HTML report - editable staff view.
2. Secure PDF - generated from the completed working report and stored privately.
3. Published version - immutable snapshot visible to the Investor.

Do not treat these three states as interchangeable.

## Correct workflow

### 1. Select Investor

Choose the Investor for whom the report is being prepared.

The report inherits the Investor identity, assigned Advisor and available profile context.

### 2. Reporting Period

Select:

- Reporting month
- Report year
- Statement date
- Report title

Confirm that a duplicate Monthly Report does not already exist for the same Investor and month.

### 3. Portfolio Data

Confirm the eligible Portfolio Master source and reporting cutoff.

Review:

- Total portfolio value
- Holdings
- Transactions
- Money added
- Money withdrawn
- Monthly SIP
- Gain / loss

Where Portfolio Master is the source, current financial facts should remain source-controlled rather than manually rewritten.

### 4. Review Calculations

Confirm that entered and calculated totals reconcile.

Resolve differences between:

- Total corpus
- Asset-class total
- Fund-wise total
- Allocation percentages
- Goal progress

Calculated values are intentionally read-only.

### 5. Commentary

Add Investor-facing commentary:

- Monthly narrative
- Progress highlight
- Priority attention
- Portfolio opportunity
- Relevant monthly highlights

Keep commentary factual and consistent with the verified portfolio values.

### 6. Goals & Allocation

Review:

- Bucket List goals
- General Wealth assignments
- Goal-linked investments
- Current allocation
- Target allocation
- Variance

Do not change the underlying investment merely to change its Bucket List presentation.

### 7. Template

Choose the approved report template.

The report stores a versioned template snapshot. This prevents a future template edit from changing an older report or published version.

Use **Save & preview report** after applying a template.

### 8. Preview & Approval

Before completion, review:

- Investor-visible actions
- Advisor recommendations
- Next review
- Disclaimer / compliance text
- Template presentation
- Completion validation

The working report should be visually checked before the report is completed.

### 9. Generate Secure PDF

The secure PDF becomes available only after the report is completed.

Recommended sequence:

1. Complete the report.
2. Open the report review page.
3. Open **Preview PDF**.
4. Compare the A4 preview with the working HTML report.
5. Select **Generate / Regenerate PDF**.
6. Download the generated PDF and visually verify it.

If the report or its applied template changes after a PDF has been generated, the working PDF becomes stale. Regenerate it before publishing or sending the report.

### 10. Deliver Report

After the secure PDF is verified:

1. Publish the report to the Investor Portal.
2. Confirm the new immutable published version.
3. Send the Investor email / communication.
4. Confirm the Investor can open the published report and secure PDF.

## Published report rule

Published versions are immutable.

If a published report needs changes:

1. Edit the working report.
2. Review the revised HTML output.
3. Regenerate the working PDF.
4. Verify the new PDF.
5. Publish the revision only after approval.

The previously published version remains the active Investor version until the revision is published.

## Staff quick sequence

`Create / Edit -> Save & Preview -> Complete Report -> Preview PDF -> Generate / Regenerate PDF -> Verify PDF -> Publish -> Send to Investor`

## UI implementation

A **How to use** control is available in the Create / Edit Monthly Report header. It provides the same operational sequence inside the application for staff.
