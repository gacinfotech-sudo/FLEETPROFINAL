# Phase 3 — Customer financial truth layer

## Delivered

- Customer financial summary calculated from linked bookings and immutable PaymentTransaction rows.
- Lifetime billed, gross collected, refunds, signed adjustments, net collected/net lifetime value, average booking value, pending due, and overdue amount.
- Separate advance, partial, final, driver-collection, vendor-collection, refund, and adjustment totals.
- Per-booking billed, received, due, and overdue allocation.
- Deterministic payment receipt endpoint tied to the customer, booking, tenant, and transaction.
- Receipt validity reflects reversal transactions without overwriting the original payment.
- Receipt preview, PDF download, and print actions.
- Customer statement CSV download generated from the same ledger records.
- Customer dashboard financial cards now use the financial-summary API rather than manually derived UI totals.

## Definitions

- `Lifetime billed` excludes cancelled and no-show bookings.
- `Lifetime collected` is gross receipts across advance, partial, final, driver, and vendor collections.
- `Net lifetime value` is gross collected minus refunds plus signed ledger adjustments.
- `Pending due` is the sum of each billable booking's ledger-computed remaining balance.
- `Overdue` is pending due on a booking whose scheduled return/pickup date has passed.

## Verification

- Targeted finance/payment regression: 4/4 passed.
- The acceptance scenario verified ₹2,000 billed, ₹1,000 collected, ₹100 refunded, ₹900 net collected, and ₹1,100 due.
