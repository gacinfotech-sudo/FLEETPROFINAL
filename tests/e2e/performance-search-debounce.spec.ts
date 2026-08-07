import { test, expect } from '@playwright/test';
import { debounce } from '../../client/src/lib/debounce';
import { login } from './helpers';

// TASK-03 (performance QA).
//
// Reproduced today: client/src/pages/customers.tsx's search box calls
// setSearch(e.target.value) directly in onChange, and `search` sits in the
// React Query key, so every keystroke fires a brand-new
// GET /api/customers?search=... request. See TASK-03-report.md for the
// full writeup, the measured "before" request count, and the exact
// one-line proposed diff to wire the fix below into that page (a file
// this task doesn't own — client/src/pages/** belongs to TASK-01).
//
// This spec verifies the actual shipped fix — client/src/lib/debounce.ts
// and client/src/hooks/use-debounced-value.ts (a thin React wrapper over
// the same debounce()) — by exercising the real function, not a mock.

test.describe('performance: search debounce utility', () => {
  test('collapses a burst of rapid calls into exactly one, using the LAST value', async () => {
    const calls: string[] = [];
    const debounced = debounce((value: string) => calls.push(value), 50);

    // Simulate fast typing: 8 keystrokes, ~10ms apart — well inside the
    // 50ms debounce window, matching how customers.tsx's onChange would
    // fire once per keystroke today.
    const term = 'mahindra';
    for (let i = 1; i <= term.length; i++) {
      debounced(term.slice(0, i));
      await new Promise((r) => setTimeout(r, 10));
    }

    // Not yet fired — still inside the debounce window from the last call.
    expect(calls.length).toBe(0);

    // Wait past the debounce delay.
    await new Promise((r) => setTimeout(r, 80));

    expect(calls).toEqual([term]); // exactly one call, with the final value
  });

  test('cancel() suppresses a pending invocation (mirrors unmount cleanup)', async () => {
    const calls: string[] = [];
    const debounced = debounce((value: string) => calls.push(value), 30);

    debounced('x');
    debounced.cancel();
    await new Promise((r) => setTimeout(r, 60));

    expect(calls.length).toBe(0);
  });

  test('two independent bursts each collapse to one call (not one total)', async () => {
    const calls: string[] = [];
    const debounced = debounce((value: string) => calls.push(value), 30);

    debounced('a');
    debounced('ab');
    await new Promise((r) => setTimeout(r, 60));

    debounced('abc');
    debounced('abcd');
    await new Promise((r) => setTimeout(r, 60));

    expect(calls).toEqual(['ab', 'abcd']);
  });
});

// Live reproduction against the real running app (not a mock) — see
// TASK-03-report.md's "Before/after measurements" table for the original
// (pre-fix) numbers. The Integrator has since wired useDebouncedValue into
// client/src/pages/customers.tsx (see integration-preview branch), so this
// now asserts the fixed end-state instead of the original bug.
test.describe('performance: customer search — live reproduction (fixed)', () => {
  test('typing a search term collapses to a single debounced GET /api/customers request', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'GET' && /\/api\/customers\?.*search=/.test(req.url())) {
        requests.push(req.url());
      }
    });

    await login(page, 'qaclient', 'QaFixed456!');
    await page.getByRole('button', { name: 'Customers', exact: true }).click();
    await page.getByPlaceholder('Search name, mobile, or email').waitFor({ state: 'visible' });
    await page.waitForTimeout(500); // let the initial (search-less) list load settle

    requests.length = 0;
    const term = 'zzqperfqaprobe'; // deliberately no real matches — result count is irrelevant, only request count is measured
    await page.getByPlaceholder('Search name, mobile, or email').pressSequentially(term, { delay: 80 });
    await page.waitForTimeout(1000);

    // Fixed: debounced at 350ms, so the whole burst (80ms/keystroke) collapses
    // to exactly one network request carrying the final value.
    expect(requests.length).toBe(1);
    expect(requests[0]).toContain(encodeURIComponent(term));
  });
});
