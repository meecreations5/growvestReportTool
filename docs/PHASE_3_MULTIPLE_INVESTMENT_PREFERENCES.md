# Phase 3 Update — Multiple Investment Preferences

## What changed

The client assessment and investor profile now support multiple investment preference plans instead of one fixed preference object.

Each preference captures:

- Investment type
- Preferred frequency
- Monthly SIP amount
- Lump sum amount
- Multiple advisory areas of interest

Users can add and remove preference plans independently.

## Data structure

`investmentPreferences` is now stored as an array:

```js
[
  {
    id: "preference-1",
    investmentType: "SIP",
    preferredFrequency: "Monthly",
    sipAmount: 25000,
    lumpSumAmount: 0,
    productsOfInterest: ["Mutual Funds", "Retirement Planning"]
  },
  {
    id: "preference-2",
    investmentType: "Lump Sum",
    preferredFrequency: "Quarterly",
    sipAmount: 0,
    lumpSumAmount: 200000,
    productsOfInterest: ["Fixed Deposits", "Insurance"]
  }
]
```

## Backward compatibility

Existing assessment and investor documents that contain the old single-object format are automatically converted into a one-row preference list when opened. The document is saved in the new array format the next time the assessment or investor profile is saved.

## Validation

- At least one preference is required before completing an assessment.
- Investment type and preferred frequency are required for each used preference.
- Drafts may still be saved with incomplete preference rows.
- Empty rows are removed before Firestore writes.

## Screens updated

- Client Assessment
- Live Assessment Summary
- Proposal Summary / Print
- Investor Profile
- Edit Investor Profile

No Firestore rule or index changes are required for this update.
