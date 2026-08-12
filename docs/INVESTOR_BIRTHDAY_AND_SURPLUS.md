# Investor Birthday Reminder and Auto Surplus

> **Superseded for birthday operations by v0.32.5.** See `BIRTHDAY_OCCASION_MANAGEMENT_v0.32.5.md` for multi-reminder schedules, family occasions, touchpoint completion and the staff Occasion Centre. The monthly-surplus guidance below remains valid.


## Added investor profile fields

The Investor and Client Assessment personal profile now supports:

- `dateOfBirth` in `YYYY-MM-DD` format.
- `age`, automatically calculated from date of birth when DOB is available.
- `birthdayReminderEnabled`.
- `birthdayReminderDaysBefore` with 0, 1, 3, 7, 14 or 30 day UI options.
- `monthlySurplusMode`: `fixed` or `percentage`.
- `monthlySurplusPercentage` when percentage mode is selected.
- `monthlySurplus`, which remains the final monthly investable surplus used by existing screens and downstream logic.

Existing investor records remain compatible. Records without the new fields are treated as fixed-surplus records until edited.

## Percentage surplus calculation

Percentage mode calculates the monthly surplus from annual income:

```text
Monthly income = Annual income / 12
Monthly surplus = Monthly income x Surplus percentage / 100
```

Example:

```text
Annual income: Rs 12,00,000
Monthly income: Rs 1,00,000
Surplus percentage: 25%
Calculated monthly surplus: Rs 25,000
```

The calculated amount is stored in `personalProfile.monthlySurplus`, so existing reports and profile widgets continue to work without needing a migration.

## Birthday reminder cron

Protected endpoint:

```text
GET /api/cron/birthday-reminders
x-cron-secret: <CRON_SECRET>
```

The endpoint should be invoked once per day by the hosting scheduler or another cron service.

The job:

1. Uses `Asia/Kolkata` as the reminder date timezone.
2. Scans active investors with birthday reminders enabled.
3. Compares the next birthday with the configured reminder lead time.
4. Creates an in-app notification for the assigned Advisor.
5. Uses a deterministic notification ID so the same birthday reminder is not created twice in the same year.
6. Does not automatically send an investor email or birthday wish; the Advisor can review the profile and use the approved communication template.

February 29 birthdays use February 28 in non-leap years for reminder purposes.

## Files changed

- `src/lib/constants/assessment.js`
- `src/lib/validation/assessmentSchema.js`
- `src/components/assessment/AssessmentPageClient.js`
- `src/components/investors/InvestorEditClient.js`
- `src/components/investors/InvestorDetailClient.js`
- `src/app/investor/profile/page.js`
- `src/lib/constants/notification.js`
- `src/app/api/cron/birthday-reminders/route.js`
