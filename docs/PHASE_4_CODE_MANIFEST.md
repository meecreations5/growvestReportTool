# Phase 4 code manifest

## New application routes

```text
/meetings
/meetings/create
/meetings/[meetingId]
/meetings/[meetingId]/edit
/mom
/mom/create
/mom/[momId]
/mom/[momId]/edit
/api/communications/meeting
/api/communications/mom
/api/cron/meeting-reminders
```

## New core files

```text
src/components/meetings/MeetingForm.js
src/components/meetings/MeetingsTable.js
src/components/meetings/MeetingDetailClient.js
src/components/meetings/MeetingStatusBadge.js
src/components/mom/MomForm.js
src/components/mom/MomsTable.js
src/components/mom/MomDetailClient.js
src/components/notifications/NotificationBell.js
src/services/meetingService.js
src/services/momService.js
src/services/notificationService.js
src/services/communicationService.js
src/lib/server/firebaseAdmin.js
src/lib/server/brevoMailer.js
src/lib/server/ics.js
src/lib/server/emailTemplates.js
src/lib/constants/meeting.js
src/lib/constants/notification.js
src/lib/utils/meetingMessages.js
src/lib/utils/whatsapp.js
```

## Updated integrations

- Staff and Investor headers now include the notification centre.
- Investor profiles include Schedule Meeting and recent meeting history.
- Investor Portal Meetings shows scheduled meetings, join links and published MOMs.
- Dashboard quick action opens the Meeting scheduler.
- Navigation contains separate Meetings and MOM modules.
- Firestore rules and indexes include Meetings, MOM, Follow-ups, Notifications and Logs.
- Package dependencies include `firebase-admin` and `nodemailer`.
