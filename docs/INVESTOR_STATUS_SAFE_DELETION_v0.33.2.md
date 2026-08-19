# GrowVest v0.33.2 - Investor Status & Safe Deletion

## Purpose

Admin and Super Admin can now temporarily disable an Investor or remove an Investor from active GrowVest records without using Firestore manually.

## Where it appears

Open **Investors → select Investor → Access & Documents → Investor Status & Deletion**.

The Investor list also shows **Active / Disabled** and supports status filtering.

## Disable Investor

Disable is the normal temporary action.

It:
- keeps the Investor profile available to staff;
- sets the Investor to inactive/disabled;
- disables linked Firebase Auth Investor accounts and revokes refresh tokens;
- disables Investor Portal access;
- pauses active SIP Funding schedules with a lifecycle marker;
- records the Admin, timestamp and mandatory reason in the Investor record and activity log.

It does not delete portfolio, reports, documents, goals, meetings, actions or transaction history.

## Enable Investor

Enable returns the Investor to active status.

It:
- resumes only SIP schedules that were paused by Investor disablement;
- restores portal access only when portal access was active immediately before the Investor was disabled;
- keeps portal access disabled when it had already been disabled before the lifecycle action;
- records the Admin, timestamp and reason.

## Delete Investor

**Delete Investor** is a retained-record soft delete. This is intentional for a financial operations system.

Before confirmation, GrowVest shows counts for retained records including:
- portfolio holdings;
- investment transactions;
- trading transactions;
- ULIP policies;
- portfolio snapshots;
- Monthly Reports;
- documents;
- meetings;
- Advisor Follow-ups;
- linked portal accounts.

Admin must enter a deletion reason and type `DELETE`.

On confirmation GrowVest:
- sets `isDeleted=true` and `lifecycleStatus=deleted`;
- removes the Investor from active Investor queries;
- disables linked portal accounts and revokes sessions;
- pauses SIP schedules;
- deactivates external Investor mappings so future imports cannot silently continue against the deleted Investor;
- writes an activity log with the retained-record impact summary.

Financial/history collections are not physically erased. Published Monthly Reports remain unchanged.

## Permissions

Only `admin` and `super_admin` can call the lifecycle endpoint. Advisors can still view Investors within their normal assignment rules but cannot disable, enable or delete the Investor lifecycle record.

## UAT

1. Open an active Investor as Admin.
2. Go to Access & Documents and choose **Disable Investor**.
3. Enter a reason and confirm.
4. Verify the Investor remains in the Investor list with status **Disabled**.
5. Verify Investor Portal authentication is blocked and lifecycle-paused SIP reminders stop.
6. Choose **Enable Investor**, enter a reason, and confirm.
7. Verify status returns to **Active** and lifecycle-paused SIP schedules resume.
8. Open **Delete Investor** and verify the impact preview counts are displayed.
9. Confirm the delete button remains disabled until a reason is entered and `DELETE` is typed.
10. Delete a test Investor and verify the Investor disappears from the active Investor list.
11. Verify portfolio/report/document records remain in Firestore and the activity log contains `investor_deleted` with `deletionMode=soft_delete_with_retention`.
12. Verify future portfolio administration calls reject the deleted Investor record.

## Deployment

No Firestore rule or index deployment is required by this release. The lifecycle endpoint uses the Firebase Admin SDK and existing authenticated server request controls.
