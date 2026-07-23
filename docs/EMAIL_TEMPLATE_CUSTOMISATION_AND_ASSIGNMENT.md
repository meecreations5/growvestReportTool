# Email Template Customisation and Report Template Assignment

Version 0.24.0 introduces versioned report-delivery email templates and links them to report templates.

## Main routes

- `/email-delivery/templates` — email-template library
- `/email-delivery/templates/[templateId]/edit` — content, header, design, signature, preview and version history
- `/report-templates/[templateId]/edit` — report-template delivery assignment
- `/email-delivery` — send, schedule, retry and send-test workflow

## Email-template capabilities

- Dynamic subject, preheader, eyebrow, heading, greeting, message, CTA, privacy note and footer text
- Merge fields for Investor, report, Advisor and company details
- Header background and text colours
- Configurable coloured divider line and thickness
- Canvas, card, typography, CTA and footer styling
- Desktop and mobile previews
- Draft and activation workflow with permanent version snapshots

## Signature integration

The template selects one of these sources:

1. Assigned Advisor's published signature
2. Report creator's published signature
3. Relationship manager's published signature
4. Default company signature
5. No signature

The template controls visibility. The actual signature data continues to come from **My Signature**, while logos, icon, address, website and social profiles come from published Branding settings.

## Report-template assignment

Each report template stores:

- Email-template ID, name and version
- Complete email-template snapshot
- Signature source
- Include secure report link
- Attach generated PDF
- Include signature

When a monthly report is created, the report stores the report-template snapshot, including the selected email-template snapshot. Later design changes therefore do not alter historical reports or previously sent emails.

## Delivery history

Every send stores the rendered subject and HTML plus report-template, email-template and signature metadata. Retrying an existing delivery uses its preserved email-template snapshot unless the user explicitly selects a different template.

## Firebase

Deploy the updated rules after integration:

```bash
firebase deploy --only firestore:rules
```

The `emailTemplates` collection and its `versions` subcollection are writable by Admin roles. Active templates can be read by Advisors for report delivery.
