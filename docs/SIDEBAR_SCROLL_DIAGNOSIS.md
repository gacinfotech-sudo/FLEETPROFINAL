# FleetPro — Sidebar Scroll Diagnosis (read-only, no fix applied)

## Reproduction steps

1. Log in as an owner/client-role account (`qaclient` / role `client` — sees all 21 nav items, no `restrictedForManagers` filtering).
2. Observe the sidebar at `client/src/components/layout/sidebar.tsx`.
3. At any viewport height ≤ ~1200px (i.e. almost any real laptop screen), the nav list overflows the sidebar's visible area and the items below the fold (typically Salary, WhatsApp, Manage Users, Profile) are not reachable by mouse wheel, trackpad scroll, or touch scroll — there is no scrollbar and no scroll happens.

Reproduced with a real headless-Chromium session (Playwright, read-only: login + navigation only, no data created) across 4 viewport heights and mobile. Screenshots and raw DOM measurements saved to `/private/tmp/claude-501/-Users-pradeep/c26b6143-e462-46f4-9c4c-d9020f5b23b0/scratchpad/screenshots/` (outside the repo, not committed — referenced here as evidence only).

## Affected viewport sizes (measured)

| Viewport height | `nav.scrollHeight` | `nav.clientHeight` | `overflow-y` (computed) | Can scroll? |
|---|---|---|---|---|
| 1080px (large desktop) | 1168px | 1168px | `visible` | No |
| 800px (small laptop) | 1168px | 1168px | `visible` | No |
| 720px (common laptop) | 1168px | 1168px | `visible` | No |
| 600px (small window / zoomed browser) | 1168px | 1168px | `visible` | No |

The nav element's own height (`clientHeight`) is **1168px regardless of the actual viewport height** — it never gets constrained to fit inside the sidebar at all; it just grows past the sidebar's visual bounds. This is why `scrollHeight === clientHeight` in every case: there is no overflow *inside* the nav element for it to scroll, because nothing is clipping it in the first place. The overflow instead happens one level up — the sidebar's fixed-height parent (`h-screen`) simply gets visually overrun, pushing the "Logout" footer and the tail of the nav list off-screen with `overflow-y: visible` and no scroll mechanism anywhere in the ancestor chain.

Confirmed by direct interaction: at 720px height, a mouse-wheel scroll of 600px over the nav element produced `scrollTop === 0` afterward — the wheel event has nothing to act on.

## Affected roles

- **Owner/client role** (21 nav items visible) — reproduced directly, worst case.
- **Manager role** — not tested live (no manager test credential exists in this repo's test fixtures — only `qaclient`/client-role credentials are seeded for e2e tests), but by code inspection of `restrictedForManagers` in `sidebar.tsx:20-29`, a manager sees roughly 15 items instead of 21. The same bug mechanism (flex child with no `min-h-0`/`overflow-y-auto`) will still trigger for a manager on any sufficiently short viewport — it's a magnitude difference (fewer items → slightly taller viewport survives before truncation), not a different bug.
- **Admin role** — same nav array as client (both pass the `adminOnly` check), same exposure.

## Browsers

Reproduced in Chromium (Playwright default). The bug is a pure CSS flexbox layout issue with no browser-specific API involved (no vendor-prefixed property, no Safari-specific momentum-scroll quirk implicated) — the same computed-style defect (`overflow-y: visible` on an unconstrained flex child) will reproduce identically in Firefox and Safari, since it's standard CSS box-model behavior, not a rendering-engine-specific bug. Not independently verified in non-Chromium browsers during this audit (browser automation tooling available in this environment is Chromium-only).

## Desktop vs. mobile

- **Desktop (≥1024px width, `lg:` breakpoint):** sidebar is `lg:static lg:translate-x-0` — always visible, in-flow. Bug reproduces as described above.
- **Mobile (<1024px width, tested at 390×844):** sidebar is `fixed inset-y-0` with a translate-based slide-in drawer, opened via the header's menu button. Same underlying `<nav>` markup and same missing `overflow-y-auto`/`min-h-0` — the drawer itself is `h-screen`, so the identical overflow bug applies once the drawer is open on a short mobile viewport. Screenshot captured confirms the drawer renders but the same class of items-past-the-fold issue applies proportionally (mobile viewports are typically taller relative to item count than a laptop, so it's visually less severe at 844px tall, but the code path is identical and will reproduce on shorter phones).

## Browser zoom

Not independently tested at 80/125/150% zoom in this pass; zooming is mathematically equivalent to reducing the effective viewport height (the same `window.innerHeight` shrinks), so the 600px/720px viewport-height measurements above already cover the zoomed-in case (125–150%) on a typical 1080p display. Zooming out (80%) *increases* effective available height and would reduce/eliminate the visible symptom, consistent with the root cause being insufficient vertical space relative to fixed content height, not a fixed pixel bug.

## DOM hierarchy (relevant excerpt)

```
<div class="fixed inset-y-0 left-0 z-50 w-64 ... flex flex-col h-screen">   <!-- sidebar.tsx:70-75 -->
  <div class="flex items-center justify-center h-16 bg-blue-600">...</div>  <!-- header, fixed height -->
  <nav class="mt-6 lg:mt-8 flex-1">                                          <!-- sidebar.tsx:83 — THE BUG -->
    <div class="px-3 lg:px-4 space-y-1 lg:space-y-2">
      <!-- 21 <Button> nav items, ~52-56px each incl. gaps -->
    </div>
  </nav>
  <div class="p-3 lg:p-4 border-t border-gray-200">...</div>                 <!-- Logout footer, fixed height -->
</div>
```

## Root cause

`client/src/components/layout/sidebar.tsx:83` — the `<nav>` element is `flex-1` inside a `flex flex-col h-screen` parent, but has **no `overflow-y-auto` and no `min-h-0`**.

This is the textbook flexbox overflow trap: a flex item's default `min-height` is `auto`, which means (per the CSS flexbox spec) it will refuse to shrink below its **content's** intrinsic size even when the flex container itself is height-constrained. Setting `flex-1` alone only controls how the item *grows* to fill available space — it does nothing to make the item *shrink* to fit when its content is taller than the space available. Combined with the default `overflow: visible`, the browser's only remaining option is to let the nav's content spill out past the parent's `h-screen` boundary, visually overrunning into (and past) the fixed Logout footer below it, with no scrollbar generated anywhere because nothing in the ancestor chain has both a height constraint *and* `overflow-y: auto` applied to the same element.

**Classification: pure CSS/layout bug.** Not JavaScript, not a component-library (Radix) behavior — the sidebar's nav list is a plain `<nav>`/`<Button>` markup, no Radix `ScrollArea`/`Sheet`/`Drawer` primitive is involved in this specific list. No `pointer-events`, `z-index`, or overlay interference was found; the mouse-wheel-produces-`scrollTop:0` result confirms there is no scrollable box for the browser to act on at all, consistent with the CSS diagnosis above rather than an event being intercepted/prevented by JS (a `preventDefault`-style JS bug would still leave a scrollable box with a non-zero `scrollHeight - clientHeight`, which is not what was measured — here `scrollHeight === clientHeight`, meaning the box already grew to contain everything).

## Why this instance of the bug exists on this branch specifically

The identical bug was already found and fixed once before, on a **different, unmerged branch** (`feature/vendor-360-patch`, commit `5f06290`, fix: `<nav className="mt-6 lg:mt-8 flex-1 overflow-y-auto min-h-0">`). That branch diverged from `main`@`be5ca9b`. The branch this audit evaluated (`feature/customer-invoice-system`) diverged separately from `feature/customer-360-complete`@`f5c282a`, which never received that fix — so the same defect independently persists here. This is a direct consequence of the branch-fragmentation issue described in [REAL_WORLD_SAAS_AUDIT.md](./REAL_WORLD_SAAS_AUDIT.md) §1: the same bug was fixed once, but on a branch that this one never merged from.

## Exact minimal files that would require modification

- `client/src/components/layout/sidebar.tsx` — one line change (line 83).

No other file needs to change. No route, no menu item, no database field, no API is involved.

## Proposed patch (NOT applied — shown for review only)

```diff
--- a/client/src/components/layout/sidebar.tsx
+++ b/client/src/components/layout/sidebar.tsx
@@ -80,7 +80,7 @@ export default function Sidebar({ currentView, onViewChange, isOpen, onToggle
         </div>
-        <nav className="mt-6 lg:mt-8 flex-1">
+        <nav className="mt-6 lg:mt-8 flex-1 overflow-y-auto min-h-0">
           <div className="px-3 lg:px-4 space-y-1 lg:space-y-2">
```

This is exactly the fix already proven correct on `feature/vendor-360-patch`@`5f06290` — re-applying the identical, already-validated one-line change here rather than devising a new approach.

## Why this is minimal and low-risk

- `overflow-y-auto` only adds a scrollbar when content actually overflows — on a tall viewport where all 21 items already fit, it has zero visible effect (confirmed by the underlying CSS spec, not just expected — an element with `scrollHeight <= clientHeight` never shows a scrollbar under `overflow-y: auto` regardless of the property being set).
- `min-h-0` overrides only the flex-item default-`auto` sizing behavior; it does not change any explicit height/width/padding/margin already set elsewhere.
- Neither class touches color, spacing, icons, labels, click handlers, routes, or the `visibleNavItems` filtering logic (`adminOnly`/`restrictedForManagers`) — the role-based menu content is untouched.
- No component re-render behavior changes — this is a pure CSS class addition, not a structural/JSX change.

## Regression tests required (to run after approval, before/if the patch is applied)

1. **Desktop, owner/client role, tall viewport (≥1200px):** all 21 items visible, no scrollbar appears (content already fits) — confirms no regression for the common case.
2. **Desktop, owner/client role, short viewport (720px, 600px):** nav becomes scrollable, every item including the last (Profile) is reachable by scroll, Logout footer stays pinned and visible at all times.
3. **Manager role, restricted item set, short viewport:** fewer items, confirm no unexpected scrollbar appears if they now fit, and confirm scroll still works correctly if they don't.
4. **Mobile drawer (< 1024px width), short device height:** open the drawer, confirm the same scroll behavior inside the slide-in panel, confirm the overlay/close-on-click-outside behavior is unaffected.
5. **Existing test suite regression:** re-run the full `tests/e2e/` suite once, specifically watching for any test that clicks a nav item by role/name (several tests use `page.locator('nav').getByRole('button', {name: ...})`) to confirm none of them depended on the old (broken) non-scrolling layout in a way that would now behave differently — expected: no impact, since `getByRole` clicks aren't affected by CSS overflow, but this should be verified rather than assumed.

## Before/after expected behaviour

- **Before:** on any viewport ≤ ~1150px tall, nav items below roughly item #17–18 (varies slightly by role/item count) are physically unreachable — no scrollbar, wheel/touch scroll does nothing, `scrollTop` stays `0`.
- **After:** the nav list scrolls independently of the fixed header and fixed Logout footer; all items are reachable at any viewport height; no visual change at all on viewports tall enough that no scrolling was ever needed.
