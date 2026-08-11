# Phase 4 — Billing profiles and immutable invoice lifecycle

## Delivered

- Multiple tenant- and customer-scoped billing profiles with add, edit, default selection, GST/company, address, accounts, PO, credit-period, TDS, and payment-term fields.
- One-click invoice entry points in the Customer Dashboard, current/latest service card, booking history, and complete booking detail dialog.
- Server-generated previews based on the linked Customer, Booking, Vehicle, Tenant business details, and immutable PaymentTransaction ledger.
- Tax invoice, non-GST invoice, proforma invoice, payment receipt, and customer statement drafts.
- Finalize-and-lock behavior; finalized document fields and billing snapshots cannot be edited.
- Explicit revision, credit-note, and debit-note workflows linked to the finalized source document.
- Duplicate initial invoice prevention for each tenant, booking, and document type.
- PDF download, print, email-ready link, WhatsApp-ready link, and UPI payment QR actions.
- Ledger-derived current receipt and balance overlays without rewriting the finalized invoice snapshot.
- Customer merge compatibility and Customer Timeline invoice events.

## Financial and snapshot rules

- The invoice total starts from the actual linked booking total and applies only the authorized invoice discount.
- GST-inclusive taxable value is derived from the invoice gross; toll and parking can remain included or be shown separately as non-taxable.
- `amountReceived` and `balanceDue` preserve the creation/finalization-time payment snapshot.
- `currentAmountReceived` and `currentBalanceDue` are computed on read from PaymentTransaction rows, so a later payment updates the operational balance while the finalized document stays immutable.
- Editing a billing profile never changes a saved invoice billing snapshot.

## Verification

- Invoice acceptance test verified two billing profiles, default selection, exact ₹2,360 GST/toll/parking calculation, ₹500 advance, ₹1,860 initial due, duplicate prevention, finalization lock, historical snapshot preservation, final-payment balance refresh to ₹0, revision, credit note, timeline linkage, UPI QR, PDF, print, email, and WhatsApp actions.
- Customer/financial/merge/timeline targeted regression: 5/5 passed.
- Complete Playwright regression: 47/47 passed.
- TypeScript check and production build passed.
