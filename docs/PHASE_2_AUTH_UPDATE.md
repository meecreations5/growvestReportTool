# Phase 2 Authentication Update

Implemented:

- Microsoft 365 login for Super Admin, Admin and Advisor
- Separate staff login route
- Separate investor login route
- Investor username/password authentication through an internal Firebase email alias
- Investor mobile OTP with Firebase reCAPTCHA
- Four roles: `super_admin`, `admin`, `advisor`, `investor`
- Provider validation by role
- Active-user and portal-enabled validation
- Staff route guard
- Investor route guard
- Role-based redirection
- Local session persistence
- Investor portal shell
- Investor dashboard
- Investor profile view
- Published monthly report list
- Client-shareable MOM list
- Investor password-change screen
- Updated Firestore rules and indexes

Not included in this slice:

- Admin screen to provision investor Firebase accounts
- Secure Firebase Admin SDK account creation
- Linking phone and password providers from the admin panel
- Mobile-OTP password recovery
- Full Investor Profile, MOM and Monthly Report creation modules
