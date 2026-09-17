import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error('Usage: node tests/frontend/summarize-results.mjs <playwright-report.json> [...]');
const projects = ['chromium', 'firefox', 'webkit'];
const cases = new Map();
const runs = [];
let boundaryChecks = 0;
let attemptedApiRequests = 0;
let browserErrors = 0;

function inspectSuites(suites) {
  for (const suite of suites) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests) {
        const project = test.projectName;
        if (!projects.includes(project)) throw new Error(`Unexpected browser project: ${project}`);
        if (test.results.length !== 1 || test.results[0].status !== 'passed') {
          throw new Error(`Cannot publish a passing summary: ${project}: ${spec.title}`);
        }
        const result = test.results[0];
        const entry = cases.get(spec.title) || { name: spec.title };
        if (entry[project]) throw new Error(`Duplicate result: ${project}: ${spec.title}`);
        entry[project] = result.status;
        cases.set(spec.title, entry);
        const boundary = result.attachments.find(attachment => attachment.name === 'frontend-boundary');
        if (!boundary?.body) throw new Error(`Missing API boundary evidence: ${spec.title}`);
        const audit = JSON.parse(Buffer.from(boundary.body, 'base64').toString('utf8'));
        boundaryChecks += 1;
        attemptedApiRequests += audit.apiRequests.length;
        browserErrors += audit.browserErrors.length;
      }
    }
    inspectSuites(suite.suites || []);
  }
}

for (const input of inputs) {
  const report = JSON.parse(await readFile(input, 'utf8'));
  if (report.errors.length || report.stats.unexpected || report.stats.skipped || report.stats.flaky) {
    throw new Error(`Unresolved, skipped, or flaky results in ${input}`);
  }
  inspectSuites(report.suites);
  runs.push({
    startedAt: report.stats.startTime,
    durationMs: Math.round(report.stats.duration),
    passed: report.stats.expected,
    baseUrl: report.config.metadata?.baseURL || process.env.FRONTEND_BASE_URL || 'See test run configuration',
  });
}

for (const entry of cases.values()) {
  if (!projects.every(project => entry[project] === 'passed')) {
    throw new Error(`Incomplete browser matrix: ${entry.name}`);
  }
}
if (attemptedApiRequests || browserErrors) throw new Error('Frontend boundary or browser error audit failed');

const artifactRoot = resolve('.prototype-build/out');
const artifactFiles = [];
async function inspectFiles(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await inspectFiles(path);
    else if (entry.isFile()) artifactFiles.push({ path: relative(artifactRoot, path), sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
  }
}
await inspectFiles(artifactRoot);
const browsers = JSON.parse(await readFile('node_modules/playwright-core/browsers.json', 'utf8')).browsers;
const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: 'Browser interaction and accessibility experiments against the isolated static frontend export',
  playwrightVersion: JSON.parse(await readFile('node_modules/@playwright/test/package.json', 'utf8')).version,
  runner: { nodeVersion: process.version, platform: process.platform, architecture: process.arch },
  browsers: Object.fromEntries(projects.map(name => [name, browsers.find(browser => browser.name === name)?.browserVersion || 'See Playwright browser manifest'])),
  casesPerBrowser: cases.size,
  passed: cases.size * projects.length,
  failed: 0,
  skipped: 0,
  retries: 0,
  frontendBoundary: { checks: boundaryChecks, attemptedApiRequests, browserErrors, apiRoutesBlocked: true, serviceWorkersBlocked: true, backendTested: false },
  coverage: {
    accessibleViews: ['overview', 'borrowers', 'borrower/farmer', 'borrower/vendor', 'borrower/tailor', 'comparison/farmer', 'comparison/tailor', 'scenarios', 'decisions', 'evidence'],
    accessibilityDialog: 'Workspace guide',
    axeTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    viewportWidths: [360, 390, 768, 1024, 1440],
    layoutViewsPerWidth: 7,
    keyboardTraversal: { macOSWebKit: 'Option+Tab and Option+Shift+Tab', otherProjects: 'Tab and Shift+Tab', systemSettingsChanged: false },
    focusRingAndSkipLinkVisibilityChecked: true,
    automatedAccessibilityIsNotCertification: true,
  },
  staticArtifact: {
    path: '.prototype-build/out',
    files: artifactFiles.length,
    manifestSha256: createHash('sha256').update(JSON.stringify(artifactFiles)).digest('hex'),
    indexHtmlSha256: artifactFiles.find(file => file.path === 'index.html')?.sha256,
    checksumMethod: 'SHA-256 of JSON-encoded, recursively path-sorted relative paths and per-file SHA-256 hashes',
  },
  runs,
  cases: Array.from(cases.values()),
};
await mkdir('docs', { recursive: true });
await writeFile('docs/frontend-results.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ passed: summary.passed, browsers: projects, boundaryChecks, attemptedApiRequests, browserErrors, output: 'docs/frontend-results.json' }, null, 2));
