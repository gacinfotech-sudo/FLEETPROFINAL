# FleetPro — What To Test Next (Owner-Friendly)

**First, important:** three different versions of FleetPro are currently running at once
on this machine:

- `http://localhost:5050` ← test here first (has Driver 360, GPS Tracking, latest booking
  fixes)
- `http://localhost:5051` and `http://localhost:5100` ← have some different features
  (telephony) that `:5050` doesn't yet have

Ask whoever is running the development to confirm which one to use before testing, so you
don't report something as "missing" when it's actually just on a different link.

## BOOKING (on `:5050`)

- [ ] Add Customer
- [ ] Create ₹6000 Booking
- [ ] Take ₹4000 Advance
- [ ] Confirm Balance shows ₹2000
- [ ] Refresh the page
- [ ] Booking still there, amounts unchanged
- [ ] Try submitting a booking with something missing (e.g. no pickup location) —
      the error message should now tell you exactly what's missing, not just
      "Invalid booking data"

## DRIVER (on `:5050`)

- [ ] Add a driver with only name + phone (nothing else)
- [ ] Save succeeds even though documents/contacts/address are empty
- [ ] Open Driver 360 for that driver
- [ ] Add up to 10 emergency/family/reference contacts
- [ ] Add up to 3 previous employers with supervisor + experience document fields
- [ ] Confirm nothing was required to block the save

## GPS (on `:5050`)

- [ ] Click "GPS Tracking" in the left sidebar (new — wasn't visible before today)
- [ ] Live Map tab opens
- [ ] Vehicle Mapping tab opens
- [ ] Connections tab opens
- [ ] If a connection shows "no adapter" in the background — that's expected for
      unconfigured/test providers, not a bug

## VEHICLE HANDOVER (on `:5050`)

- [ ] Hand over a vehicle to a driver
- [ ] Driver portal shows the pending handover
- [ ] Driver can accept it
- [ ] Return the vehicle with a deliberately "wrong" odometer reading — the return
      should still save, just flagged, not blocked

## What this audit did NOT get to test — please flag anything unusual here yourself

Vendor accounting/settlement, Telephony (may only work on `:5051`/`:5100`), WhatsApp,
Invoices, Payments beyond initial booking advance, Reports, Vehicle 360 sections beyond
basic Add Vehicle, Root/Admin control panel if one exists for you specifically.
