# Portfolio Investor Suggestion — v0.33.2

## Purpose

Portfolio import review now shows the best GrowVest investor suggestion next to the external investor identity detected in an uploaded file.

## Behaviour

- The suggestion is generated from the existing portfolio name-matching engine.
- The first/best candidate is displayed as **Suggested GrowVest investor** with client code when available.
- Exact normalized-name matches are labeled **Exact name**.
- Fuzzy candidates show their name-match percentage.
- A suggestion never commits or maps an investor automatically. Admin/staff must still explicitly confirm the GrowVest investor before an unresolved file becomes ready to update.
- Verified mappings and strong PAN/broker-code matches continue to use the existing **Auto matched** flow.
- Daily Coverage unmatched-file cards also display the suggested GrowVest investor when a safe candidate is available.

## Reset compatibility

After Full Portfolio Reset, mappings remain blank as required. A fresh Fundbazaar bootstrap upload can therefore display a likely investor suggestion without recreating an old mapping until the user explicitly confirms and commits the upload.

## Fundbazaar representative names

Fundbazaar names such as `ZAYYAN FAHEEMUDDIN SYED REP BY ZARINA BEGUM ASLAM` are treated as a primary investor name plus a representative suffix. GrowVest prioritizes `ZAYYAN FAHEEMUDDIN SYED` for suggestion scoring instead of allowing the representative name to win a fuzzy-name tie.
