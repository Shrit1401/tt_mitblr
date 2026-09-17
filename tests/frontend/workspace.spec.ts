import AxeBuilder from '@axe-core/playwright';
import { test, expect, openView, captureDownload, traversalKey } from './fixtures';

test('overview explains the demo and opens the featured borrower', async ({ page }) => {
  await openView(page);
  await expect(page.getByText('Demonstration borrowers', { exact: true })).toBeVisible();
  await expect(page.getByText('₹72,000', { exact: true })).toBeVisible();
  await expect(page.getByText('Across three synthetic loans')).toBeVisible();
  await expect(page.getByText('Synthetic demonstration data.', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Explore a borrower', exact: true }).click();
  await expect(page).toHaveURL(/#borrower\/farmer$/);
  await expect(page.getByRole('heading', { name: 'Rani Devi', exact: true })).toBeVisible();
});

test('all sidebar views navigate with an active location and stable hash', async ({ page }) => {
  await openView(page);
  for (const [label, route, heading] of [
    ['Borrowers', 'borrowers', 'Your borrowers.'], ['Plan comparison', 'comparison/farmer', 'Find the right fit.'],
    ['Scenario lab', 'scenarios', 'A plan for “what if”.'], ['Decisions', 'decisions', 'Every decision, explained.'],
    ['Evidence library', 'evidence', 'Evidence you can follow.'], ['Overview', 'overview', 'Good morning, Shrit.'],
  ]) {
    const nav = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: label, exact: label !== 'Borrowers' });
    await nav.click();
    await expect(page).toHaveURL(new RegExp(`#${route}$`));
    await expect(nav).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('main h1')).toHaveText(heading);
  }
});

test('borrower deep links survive reload and browser back restores the earlier view', async ({ page }) => {
  await openView(page, 'borrower/tailor');
  await page.reload();
  await expect(page.locator('main h1')).toHaveText('Asha Rao');
  await page.getByRole('button', { name: 'All borrowers', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Your borrowers.');
  await page.goBack();
  await expect(page.locator('main h1')).toHaveText('Asha Rao');
});

test('borrower search matches name, livelihood and location', async ({ page }) => {
  await openView(page, 'borrowers');
  for (const [query, name] of [['rani', 'Rani Devi'], ['market vendor', 'Meera Shah'], ['MYSURU', 'Asha Rao']]) {
    await page.getByRole('textbox', { name: 'Search borrowers' }).fill(query);
    await expect(page.locator('.borrower-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.borrower-table')).toContainText(name);
  }
});

test('income filters combine with search and explain an empty result', async ({ page }) => {
  await openView(page, 'borrowers');
  await page.getByRole('combobox', { name: 'Filter by income pattern' }).selectOption('Seasonal');
  await expect(page.locator('.borrower-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.borrower-table')).toContainText('Rani Devi');
  await page.getByRole('textbox', { name: 'Search borrowers' }).fill('Meera');
  await expect(page.getByRole('heading', { name: 'No borrowers found' })).toBeVisible();
  await expect(page.getByText('Showing 0 of 3 demonstration borrowers')).toBeVisible();
  await page.getByRole('combobox', { name: 'Filter by income pattern' }).selectOption('All borrowers');
  await expect(page.locator('.borrower-table')).toContainText('Meera Shah');
});

test('command palette searches, reports no match, and navigates to a profile', async ({ page }) => {
  await openView(page);
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Find a borrower' });
  const search = dialog.getByRole('textbox', { name: 'Find a borrower' });
  await expect(search).toBeFocused();
  await search.fill('no-such-person');
  await expect(dialog.getByRole('heading', { name: 'No matching borrowers' })).toBeVisible();
  await search.fill('Pune');
  await dialog.getByRole('button', { name: /Meera Shah/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('main h1')).toHaveText('Meera Shah');
});

test('vendor shows a pending state without invented plan results', async ({ page }) => {
  await openView(page, 'borrower/vendor');
  await expect(page.getByText('Awaiting evaluation', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'An irregular income story' })).toBeVisible();
  await expect(page.getByText('No saved evaluation is available', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare all plans' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Prepare scenario assumptions' }).click();
  await expect(page.locator('main h1')).toHaveText('A plan for “what if”.');
});

test('income decline clearly prevents decision selection for every candidate', async ({ page }) => {
  await openView(page, 'borrower/tailor');
  await expect(page.getByText('No feasible plan in the saved example.')).toBeVisible();
  await page.getByRole('button', { name: 'Compare all plans' }).click();
  await expect(page).toHaveURL(/#comparison\/tailor$/);
  await expect(page.getByText('No feasible candidate.', { exact: true })).toBeVisible();
  await expect(page.locator('.plan-card')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Create decision draft' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inspect ledger' })).toHaveCount(4);
});

test('comparison shows four saved alternatives and preserves the fixture disclaimer', async ({ page }) => {
  await openView(page, 'comparison/farmer');
  await expect(page.locator('.plan-card')).toHaveCount(4);
  await expect(page.getByText('Saved recommendation', { exact: true })).toHaveCount(1);
  await expect(page.getByText('No new calculation was run.', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Comparison borrower' }).selectOption('tailor');
  await expect(page.getByText('None of four candidates', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Comparison borrower' }).selectOption('farmer');
  await expect(page.getByText('Saved recommendation', { exact: true })).toHaveCount(1);
});

test('all four saved ledgers expose 26 rows and selecting another plan updates the title', async ({ page }) => {
  await openView(page, 'comparison/farmer');
  for (let index = 0; index < 4; index++) {
    const card = page.locator('.plan-card').nth(index);
    const name = await card.getByRole('heading', { level: 2 }).innerText();
    await card.getByRole('button', { name: /Explore this plan|Inspect ledger/ }).click();
    const ledger = page.getByRole('region', { name: 'Saved plan ledger' });
    await expect(ledger.getByRole('heading', { level: 2 })).toHaveText(`${name}: weekly ledger`);
    await expect(ledger.locator('tbody tr')).toHaveCount(26);
  }
});

test('saved ledger CSV exports the complete 26-week table in explicit paise units', async ({ page }) => {
  await openView(page, 'comparison/farmer');
  await page.getByRole('button', { name: 'Explore this plan' }).click();
  const csv = await captureDownload(page, () => page.getByRole('button', { name: 'Export CSV', exact: true }).click());
  expect(csv.name).toBe('domino-seasonal-saved-ledger.csv');
  const lines = csv.text.trim().split(/\r?\n/);
  expect(lines).toHaveLength(27);
  expect(lines[0]).toBe('week,date,incomePaise,essentialsPaidPaise,repaymentPaidPaise,closingCashPaise,outstandingPrincipalPaise,outstandingInterestPaise');
  expect(lines.slice(1).map(line => Number(line.split(',')[0]))).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  expect(lines.every(line => line.split(',').length === 8)).toBe(true);
  await expect(page.getByRole('status')).toContainText('All monetary values are in paise');
});

test('decision form requires a meaningful reason before it creates a local draft', async ({ page }) => {
  await openView(page, 'comparison/farmer');
  await page.getByRole('button', { name: 'Create decision draft' }).click();
  const reason = page.getByRole('textbox', { name: 'Why does this plan fit?' });
  await expect(reason).toHaveAttribute('required', '');
  await expect(reason).toHaveAttribute('minlength', '12');
  await page.getByRole('button', { name: 'Save decision draft' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('domino-decisions'))).toBeNull();
  await reason.fill('            a');
  await page.getByRole('button', { name: 'Save decision draft' }).click();
  await expect(page.getByRole('status')).toContainText('at least 12 characters');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('a decision persists, becomes reviewed, and exports without claiming activation', async ({ page }) => {
  await openView(page, 'comparison/farmer');
  await page.getByRole('button', { name: 'Create decision draft' }).click();
  const reason = 'Harvest receipts are uneven. Review the saved seasonal schedule with the borrower.';
  await page.getByRole('textbox', { name: 'Why does this plan fit?' }).fill(reason);
  await page.getByRole('textbox', { name: /Consent reference/ }).fill('DEMO-CONSENT-TEST');
  await page.getByRole('button', { name: 'Save decision draft' }).click();
  await expect(page).toHaveURL(/#decisions$/);
  await expect(page.locator('.decision-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.decision-card')).toContainText(reason);
  await page.getByRole('button', { name: 'Mark reviewed' }).click();
  await expect(page.locator('.decision-card .badge')).toHaveText('Reviewed');
  const exported = await captureDownload(page, () => page.getByRole('button', { name: 'Export record' }).click());
  const record = JSON.parse(exported.text);
  expect(record).toMatchObject({ mode: 'demonstration-only', activated: false, state: 'Reviewed', reason, consent: 'DEMO-CONSENT-TEST', borrowerId: 'farmer', planId: 'seasonal' });
  await page.reload();
  await expect(page.locator('.decision-card .badge')).toHaveText('Reviewed');
  await expect(page.getByRole('button', { name: 'Mark reviewed' })).toHaveCount(0);
});

test('scenario presets update their values and distinguish diagnostic assumptions', async ({ page }) => {
  await openView(page, 'scenarios');
  for (const [name, delay, reduction, expenses] of [
    ['A later harvest', '2', '0', '0'], ['Household pressure', '0', '15', '10'],
    ['Income interruption', '0', '100', '0'], ['Baseline cash flow', '0', '0', '0'],
  ]) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.getByRole('slider', { name: 'Income arrives late' })).toHaveValue(delay);
    await expect(page.getByRole('slider', { name: 'Income reduction', exact: true })).toHaveValue(reduction);
    await expect(page.getByRole('slider', { name: 'Essential expenses rise' })).toHaveValue(expenses);
  }
  await page.getByRole('button', { name: /Income interruption/ }).click();
  await expect(page.locator('.scenario-story .badge')).toHaveText('Diagnostic scenario');
  await expect(page.getByRole('heading', { name: 'What if income stops?' })).toBeVisible();
});

test('scenario sliders are keyboard operable across their full configured ranges', async ({ page }) => {
  await openView(page, 'scenarios');
  for (const [label, max] of [['Income arrives late', '8'], ['Income reduction', '100'], ['Essential expenses rise', '50'], ['Protected cash buffer', '6000']]) {
    const slider = page.getByRole('slider', { name: label, exact: true });
    await slider.focus();
    await page.keyboard.press('End');
    await expect(slider).toHaveValue(max);
    await page.keyboard.press('Home');
    await expect(slider).toHaveValue('0');
  }
});

test('scenario drafts persist, export as unevaluated, and can be removed', async ({ page }) => {
  await openView(page, 'scenarios');
  await page.getByRole('button', { name: /A later harvest/ }).click();
  await page.getByRole('button', { name: 'Save scenario draft' }).click();
  await expect(page.getByRole('status')).toContainText('Evaluation has not been run');
  await page.reload();
  await expect(page.getByText('Not evaluated', { exact: true })).toHaveCount(1);
  const exported = await captureDownload(page, () => page.getByRole('button', { name: 'Export drafts' }).click());
  const record = JSON.parse(exported.text);
  expect(record.type).toBe('unevaluated-scenario-drafts');
  expect(record.scenarios).toHaveLength(1);
  expect(record.scenarios[0]).toMatchObject({ name: 'A later harvest', delay: 2, kind: 'Required', buffer: 1500 });
  await page.getByRole('button', { name: 'Remove A later harvest draft' }).click();
  await expect(page.getByRole('heading', { name: 'A little preparation goes a long way' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Export drafts' })).toHaveCount(0);
});

test('valid CSV previews locally and the downloadable sample matches the declared columns', async ({ page }) => {
  await openView(page, 'borrowers');
  await page.getByRole('button', { name: 'Preview an import' }).click();
  const sample = await captureDownload(page, () => page.getByRole('button', { name: 'Download a sample CSV' }).click());
  expect(sample.name).toBe('domino-example.csv');
  expect(sample.text.split('\n')[0]).toBe('date,income_inr,essentials_inr');
  await page.getByLabel('Choose CSV file').setInputFiles({ name: 'sample.csv', mimeType: 'text/csv', buffer: Buffer.from(sample.text) });
  await expect(page.getByRole('dialog').getByText('2 rows ready to preview')).toBeVisible();
  await expect(page.locator('.import-table tbody tr')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toContainText('Local preview only');
});

for (const [name, filename, content, error] of [
  ['wrong columns', 'wrong.csv', 'date,income,essentials\n2026-09-01,10,5', 'Expected columns'],
  ['nonnumeric cells', 'bad.csv', 'date,income_inr,essentials_inr\n2026-09-01,nope,5', 'Every row needs a date'],
  ['invalid dates', 'date.csv', 'date,income_inr,essentials_inr\nnot-a-date,10,5', 'Every row needs a date'],
  ['impossible calendar dates', 'calendar.csv', 'date,income_inr,essentials_inr\n2026-02-30,10,5', 'Every row needs a date'],
  ['empty values', 'empty.csv', 'date,income_inr,essentials_inr\n2026-09-01,,5', 'Every row needs a date'],
  ['non CSV extensions', 'sample.txt', 'date,income_inr,essentials_inr\n2026-09-01,10,5', 'Choose a .csv file'],
] as const) {
  test(`CSV preview rejects ${name} and explains the issue`, async ({ page }) => {
    await openView(page, 'borrowers');
    await page.getByRole('button', { name: 'Preview an import' }).click();
    await page.getByLabel('Choose CSV file').setInputFiles({ name: filename, mimeType: 'text/plain', buffer: Buffer.from(content) });
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(error);
    await expect(page.locator('.import-table')).toHaveCount(0);
  });
}

test('CSV preview enforces the 64 KB limit and recovers with a valid file', async ({ page }) => {
  await openView(page, 'borrowers');
  await page.getByRole('button', { name: 'Preview an import' }).click();
  await page.getByLabel('Choose CSV file').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.alloc(65_537, 'a') });
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('smaller than 64 KB');
  await page.getByLabel('Choose CSV file').setInputFiles({ name: 'valid.csv', mimeType: 'text/csv', buffer: Buffer.from('date,income_inr,essentials_inr\n2026-09-01,10,5') });
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('1 rows ready to preview')).toBeVisible();
});

test('dialogs trap keyboard focus, close with Escape and restore the opener', async ({ page, browserName }) => {
  await openView(page);
  const opener = page.getByRole('button', { name: 'Workspace guide', exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let count = 0; count < 6; count++) {
    await page.keyboard.press(traversalKey(browserName));
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    const focusRing = await dialog.locator(':focus').evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: Number.parseFloat(getComputedStyle(element).outlineWidth) }));
    expect(focusRing.style).not.toBe('none');
    expect(focusRing.width).toBeGreaterThanOrEqual(2);
  }
  for (let count = 0; count < 4; count++) {
    await page.keyboard.press(traversalKey(browserName, true));
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('activity dialog reports local drafts and can be dismissed with its close control', async ({ page }) => {
  await openView(page);
  await page.getByRole('button', { name: 'View activity' }).click();
  const dialog = page.getByRole('dialog', { name: 'Workspace activity' });
  await expect(dialog).toContainText('0 local decision drafts');
  await expect(dialog).toContainText('Demonstration evidence');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).not.toBeVisible();
});

test('source registry expands each record with an attributable external link', async ({ page }) => {
  await openView(page, 'evidence');
  for (let index = 0; index < 4; index++) {
    const row = page.locator('.source-row').nth(index);
    await row.getByRole('button').click();
    await expect(row.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await expect(row.getByRole('link', { name: 'Open source' })).toHaveAttribute('href', /^https:\/\//);
    await expect(row.locator('.source-details')).not.toBeEmpty();
    await row.getByRole('button').click();
    await expect(row.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  }
  await expect(page.getByText('156 income-expense gaps are not defaults', { exact: false })).toBeVisible();
});

test('malformed stored JSON does not break the workspace', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('domino-decisions', '{broken');
    localStorage.setItem('domino-scenarios', '{broken');
  });
  await openView(page, 'decisions');
  await expect(page.getByRole('heading', { name: 'The next step starts with understanding' })).toBeVisible();
});

test('skip link moves keyboard focus to main content', async ({ page, browserName }) => {
  await openView(page);
  await page.keyboard.press(traversalKey(browserName));
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('mobile navigation opens, changes view and closes without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openView(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Scenario lab' }).click();
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  await expect(page.locator('main h1')).toHaveText('A plan for “what if”.');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('closed mobile navigation stays out of the keyboard order and opens accessibly', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openView(page);
  const sidebar = page.locator('.sidebar');
  const opener = page.getByRole('button', { name: 'Open navigation' });
  await expect(sidebar).toBeHidden();
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await expect(opener).toHaveAttribute('aria-controls', await sidebar.getAttribute('id') || '');
  for (let count = 0; count < 8; count++) {
    await page.keyboard.press(traversalKey(browserName));
    expect(await sidebar.evaluate(element => element.contains(document.activeElement))).toBe(false);
  }
  await opener.click();
  await expect(sidebar).toBeVisible();
  await expect(opener).toHaveAttribute('aria-expanded', 'true');
  await sidebar.getByRole('button', { name: 'Evidence library' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main h1')).toHaveText('Evidence you can follow.');
  await expect(sidebar).toBeHidden();
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
});

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`every major view fits a ${width}px viewport without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ['overview', 'borrowers', 'borrower/farmer', 'comparison/farmer', 'scenarios', 'decisions', 'evidence']) {
      await openView(page, view);
      const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(size.content, `${view} should contain wide tables in their own scroll region`).toBeLessThanOrEqual(size.viewport + 1);
    }
  });
}

test('reduced-motion preference disables entrance and navigation animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openView(page, 'scenarios');
  await page.getByRole('button', { name: 'Save scenario draft' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  expect(await page.getByRole('status').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  const transitionSeconds = await page.locator('.sidebar').evaluate(element => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(transitionSeconds).toBeLessThanOrEqual(0.00001);
});

for (const view of ['overview', 'borrowers', 'borrower/farmer', 'borrower/vendor', 'borrower/tailor', 'comparison/farmer', 'comparison/tailor', 'scenarios', 'decisions', 'evidence']) {
  test(`WCAG 2.2 AA automated accessibility: ${view}`, async ({ page }, testInfo) => {
    await openView(page, view);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    await testInfo.attach('axe-results', { body: JSON.stringify({ violations: results.violations, incomplete: results.incomplete }, null, 2), contentType: 'application/json' });
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), null, 2)).toEqual([]);
  });
}

test('open guide dialog has no automated WCAG 2.2 AA violations', async ({ page }) => {
  await openView(page);
  await page.getByRole('button', { name: 'Workspace guide', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), null, 2)).toEqual([]);
});
