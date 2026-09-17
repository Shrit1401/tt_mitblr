# Frontend experiments

Completed Chromium and Firefox runs each passed **48 frontend cases with zero failures**. After a browser-specific date-formatting fix, **5 focused WebKit checks passed**. The final complete three-browser matrix is still running and is not counted as passed in this publication snapshot.

The suite exercises the visible product and local browser behavior. It does not call, import, compile, or test the application backend, database, worker, optimizer, or calculation engine. Saved fixture values are inspected as interface content. They are not recalculated or validated as financial results.

## Reproduce the frontend suite

From the repository root, install the pinned dependencies and browser binaries, then build the isolated frontend export:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run build:prototype
npm run test:frontend
```

The Playwright configuration starts `npm run preview` when a local page server is not already running. That command serves the static export. It does not start an API server. For an explicit preview server on another port, set its address:

```sh
FRONTEND_BASE_URL=http://127.0.0.1:49259 npm run test:frontend
```

Individual browser projects can also run independently:

```sh
FRONTEND_BASE_URL=http://127.0.0.1:49259 npx playwright test --project=chromium
FRONTEND_BASE_URL=http://127.0.0.1:49259 npx playwright test --project=firefox
FRONTEND_BASE_URL=http://127.0.0.1:49259 npx playwright test --project=webkit
```

The default configuration uses three workers locally, no retries, isolated browser contexts, a 30-second case timeout, and a 7-second assertion timeout. Every test runs against the same browser-local demonstration workflow. No real borrower data or authenticated account is used.

Full machine results are written to `test-results/frontend-results.json`. The HTML report is in `playwright-report/`. Failed cases retain a screenshot and trace. Those generated artifacts are excluded from version control.

After a complete passing run, produce the compact committed summary:

```sh
node tests/frontend/summarize-results.mjs test-results/frontend-results.json
```

The summarizer accepts multiple JSON reports when browser projects run separately. It rejects failed, skipped, retried, duplicate, incomplete, or unaudited results. It records the Playwright version, browser versions, outcome for every case/browser pair, API-attempt and browser-error totals, and checksums of the isolated static artifact.

## Test boundary

[fixtures.ts](../tests/frontend/fixtures.ts) installs a context-level request interception before the first navigation. Every URL whose path enters `/api` is aborted. A separate request listener records attempted API calls, and the test fails if even one is attempted. Blocking therefore cannot silently make a backend-dependent feature appear to pass.

Every case also collects browser `console.error` events and uncaught page errors. The after-test audit requires both lists to remain empty and attaches the evidence to the machine report. Service workers are blocked. Tests use DOM interaction, local storage, file inputs, and browser downloads. They do not use Playwright's HTTP request fixture.

The static artifact is created by an explicit frontend allowlist in [build-prototype.mjs](../scripts/build-prototype.mjs). API routes, server services, engine packages, workers, migrations, and optimizer modules are excluded from that build. The default test server serves files from that export.

## Experiment coverage

There are **48 distinct cases per browser**. The following groups sum to that count.

| Group | Cases per browser | What is exercised |
|---|---:|---|
| Overview and navigation | 3 | Demo labels, featured borrower, sidebar active state, hash URLs, deep-link reload, browser Back |
| Search and filtering | 3 | Name/livelihood/location search, combined income filters, empty results, keyboard command palette |
| Borrowers, comparison and ledgers | 5 | Pending vendor, declined tailor, four saved alternatives, all four 26-row ledgers, complete CSV export |
| Decision drafts | 2 | Required meaningful reason, local save, reload persistence, reviewed state, consent reference, JSON export without activation |
| Scenario preparation | 3 | All four presets, diagnostic labeling, keyboard range boundaries, local persistence, export, deletion |
| CSV preview | 8 | Downloadable valid sample, two-row preview, bad headers, nonnumeric values, malformed dates, impossible dates, empty cells, wrong extension, size rejection and recovery |
| Dialogs, source records and resilience | 5 | Forward/reverse focus containment, Escape, opener restoration, activity dismissal, source expansion/links, malformed stored JSON, skip link |
| Responsive layout and reduced motion | 8 | Mobile menu behavior, closed-drawer keyboard exclusion, five viewport-width sweeps, reduced-motion styles |
| Automated accessibility | 11 | Ten distinct views and the open workspace-guide dialog |
| **Total** | **48** | Same behavior contract in each browser engine |

Some cases intentionally check several parts of one user journey. For example, decision creation, reload, review and export remain in a single case so persistence is tested as the user experiences it.

### Navigation and honest states

The suite opens every primary workspace section and checks its heading, active navigation state, and URL. Borrower deep links survive reload and browser Back restores the previous profile. Searches cover names, occupations and locations, including case-insensitive input and a deliberately empty result.

The market-vendor profile must state that it awaits evaluation. It must not offer invented saved plans. The declining-income profile must state that no feasible saved candidate exists, display all four inspectable ledgers, and expose no decision-selection control. Tests verify those interface states without running a calculation.

### Ledgers and browser exports

Each saved plan must expose 26 visible ledger rows with a title matching the chosen plan. The seasonal ledger CSV must contain a header plus 26 data rows, weeks 1 through 26, and eight columns with explicit `Paise` monetary field names. The UI confirms the export's units.

Decision JSON must retain the reviewer reason, optional consent reference, borrower/plan identifiers and reviewed status. Its exported `mode` remains `demonstration-only` and `activated` remains `false`. Scenario JSON must be labeled `unevaluated-scenario-drafts`. These checks protect the meaning of exported demonstration records.

### CSV preview boundaries

CSV input is a local preview. Experiments cover the required `date,income_inr,essentials_inr` header, numeric cells, date format, actual calendar validity, missing values, `.csv` extension, and the 64 KB limit. A file of 65,537 bytes is rejected. Replacing it with a valid file clears the error and restores the preview.

The tests confirm that a valid sample displays two rows and that no API request occurs. They do not test server import validation, reconciliation, borrower record creation, or persistence to a database.

### Keyboard and layout

The command palette opens with `Control+K` and focuses its input. The native dialog keeps focus inside its controls through both Tab and Shift+Tab. Escape closes it and restores the opening control. The skip link transfers focus to the main landmark. Range controls reach their documented minimum and maximum using Home and End.

On macOS WebKit, traversal uses Option+Tab and Option+Shift+Tab to include links and clickable controls under the host's keyboard preference. This follows [Apple's documented Safari keyboard behavior](https://support.apple.com/en-ae/guide/safari/cpsh003/mac). Other projects use Tab and Shift+Tab. The tests do not change system settings. The focus-restoration case opens the guide with Enter from its focused control.

The responsive sweep uses **360, 390, 768, 1024 and 1440 CSS-pixel widths**. At each width it checks Overview, Borrowers, the farmer profile, Plan comparison, Scenario lab, Decisions and Evidence library. Wide data tables may scroll inside their own containers; the page itself must not exceed the viewport width by more than one pixel.

That provides 35 layout checks per browser. The mobile navigation cases separately check opening the drawer, navigating, closing after selection and dismissing with Escape. The closed drawer must be hidden and stay out of the keyboard order across eight Tab presses. Its opener exposes the correct `aria-controls` and `aria-expanded` state, and the opened drawer supports navigation with Enter. Reduced-motion mode must disable the toast entrance animation and limit navigation transitions to at most 0.01 milliseconds.

### Automated accessibility

The suite uses axe-core tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`. At the default 1440 × 1000 viewport, it scans Overview, Borrowers, all three borrower profiles, both comparison states, Scenario lab, Decisions and Evidence library. It also scans the open workspace-guide dialog. Mobile layout and keyboard behavior are exercised separately.

Every scan requires zero reported violations. The full view-level output retains findings that axe marks incomplete so they remain visible for manual review. Automated scans do not establish complete WCAG conformance, screen-reader usability, or accessibility certification. Keyboard behavior is separately exercised through the interaction cases above.

## Verification recorded at publication

The static preview target is `http://127.0.0.1:49259`. On 17 September 2026, completed Chromium and Firefox runs passed 48 cases each with zero API attempts, uncaught page errors and console errors. A date-formatting mismatch found in WebKit was corrected, and 5 focused WebKit checks then passed. No test retries were used. The complete final matrix remains in progress at publication.

| Browser project | Passed | Failed | Skipped | Status |
|---|---:|---:|---:|---|
| Chromium | 48 | 0 | 0 | Completed against static export |
| Firefox | 48 | 0 | 0 | Completed browser run |
| WebKit | 5 focused checks | 0 in focused run | 0 in focused run | Full matrix in progress |

## What these results do not claim

Passing frontend experiments means the tested demonstration journeys behave as asserted in the recorded browser versions and viewport sizes. It does not verify financial accounting, forecast accuracy, stress-scenario feasibility, approval authorization, loan activation, security isolation between real tenants, backend latency, or production readiness.

Public-data research results and their own limitations are documented separately in [research-experiments.md](research-experiments.md). Saved borrower fixtures, public evidence and measured product outcomes remain distinct throughout the prototype.
