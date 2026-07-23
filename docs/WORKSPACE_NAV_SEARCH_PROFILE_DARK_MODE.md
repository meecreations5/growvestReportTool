# Workspace Navigation, Search, Profile Images & Dark Mode

Version: 0.26.0

## Delivered

- Collapsible desktop sidebar for Super Admin, Admin and Advisor workspaces.
- Sidebar state persists per browser and remains unchanged on mobile.
- Active workspace search across permitted Investors, Leads and Monthly Reports.
- Search results respect the signed-in staff member's Firestore access scope.
- New staff My Profile page with self-service profile image upload.
- Investor profile image upload inside the Investor Portal.
- Uploaded images appear in staff and investor headers, profile menus and navigation cards.
- Light and dark mode toggle for staff and Investor experiences.
- Theme preference persists locally and supports system preference on first use.
- Print/PDF output remains light and unaffected by application dark mode.

## Firebase deployment

The updated Storage rules add the authenticated `profile-images/{uid}` path.

```bash
firebase deploy --only storage
```

## Profile image constraints

- PNG, JPG or WebP
- Maximum 5 MB
- Stored under the authenticated user's UID
- Only the user can upload or delete their profile image
- Read access requires an authenticated GrowVest session

## Search scope

Super Admin and Admin can search all accessible active Investors, Leads and Monthly Reports. Advisors search only records assigned to them. Search begins after two characters and navigates directly to the selected record.
