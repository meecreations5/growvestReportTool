# v0.33.3 - Insurance Integration Across Investor Profile and Portfolio

## Objective

Insurance & Protection is not a detached operational module. It is now surfaced in all three places where GrowVest needs it:

1. **Investor Profile** - detailed policy management and protection visibility.
2. **Investor Portfolio** - a protection snapshot shown beside the investment portfolio, while remaining excluded from investment corpus/AUM.
3. **Portfolio Overview** - consolidated protection coverage and upcoming premium/renewal attention across accessible investors.

The central **Portfolio Management -> Insurance & Protection** workspace remains the operational screen for policy entry, Excel import, renewal and document maintenance.

## Investor Profile

The Investor Profile includes a dedicated **Insurance & Protection** tab. In addition, the Profile Overview now shows a compact Protection Snapshot so staff do not need to enter the tab just to see whether the investor has adequate records or an upcoming obligation.

The Profile Portfolio tab also shows the same protection summary above investment holdings. This intentionally places protection next to wealth without mixing the numbers.

Direct links such as `/investors/{investorId}?tab=protection` and `/investors/{investorId}?tab=portfolio` now open the requested Investor Profile section correctly.

## Investor Portfolio

The staff Investor Portfolio and Investor Portal Portfolio pages show:

- Active policy count.
- Life cover.
- Health cover.
- Policies expiring within 30 days.
- Premiums due within 30 days.
- Nearest premium/renewal obligation.

The card explicitly states that protection cover is excluded from Current Portfolio Value, AUM and Bucket List corpus.

## Consolidated Portfolio Overview

The Portfolio Overview now loads a staff-scoped Insurance summary using the authenticated server API. Admin/Super Admin see all non-deleted investors; Advisors see only currently assigned investors.

The consolidated protection area shows:

- Investors with active protection records.
- Active policies.
- Aggregate life cover.
- Aggregate health cover.
- Policies expiring within 30 days.
- Premiums due within 30 days.
- Upcoming/overdue premium and renewal attention items.
- Investor-level protection rows with policy count, life cover, health cover and next due item.

Protection exceptions link directly to the Investor Profile Insurance & Protection tab.

## Security and data separation

The consolidated protection endpoint reads server-managed Insurance collections only after authenticating the GrowVest user and applying role scope. No direct browser Firestore access was introduced.

Insurance cover remains separate from:

- Portfolio Master current value.
- Investment AUM.
- Invested amount.
- Gain/loss.
- Bucket List corpus.
- Trading balances.

## UAT

1. Open an Investor Profile and confirm the Overview shows a compact Protection Snapshot.
2. Open the same Investor's Portfolio tab and confirm protection appears above investment holdings.
3. Click **Manage Insurance & Protection** and confirm the detailed Insurance tab opens.
4. From Portfolio Overview, confirm aggregate life/health cover and active policy counts load.
5. Confirm premium/renewal items due within 30 days appear in Protection Attention.
6. Click a protection attention item and confirm the correct Investor opens on the Insurance & Protection tab.
7. Log in as an Advisor and confirm the consolidated protection view includes only assigned investors.
8. Log in through the Investor Portal and confirm Portfolio shows the read-only Protection Snapshot with a link to Insurance & Protection.
9. Confirm investment portfolio value is unchanged before and after insurance policies are added.
