# Report Template Application & PDF Refresh Fix

Version: 0.25.2

## Problem corrected

An active report template could be selected while editing an existing monthly report, but the user could still see the previous output because the report retained old PDF metadata and the staff PDF download route preferred the active published snapshot. The template library also compared only the template ID visually, so an older version of the same template appeared as already selected.

## Corrected behaviour

1. Selecting a report template writes its active `templateId`, `templateVersion` and versioned `templateSnapshot` into the working monthly report.
2. The template step shows both the report's applied version and the currently active template version.
3. When the same template has a newer active version, the action changes to **Apply latest vX**.
4. A report-content or template change invalidates the current working PDF metadata.
5. The previous active published version remains immutable and available to the Investor until a revision is published.
6. Staff HTML preview and A4 preview use the current working report.
7. Staff PDF download uses the current working PDF. Published-version downloads remain available through Version History.
8. Investor PDF download continues to use only the active published report version.

## How to test

### Unpublished report

1. Open **Monthly Reports** and edit an existing report.
2. Go to **Template**.
3. Select a different active template, or select **Apply latest version**.
4. Confirm the selected-output card shows the new template name and version.
5. Select **Save & preview report**.
6. Verify the staff HTML report header shows the selected template name/version.
7. Verify the cover style, colours, section visibility and section order reflect the selected template.
8. Open **Preview PDF** and verify the toolbar shows the working report template name/version.
9. Complete the report if required, then select **Generate / Regenerate PDF**.
10. Download the PDF and confirm it matches the current working preview.

### Previously published report

1. Edit the published report and change its template.
2. Confirm the report remains visible to the Investor through its existing published version.
3. Confirm the staff report shows **Revision in progress** and a stale-PDF warning.
4. Generate a new PDF for the working revision.
5. Review the HTML and PDF.
6. Select **Publish Revision** only after approval.
7. Verify the Investor now sees the new published version.

## Expected data behaviour

The working `monthlyReports/{reportId}` record updates its template snapshot and clears stale working-PDF fields. The old `reportVersions/{versionId}` record is not modified. On regeneration or publishing, the working PDF fields are recreated and the stale markers are cleared.

## No Firebase rule change

This correction does not require new Firestore or Storage rules. Deploy the application normally.
