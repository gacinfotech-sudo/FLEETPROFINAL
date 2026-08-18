# FleetPro — Final Owner Manual Test

**Test here:** `http://127.0.0.1:5051` (or the LAN URL noted in
`.claude/runtime/PREVIEW-RUNTIME.json` if testing from another device on the same network).
This is the real, actively-maintained canonical build — not `:5050` or `:5200`, which were
this session's own working ports and are no longer running.

- [ ] Login
- [ ] Create Customer
- [ ] Create Booking (try ₹6000 with ₹4000 advance — should show ₹2000 remaining, exactly)
- [ ] Check amount — no leading zero, no drift, refresh the page and confirm it's unchanged
- [ ] Assign Driver
- [ ] Assign Vehicle
- [ ] Open Driver 360 — add a driver with only name+phone, confirm it still saves
- [ ] Open Vehicle 360
- [ ] GPS — open "GPS Tracking" in the sidebar; Live Map/Mapping/Connections tabs should open.
      **Note: no live location data will appear** — no real GPS provider is configured yet
      (this needs a real Traccar server URL + credentials from you; ask your developer for
      the exact setup steps in `docs/final-release/FLEETPRO-FINAL-PRODUCT-STATUS.md`)
- [ ] Trip start
- [ ] Payment
- [ ] Invoice
- [ ] Customer history
- [ ] Logout, then log back in — confirm you're not randomly signed out mid-session

**Not yet covered by this test list** (not because they're broken — because they weren't
checked this round): Super Admin / pricing / tenant settings pages, WhatsApp, Vendor
accounting, Telephony call flows. Please flag anything unusual you notice there — it just
means an audit pass hasn't reached it yet, not that it's known-safe.
