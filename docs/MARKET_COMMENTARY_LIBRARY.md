# Market Commentary Library

## Route

```text
/market-commentary
/market-commentary/create
/market-commentary/[commentaryId]/edit
```

## Purpose

The Market Commentary Library stores approved, reusable report language for GrowVest monthly Investor reports. It keeps Investor-visible content separate from internal review notes and gives Advisors a controlled way to copy approved language into Create Report.

## Supported categories

- Monthly Market Summary
- Equity Commentary
- Index Commentary
- Debt & Fixed Income
- Risk Commentary
- Strategy Commentary
- Outlook
- Reusable Advisor Note
- Disclaimer

## Content scopes

- Reporting month: tied to a selected month and year
- Reusable library: available across report months

## Workflow

1. Create a commentary draft.
2. Add reporting context, summary, Investor-visible content, tags and optional asset-class applicability.
3. Save manually or allow autosave.
4. Admin or Super Admin reviews and approves the content.
5. Approved content becomes available in Create Report Step 5.
6. Advisor selects the destination report field and copies the content.
7. The copied content remains editable and stores its source version for audit history.

## Create Report integration

In Create Report Step 5, use **Use Commentary Library**.

Approved content can be copied to:

- Advisor narrative
- Progress highlight
- Priority attention
- Portfolio opportunity
- Highlighted observation
- Report disclaimer

The report stores a `commentarySources` array containing the source commentary ID, title, category, approved version, target field and copy timestamp.

## Firestore collections

```text
marketCommentaries/{commentaryId}
marketCommentaries/{commentaryId}/versions/{versionId}
```

## Permissions

- Super Admin / Admin: create, edit, approve, archive, restore and view all versions
- Advisor: create drafts, edit/archive/restore their own drafts, duplicate and use approved content
- Investor: no access

## Deploy

```powershell
firebase deploy --only firestore:rules
```

No composite Firestore index is required.

## Testing

1. Open `/market-commentary` as Super Admin.
2. Create a monthly market summary.
3. Save the draft and confirm autosave status.
4. Approve the content.
5. Open `/reports/create` and continue to Commentary.
6. Select **Use Commentary Library**.
7. Copy the approved content into Advisor Narrative.
8. Confirm the content is editable and the source badge appears.
9. Save the report and reopen it to confirm `commentarySources` persists.
10. Test mobile at 390 px and verify the Library and editor have no horizontal scrolling.
