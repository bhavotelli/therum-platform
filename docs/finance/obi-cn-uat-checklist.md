# OBI CN UAT Checklist

Use this checklist to validate the approved OBI amendment + CN flow end-to-end.

## Preconditions

- Agency invoicing model is `ON_BEHALF`.
- Xero is connected and healthy in `Finance > Xero Sync`.
- You have at least one approved OBI triplet with `xeroObiId`.

## Manual UAT Steps

1. Open `Finance > Invoice Queue`.
2. Confirm the `Approved OBI Amendments (CN Flow)` section is visible.
3. Choose a triplet and submit `Amend + Raise CN` with:
   - Lower `New Gross`
   - `CN Date`
   - Reason
4. Confirm the row updates with:
   - `CN Raised`
   - Latest CN number and amount
   - CN cycle count incremented
5. Open `Finance > Credit Notes` and confirm a new CN history entry exists.
6. Open `Finance > Deals (Read-only)` and confirm CN visibility in invoice flow details.
7. Open `Finance > Dashboard` and confirm recent activity includes `Credit note raised`.
8. In Xero, confirm the credit note exists and is authorized.

## Repeat-Cycle Check

1. Run another amendment on the same triplet with a further lower gross.
2. Confirm CN cycle count increments again.
3. Confirm a second CN row appears in `Finance > Credit Notes`.

## CLI Verifier (Optional but Recommended)

Run:

`npm run verify:obi-cn -- triplet=<invoiceTripletId>`

Expected:

- All checks print `PASS`.
- Exit code is `0`.

