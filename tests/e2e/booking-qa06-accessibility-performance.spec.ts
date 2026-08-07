import { test, expect } from '@playwright/test';
import { login, trackConsoleErrors } from './helpers';

// TASK-BOOKING-QA-06 — accessibility + performance of the new
// date-certainty selector (client/src/components/booking/enhanced-booking-form.tsx,
// TASK-BOOKING-UI-04). Requires a live dev server (PLAYWRIGHT_BASE_URL) —
// see this task's report for why these were verified statically rather
// than live in this environment (sandbox does not allow this worker to
// start a new listening dev server, and the only already-running instance
// in the assigned worktree was under continuous, heavy concurrent use by
// an apparent duplicate QA-06 session for the full duration of this run).
// Kept here, real and runnable, for whoever runs this suite next with a
// clean server available — not a placeholder.

test.describe('QA-06: date-certainty selector accessibility', () => {
  test('CONFIRMED STATICALLY (source read, enhanced-booking-form.tsx ~line 1057-1078): the three date-certainty option cards are plain <div onClick> elements with no keyboard or screen-reader semantics — route to TASK-BOOKING-UI-04', async ({ page }) => {
    // The exact source (as merged, TASK-BOOKING-UI-04 commit 6c35b55):
    //   <div key={option.value} id={`date-certainty-${option.value}`}
    //     onClick={() => field.onChange(option.value)} className="...">
    // Missing, all of which a real radio-group equivalent needs:
    //   - role="radio" (or a native <input type="radio">) + a
    //     role="radiogroup" wrapper
    //   - tabIndex={0} — the div is not in the natural Tab order at all
    //   - onKeyDown handling Enter/Space to activate (native buttons/inputs
    //     get this for free; a bare div does not)
    //   - aria-checked={field.value === option.value}
    //   - an accessible name tied to the control (aria-label or
    //     aria-labelledby referencing the option's own label text)
    // Net effect: a keyboard-only user cannot reach or operate this
    // selector at all (Tab skips over it entirely), and a screen reader
    // announces it as three unlabelled, non-interactive groups of text —
    // not "three mutually exclusive options, one selected."
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard');
    // Open Add Booking (adjust selector if the live run's entry point
    // differs) and reach Step 1.
    const addBookingButton = page.getByRole('button', { name: /new booking|add booking/i }).first();
    await addBookingButton.click({ timeout: 10000 }).catch(() => {});

    const firstCard = page.locator('#date-certainty-confirmed');
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // 1) Not reachable by keyboard Tab from a known-preceding focusable element.
    const tabIndex = await firstCard.getAttribute('tabindex');
    expect(tabIndex, 'date-certainty card must be keyboard-focusable (tabindex="0" or a native control) — found none').not.toBeNull();

    // 2) No ARIA role identifying it as a selectable option.
    const role = await firstCard.getAttribute('role');
    expect(['radio', 'option', 'button'], `date-certainty card must expose an interactive ARIA role — found role="${role}"`).toContain(role);

    // 3) No aria-checked/aria-selected/aria-pressed state exposed.
    const state = await firstCard.getAttribute('aria-checked') ?? await firstCard.getAttribute('aria-selected') ?? await firstCard.getAttribute('aria-pressed');
    expect(state, 'date-certainty card must expose its selected state to assistive tech (aria-checked/aria-selected/aria-pressed) — found none').not.toBeNull();

    // 4) Enter/Space must activate it once focused (native semantics or an explicit onKeyDown).
    await firstCard.focus();
    const rangeCard = page.locator('#date-certainty-range');
    await rangeCard.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText("What's the earliest and latest date?")).toBeVisible({ timeout: 3000 });
  });
});

test.describe('QA-06: wizard performance — no unbounded re-render loop or duplicate network requests per field change', () => {
  test('STATIC REVIEW (no live confirmation possible in this environment): the date-certainty selector\'s own field change does not introduce a NEW debounced-autosave-storm beyond the pre-existing (unrelated to UI-04) watchedValues-keyed autosave effect', async ({ page }) => {
    // Static finding, for the record: enhanced-booking-form.tsx's existing
    // draft-autosave useEffect (~line 359) depends on the ENTIRE
    // `watchedValues` object (a fresh reference every render, from
    // `form.watch()` with no field filter) — this is PRE-EXISTING
    // behavior, not introduced by TASK-BOOKING-UI-04's date-certainty
    // change, and is already debounced (1200ms, timer cleared/reset on
    // each change) so it does not fire one network request per keystroke.
    // No new useEffect was added by UI-04's diff with a dependency on
    // travelDateStatus specifically — the three date-certainty sections
    // are plain conditional JSX (`{watchedValues.travelDateStatus ===
    // "..." && (...)}`), which re-renders on selection but does not, by
    // itself, cause an additional network call or a render loop (no
    // setState-in-render, no effect with a missing/circular dependency
    // found around travelDateStatus). This is a static-code conclusion,
    // not a measured one — see this task's report for why a live
    // (Playwright tracing / React DevTools profiler) confirmation could
    // not be obtained.
    test.skip(true, 'Requires a live, uncontended dev server — see task report. Left runnable for the next session with one available.');

    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard');
    const addBookingButton = page.getByRole('button', { name: /new booking|add booking/i }).first();
    await addBookingButton.click();

    const requestLog: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/')) requestLog.push(`${req.method()} ${req.url()}`);
    });

    // Toggle the date-certainty selector between all three states 5 times
    // and assert the request count grows at most linearly (bounded), never
    // superlinearly — the actual regression this test protects against.
    for (let i = 0; i < 5; i++) {
      await page.locator('#date-certainty-range').click();
      await page.locator('#date-certainty-not_decided').click();
      await page.locator('#date-certainty-confirmed').click();
    }
    await page.waitForTimeout(1500); // let any trailing debounce settle

    // A bounded number of autosave PUTs is expected (the pre-existing
    // debounce), not one per individual click (15 clicks above).
    const autosaveCalls = requestLog.filter((r) => r.includes('/api/booking-drafts/mine') && r.startsWith('PUT'));
    expect(autosaveCalls.length, `expected a bounded, debounced number of autosave requests, got ${autosaveCalls.length}: ${JSON.stringify(autosaveCalls)}`).toBeLessThan(5);
  });

  test('STATIC REVIEW placeholder: no console errors/warnings ("Maximum update depth exceeded") on repeated date-certainty toggling', async ({ page }) => {
    test.skip(true, 'Requires a live, uncontended dev server — see task report.');
    const errors = trackConsoleErrors(page);
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard');
    const addBookingButton = page.getByRole('button', { name: /new booking|add booking/i }).first();
    await addBookingButton.click();
    for (let i = 0; i < 10; i++) {
      await page.locator('#date-certainty-range').click();
      await page.locator('#date-certainty-confirmed').click();
    }
    const reactLoopErrors = errors.filter((e) => /maximum update depth|too many re-renders/i.test(e));
    expect(reactLoopErrors, `Found React render-loop errors: ${JSON.stringify(reactLoopErrors)}`).toHaveLength(0);
  });
});
