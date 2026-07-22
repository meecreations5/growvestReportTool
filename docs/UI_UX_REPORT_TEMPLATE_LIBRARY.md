# GrowVest Report Template Library

## Scope

This release adds the first stage of the Report Template Library. It provides a controlled, report-focused template catalogue without creating a free-form design builder.

Routes:

```text
/report-templates
/report-templates/[templateId]
```

## Standard templates

1. Premium Blue
2. Executive Minimal
3. Performance Focus
4. Detailed Portfolio
5. Compact Investor Summary
6. Custom Branded Starter

Each built-in template defines:

- Category and intended use
- Section order
- Section visibility
- Cover style
- Chart style
- Table density
- Advisor-card visibility
- GrowVest colours
- Estimated PDF page count

## Library functionality

- Responsive template-card library
- Desktop, Mobile and A4 template previews
- Search, category, status and sorting filters
- Active, Draft and Archived states
- Default-template identification
- Template details with Overview, Sections, Appearance, Usage and Version History
- Custom draft creation from a standard template
- Template duplication
- Set default template
- Archive and restore custom templates
- Loading, empty, error and confirmation states

## Permissions

| Role | Access |
|---|---|
| Super Admin | View, create draft copies, set default, archive and restore |
| Admin | View and create draft copies |
| Advisor | View and preview active templates |
| Investor | No Template Library access |

## Firestore

New collection:

```text
reportTemplates/{templateId}
```

The application renders the six built-in templates immediately. When an Admin or Super Admin opens the Library, missing standard records are initialised in Firestore after the updated rules have been deployed.

Deploy:

```powershell
firebase deploy --only firestore:rules
```

No Firestore index is required.

## Template record

```javascript
{
  name: "Premium Blue",
  slug: "premium-blue",
  description: "GrowVest's complete premium monthly wealth report...",
  category: "premium",
  status: "active",
  isDefault: true,
  isSystemTemplate: true,
  version: 1,
  estimatedPages: "8–10 pages",
  sectionOrder: [],
  sectionVisibility: {},
  appearance: {
    coverStyle: "premium-dark",
    coverPattern: "orbital",
    primaryColor: "#1F4ED8",
    secondaryColor: "#20B8CD",
    darkColor: "#0B1220",
    chartStyle: "modern",
    tableDensity: "comfortable",
    advisorCardVisible: true,
    headerStyle: "compact",
    footerStyle: "legal"
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdByUid: "...",
  updatedByUid: "..."
}
```

## Existing reports

This stage does not modify current monthly reports. Reports without `templateId` continue using the existing Premium Blue presentation.

The next stage will add:

- Structured Template Editor
- Template selection in Create Report
- `templateId`, `templateVersion` and immutable `templateSnapshot` in report records
- HTML and PDF rendering from the selected snapshot

## Testing

Test the Library at:

```text
/report-templates
```

Recommended widths:

```text
390px
768px
1280px
1440px
```

Verify:

- Six standard templates are visible
- Default template is clearly identified
- Template preview opens
- Preview mode switches between Desktop, Mobile and A4
- Admin can create a custom draft
- Super Admin can set default, archive and restore
- Advisor can preview but cannot manage templates
- No horizontal scrolling occurs on mobile
