# Access & Documents Popup View + Manual Investment Template — v0.33.2

## 1. Secure document popup preview

The Investor Profile **Access & Documents** tab keeps Download and now opens uploaded PDF/JPG/PNG files inside an in-app **popup preview**.

- Staff can use **View** before or after verification without leaving the Investor Profile.
- Investors can use the same popup from **Investor Portal → Documents**.
- The preview reads the existing protected Firebase Storage object through an authenticated same-origin server endpoint, then creates only a temporary browser Object URL. This avoids browser Firebase Storage/CORS stalls while preserving GrowVest access checks.
- The popup opens immediately with a secure loading state while the file is fetched. PDF MIME type is preserved before preview so the browser does not fall back to an empty/black standalone tab.
- Closing the popup releases the temporary Object URL.
- Download remains available inside the popup and on the document card.

No public document URL is created, the file response is private/no-store, and document ownership/verification state is not changed by viewing.

## 2. Manual Investment Template incorporated into GrowVest

Location:

**Investors → Investor Profile → Portfolio Administration → Upload Manual Investment Excel**

Use **Download Manual Investment Template** to obtain the exact embedded workbook:

`GrowVest_Manual_Investment_Template_v0.33.2.xlsx`

The authenticated template endpoint serves the workbook packaged under `public/templates`, so the application download and the approved UAT workbook stay identical.

### Manual Investments sheet

The selected Investor is already known. One row represents one current investment/holding and supports:

- Investment Type
- Product / Investment Name
- Provider / Platform
- Folio / Account / Policy No.
- Investment Mode
- Investment Date
- Invested Amount
- Units / Quantity
- Purchase NAV / Rate
- Current NAV / Rate
- Current Value
- Monthly SIP / Contribution
- SIP Status
- Valuation Date
- Bucket List
- Notes

If **Bucket List** is blank on a new holding, GrowVest maps it to **General Wealth (Default)**. Existing valid allocations are preserved when the field is left blank during a merge/update.

`SIP Status` supports Active, Paused, Stopped and NA. Paused/Stopped SIPs preserve the scheduled SIP amount but do not contribute to the active Monthly SIP total.

### Transactions (Optional) sheet

The same workbook can optionally contain transaction history. GrowVest imports valid rows into `investmentTransactions` and links them back to the matching manual holding when possible.

Supported examples include SIP, Lump Sum, Additional Investment, Redemption, Switch In/Out, Premium, Buy, Sell, Dividend/Income, Interest and Fee/Charge.

Cash-flow treatment remains controlled:

- SIP/Lump Sum/Additional Investment/Premium = new money
- Redemption/Withdrawal = money withdrawn
- Switch In/Out = internal reallocation
- Buy/Sell/Dividend/Income/Interest/Fee = portfolio activity only; not external money and not an internal reallocation

This keeps Monthly Report Money Added / Money Withdrawn / Portfolio Gain-Loss calculations from treating internal trading movements as external cash flows.

## 3. Update modes

**Merge / Update** updates matching Manual holdings and adds new Manual holdings.

**Replace Manual Portfolio** removes missing current `source=Manual` holdings only. Provider positions are untouched. Optional manual-template transaction rows are replaced only when the workbook actually contains transaction rows, preventing an empty optional sheet from deleting prior history.

## 4. Source of truth

Manual investment uploads use the same Portfolio Master architecture as provider imports with `source=Manual`. Bucket List mapping, Investor Portal portfolio display and Monthly Reports therefore use these positions automatically.
