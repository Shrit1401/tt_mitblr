import { test as base, expect, type Download, type Page } from '@playwright/test';

const apiPath = /\/api(?:\/|$|\?)/;

export const test = base.extend<{ frontendGuard: void }>({
  frontendGuard: [async ({ page, context }, use, testInfo) => {
    const apiRequests: string[] = [];
    const errors: string[] = [];
    // Guard every request before the first page navigation. Tests never use
    // request fixtures or import application server or calculation modules.
    context.on('request', request => {
      if (apiPath.test(new URL(request.url()).pathname)) apiRequests.push(request.url());
    });
    await context.route(apiPath, route => route.abort('blockedbyclient'));
    page.on('pageerror', error => errors.push(`Page error: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`Console error: ${message.text()}`);
    });
    await use();
    await testInfo.attach('frontend-boundary', {
      body: JSON.stringify({ apiRequests, browserErrors: errors }, null, 2),
      contentType: 'application/json',
    });
    expect(apiRequests, 'No frontend experiment may issue an API request').toEqual([]);
    expect(errors, 'Frontend should emit no runtime or console errors').toEqual([]);
  }, { auto: true }],
});

export { expect };

// macOS WebKit uses Option+Tab to include links and clickable controls when
// the host's full keyboard navigation preference is off. Do not change it.
export function traversalKey(browserName: string, reverse = false) {
  const option = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+' : '';
  return `${option}${reverse ? 'Shift+' : ''}Tab`;
}

export async function openView(page: Page, hash = 'overview') {
  await page.goto(`./#${hash}`);
  await expect(page.locator('main h1')).toBeVisible();
  // Await hydration and the hash-restoration effect through the page's landmark.
  const headings: Record<string, string | RegExp> = {
    overview: 'Good morning, Shrit.', borrowers: 'Your borrowers.',
    comparison: 'Find the right fit.', scenarios: 'A plan for “what if”.',
    evidence: 'Evidence you can follow.', decisions: 'Every decision, explained.',
    'borrower/farmer': 'Rani Devi', 'borrower/vendor': 'Meera Shah', 'borrower/tailor': 'Asha Rao',
  };
  await expect(page.locator('main h1')).toHaveText(headings[hash] || headings[hash.split('/')[0]]);
}

export async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Browser did not provide a download stream');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export async function captureDownload(page: Page, action: () => Promise<void>) {
  const pending = page.waitForEvent('download');
  await action();
  const download = await pending;
  return { name: download.suggestedFilename(), text: await downloadText(download) };
}
