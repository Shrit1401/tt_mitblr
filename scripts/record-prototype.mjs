import { chromium } from '@playwright/test';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const baseURL = process.env.FRONTEND_BASE_URL || 'http://127.0.0.1:3000';
const outputDirectory = resolve('output');
const recordingDirectory = resolve('output/recording');
const outputPath = resolve('output/DOMINO-prototype-walkthrough.mp4');
const ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg';
await mkdir(recordingDirectory, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'en-GB',
  timezoneId: 'Asia/Kolkata',
  serviceWorkers: 'block',
  recordVideo: { dir: recordingDirectory, size: { width: 1440, height: 900 } },
});
const apiRequests = [];
const browserErrors = [];
await context.route('**/*', async (route) => {
  if (/^\/api(?:\/|$)/.test(new URL(route.request().url()).pathname)) {
    apiRequests.push(route.request().url());
    await route.abort();
    return;
  }
  await route.continue();
});
const page = await context.newPage();
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text());
});
await page.goto(`${baseURL}/#overview`, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: /Good morning, Shrit/ }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.mouse.move(1418, 870);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

const sequenceStart = Date.now();
await page.waitForTimeout(2500);
async function scrollToEdge(bottom, duration = 4500) {
  await page.evaluate(
    ({ bottom, duration }) =>
      new Promise((resolveAnimation) => {
        const start = window.scrollY;
        const finish = bottom ? document.documentElement.scrollHeight - window.innerHeight : 0;
        const startTime = performance.now();
        function frame(now) {
          const progress = Math.min(1, (now - startTime) / duration);
          const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
          window.scrollTo({ top: start + (finish - start) * eased, behavior: 'instant' });
          if (progress < 1) requestAnimationFrame(frame);
          else resolveAnimation();
        }
        requestAnimationFrame(frame);
      }),
    { bottom, duration },
  );
}
for (let cycle = 0; cycle < 2; cycle += 1) {
  await scrollToEdge(true);
  await page.waitForTimeout(1000);
  await scrollToEdge(false);
  if (cycle === 0) await page.waitForTimeout(1000);
}
await page.waitForTimeout(2500);
const sequenceDurationSeconds = (Date.now() - sequenceStart) / 1000;
const video = page.video();
await context.close();
await browser.close();

if (apiRequests.length || browserErrors.length) {
  throw new Error(JSON.stringify({ apiRequests, browserErrors }));
}
const rawPath = await video.path();
// Keep the final loaded-page sequence, omitting startup frames from the recording.
execFileSync(
  ffmpeg,
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-sseof',
    `-${sequenceDurationSeconds.toFixed(3)}`,
    '-i',
    rawPath,
    '-an',
    '-vf',
    'fps=30',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputPath,
  ],
  { stdio: 'inherit' },
);

const metadata = {
  createdAt: new Date().toISOString(),
  baseURL,
  artifact: 'DOMINO-prototype-walkthrough.mp4',
  width: 1440,
  height: 900,
  framesPerSecond: 30,
  sequenceDurationSeconds,
  scrollCycles: 2,
  apiRequests,
  browserErrors,
  backendExecuted: false,
  bytes: (await stat(outputPath)).size,
};
await writeFile(
  resolve(outputDirectory, 'DOMINO-prototype-walkthrough.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
);
console.log(JSON.stringify({ outputPath, ...metadata }, null, 2));
