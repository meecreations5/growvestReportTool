# UI/UX Stage 2 — Report Template Editor and Integration

## Release

GrowVest Investor & Monthly Report Generator `0.15.0`

## Scope

This release extends the Report Template Library with a structured editor and connects active templates to monthly report creation, responsive HTML preview and PDF generation.

The implementation is deliberately structured rather than a free-form page builder. Staff can configure approved report sections and presentation settings while preserving GrowVest brand consistency.

## New route

```text
/report-templates/[templateId]/edit
```

## Template Editor

The editor provides:

- Template name, description, category and estimated output length
- Protected standard templates with a **Create editable copy** action
- Section visibility controls
- Drag-and-drop section ordering
- Accessible Move Up and Move Down alternatives
- Mandatory protection for Cover, Executive Summary and Disclaimer
- Cover style and background pattern
- Advisor profile card visibility
- Chart style and table density
- Primary, secondary and dark-surface colours
- Header, footer and disclaimer configuration
- Desktop, mobile and A4 preview modes
- Debounced autosave for custom drafts
- Manual Save Draft action
- Unsaved-change reset
- Super Admin activation and template version creation
- Responsive settings drawer and sticky mobile actions

## Template permissions

| Role | Access |
|---|---|
| Super Admin | Create copies, edit drafts, activate versions, manage defaults and archive custom templates |
| Admin | Create copies, edit and save drafts, preview templates |
| Advisor | View and select active templates |
| Investor | No Template Library access |

GrowVest standard templates remain read-only. Admin or Super Admin users can duplicate a standard template and edit the custom copy.

## Versioning

Custom changes are staged as draft configuration. When an already-active template is edited, its currently active version and default status remain available to Advisors and Create Report users until a Super Admin activates the draft.

Activating a custom template:

1. Promotes the staged draft configuration without interrupting the currently active version.
2. Increments its version.
3. Marks the promoted configuration active.
4. Saves an immutable version record under:

```text
reportTemplates/{templateId}/versions/v{version}
```

5. Adds the activation to the template's Version History tab.

Previously saved reports preserve their own template snapshot, so later template changes do not alter already generated or published reports.

## Create Report integration

Step 7 — Template now displays all active templates with:

- Live report thumbnail
- Category
- Default/recommended state
- Visible section count
- Estimated output length
- Preview action
- Select action

The selected report stores:

```javascript
{
  templateId: "template-document-id",
  templateVersion: 2,
  templateSnapshot: {
    id: "template-document-id",
    name: "Premium Blue",
    version: 2,
    category: "premium",
    estimatedPages: "8–10 pages",
    sectionOrder: [],
    sectionVisibility: {},
    appearance: {}
  }
}
```

The snapshot is saved on draft and completion. Existing reports without template fields automatically use the Premium Blue system template.

## HTML report integration

The responsive report applies the saved snapshot to:

- Report section order
- Section visibility
- Cover dark colour
- GrowVest logo visibility
- Confidential label visibility
- Client code visibility
- Advisor card visibility
- Transactions section visibility
- Commentary and disclaimer placement
- Staff and Investor section navigation

The report remains responsive: allocation and holding sections continue to use mobile-friendly cards.

## PDF and print integration

The browser print document and server PDF renderer use the same saved template snapshot for:

- Page/section order
- Section visibility
- Advisor profile visibility
- Client-code visibility
- Table density
- Transactions inclusion
- Disclaimer style
- Header/footer document settings where supported

This keeps HTML, print and secure PDF outputs aligned.

## Firestore rule update

A new nested version rule is included:

```text
/reportTemplates/{templateId}/versions/{versionId}
```

Deploy the updated rules:

```powershell
firebase deploy --only firestore:rules
```

No new Firestore index is required.

## Updated files

```text
firestore.rules
package.json
package-lock.json
src/app/(portal)/report-templates/[templateId]/edit/page.js
src/components/report-templates/ReportTemplateEditor.js
src/components/report-templates/ReportTemplateDetail.js
src/components/report-templates/ReportTemplateLibrary.js
src/components/reports/create/ReportTemplateSelectionStep.js
src/components/reports/ReportForm.js
src/components/reports/MonthlyWealthReport.js
src/components/reports/MonthlyReportPrintDocument.js
src/components/reports/ReportDetailClient.js
src/components/reports/InvestorReportDetailClient.js
src/lib/constants/reportTemplates.js
src/lib/constants/report.js
src/lib/server/reportPdf.js
src/services/reportTemplateService.js
src/services/reportService.js
```

## Installation

Copy the patch into the project root and allow matching files to be replaced.

```powershell
Ctrl + C
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
firebase deploy --only firestore:rules
npm install
npm run build
npm run dev
```

## Testing routes

```text
/report-templates
/report-templates/[templateId]
/report-templates/[templateId]/edit
/reports/create
/reports/[reportId]
/investor/reports/[reportId]
/report-print/[reportId]
```

## Recommended test scenarios

1. Open Premium Blue and confirm the editor is read-only.
2. Create an editable copy.
3. Rename the copy and change section order.
4. Hide a non-mandatory section.
5. Confirm Cover, Executive Summary and Disclaimer cannot be hidden.
6. Change cover, chart and document settings.
7. Verify desktop, mobile and A4 thumbnails update.
8. Confirm autosave status changes from Unsaved to Autosaving to Saved.
9. Activate the template as Super Admin.
10. Confirm a new version appears in Version History.
11. Open Create Report Step 7 and select the activated template.
12. Save the report and reload it; confirm the template remains selected.
13. Confirm staff HTML, Investor HTML, print and secure PDF use the saved section order and visibility.
14. Modify and reactivate the template; confirm the previously saved report does not change.

## Responsive checks

Test at:

```text
390 px
768 px
1280 px
1440 px
```

On mobile, verify:

- The settings panel opens as a drawer.
- Section visibility controls remain touch-friendly.
- Preview modes remain usable.
- Save and Activate/Settings actions remain accessible.
- No horizontal page scrolling occurs.

## Current boundary

The editor supports structured configuration and versioning. It does not provide arbitrary HTML/CSS editing, custom font upload or unrestricted page composition. These restrictions protect report consistency, accessibility and GrowVest brand integrity.
