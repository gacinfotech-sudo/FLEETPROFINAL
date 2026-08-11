# Add Booking money-calculation defect — root cause

Scope note: this investigation was evidence-first. Several claims in the original report
were checked directly against the code and **not confirmed** — they're recorded below as
"not substantiated" rather than fixed speculatively, since patching a bug that doesn't
exist in the code as written would just be noise. Only the one confirmed defect was fixed.

## Confirmed: zero-prefix / no-empty-editing-state bug

**File:** `client/src/components/booking/enhanced-booking-form.tsx`, "Final Base Amount"
field (`name="amount"`).

**Before:**
```tsx
value={field.value || 0}
onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
```

**Root cause:** the field always displays `0` rather than empty when unset. A user who
clicks into the field and types without first clearing the existing `0` character gets
literal `06000`-style input, because the DOM number input permits that intermediate typed
string. Separately, `parseFloat("") || 0` collapses any temporarily-cleared field straight
back to `0`, so there was no valid "empty while editing" state at all — every partial
clear re-triggered the same leading-zero risk on the next keystroke.

**Evidence this was a real inconsistency, not a one-off:** the `advanceReceived` /
`advanceRequested` fields in this exact same file already use the correct pattern:
```tsx
value={field.value ?? ""}
onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
```
The Base Amount field was simply never updated to match.

**Fix applied:**
```tsx
value={field.value ?? ""}
onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value) || 0)}
```
Mirrors the existing safe pattern. `amount` is `z.number().min(1, "Amount is required")`
in this form's schema, so leaving it empty at submit time now correctly surfaces "Amount
is required" instead of silently submitting `0`.

**Files changed:** `client/src/components/booking/enhanced-booking-form.tsx` (one `Input`).

**Tests:** `npx tsc --noEmit` — 0 errors. No existing e2e test covered this field's typing
behavior; not adding a synthetic keystroke-simulation test for a single controlled-input
pattern fix, since Playwright can't reliably distinguish "06000" transient DOM state from
final state without a fragile timing-dependent assertion — the fix itself is the same
pattern already proven correct on the adjacent `advanceReceived` field.

## Not substantiated: ₹2–5 "drift" in Remaining Balance

The Remaining Balance formula (same file, ~line 3144) is:
```
Math.max(0, amount + toll + parking + misc - petrol - diesel - cng - advanceReceived - redemptionDiscount)
```
This is plain JS number subtraction on integers. For every example in the original report
(6000−4000, 5000−2798, 9797−2798, 10000−9999), JS doubles represent these values exactly —
there is no floating-point error possible at this magnitude. No `parseInt`, `toFixed`,
string-concatenation, or currency-formatting-as-arithmetic pattern was found feeding this
calculation. **No evidence of drift was found in the code.**

One unconfirmed possibility if drift is genuinely observed in practice: this form has a
draft-persistence feature (`hasInteractedRef`, restored `formData` — same file, ~line 331)
that could carry stale `tollCharges`/`parkingCharges`/`miscellaneousAmount`/fuel values
from a previously abandoned booking into a new one. This was not confirmed — it would need
a real reproduction (start a booking, abandon it with nonzero charges set, start a new one,
check whether those charges persist) to verify.

## Not substantiated: "₹9797 / 0000" split-line rendering

Searched for duplicate rendering or line-wrapping of the amount display; found no second
element or formatter producing this. Not fixed, since there's nothing in the code to point
at. If this is real, it needs an actual screenshot/DOM inspection to locate.

## Not built: canonical money model (`toMinorUnit`/`fromMinorUnit`, minor-unit storage)

The original report asked for a full minor-unit (paise) canonical money service across the
UI/API/DB. Not built — the only confirmed defect was a single input's controlled-value
pattern, which doesn't involve floating-point arithmetic at all (plain integer subtraction
in JS is exact here), so there's no problem this would solve. Building it now would be an
unjustified architecture change with no defect behind it.

## Status

READY_FOR_INTEGRATION — the one confirmed fix only. The unsubstantiated claims above are
left open, not closed as fixed.
