# v0.33.5 Investor Mobile Scroll Recovery Hotfix

This hotfix fixes a regression where the Investor App could stop vertically scrolling on phone screens after the v0.33.5 mobile brand/overflow refinement.

## Root cause

The phone-only containment layer introduced `overflow-x: hidden` on `.gv-investor-viewport`. On mobile browsers, using `hidden` on one overflow axis can promote the wrapper into an overflow container and interfere with normal document/body vertical scrolling. In addition, the secure Document Preview applied `document.body.style.overflow = "hidden"`; an interrupted mobile PWA/Fast Refresh session could leave that inline lock behind after the preview was gone.

## Fix

- Investor phone wrapper now uses `overflow-x: clip` rather than `overflow-x: hidden`.
- Vertical overflow is explicitly left visible on the Investor wrapper and main content.
- Horizontal overflow protection, `min-width: 0` containment and GrowVest brand UI remain unchanged.
- Secure Document Preview no longer locks `<body>` scrolling below 768px.
- InvestorShell clears a stale mobile `body.style.overflow = "hidden"` on mount/route change as a recovery guard for older cached/hot-reload sessions.
- Tablet/desktop preview locking remains unchanged.
- PWA cache is bumped to `v0.33.5-ui3` so installed Investor Apps fetch the repaired CSS and components.

## Mobile UAT

Verify on 320/360/375/390/430px phone widths and installed PWA mode:

1. Home scrolls from first card to the content above the fixed bottom nav.
2. Documents scrolls through all document cards.
3. Open/close image preview, then continue scrolling the Documents page.
4. Open/close PDF preview, then continue scrolling.
5. Portfolio, Goals and Monthly Review scroll normally.
6. Horizontal page overflow remains absent.
7. More sheet scrolls internally when its content exceeds the viewport, then underlying page scroll works again after close.
