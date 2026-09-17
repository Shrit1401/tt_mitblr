# Operations

## Run the browser prototype

Use Node.js 22.12 or later and npm. Install the pinned dependency tree from the repository root:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The development server binds to `127.0.0.1`. The interface uses fixture data and needs no database, Redis instance, credentials, or running worker.

Use the navigation to move between the overview, borrower records, plan comparison, scenario lab, evidence, and decision drafts. A browser decision draft is a local prototype record. Its export is a downloadable review artifact, not a servicing instruction.

Rani and Asha have previously saved v1 example evaluations. Meera has a synthetic profile with no saved evaluation. Plan comparison shows those archived results and allows ledger export. Scenario controls prepare assumptions, which can be saved and exported, but do not execute an evaluation. The import dialog previews a CSV locally and does not submit it to an API.

## Frontend verification

```sh
npm run check:frontend
npx playwright install chromium
npm run test:frontend
npm run build:prototype
npm run preview
```

The frontend TypeScript configuration excludes API handlers and server modules. The prototype build copies the browser surface into a separate build directory so that frontend validation does not execute the backend. Preview serves the generated static output on port 3000; stop the development server first if it occupies that port.

Playwright exercises the browser prototype. Captures under `docs/images/` are actual rendered screens from this implementation, not design mockups. The [implementation status register](implementation-status.md) records the final completed checks.

No blanket `npm test`, backend compilation, API exercise, worker execution, database migration, or solver run belongs to this delivery's verification scope. Backend code was prepared but deliberately left unexecuted at the user's request.

## Record a prototype walkthrough

With the static prototype preview running and an FFmpeg binary that supports H.264 available:

```sh
FRONTEND_BASE_URL=http://127.0.0.1:3000 node scripts/record-prototype.mjs
```

Set `FFMPEG_BIN` to an explicit binary path if FFmpeg is not on `PATH`. The script opens an isolated Playwright browser context, waits for the overview and fonts, then records two smooth downward and upward scroll cycles. It converts the loaded-page sequence to a 1440 × 900, 30 fps H.264 MP4, approximately 26 seconds long.

The result is `output/DOMINO-prototype-walkthrough.mp4`; a JSON sidecar records the capture settings and browser/API audit. Both the recording and intermediate files are local artifacts excluded from version control. The script aborts API requests and rejects a capture with any recorded API attempt or browser error. It does not control the user's browser or contact a messaging service.

## Public research

The public research workflow is independent of the repayment engine:

```sh
npm run test:research
```

Read [the experiment report](research-experiments.md) for the exact analyses, source requirements, exclusions, and recorded results. Some original-source reproduction steps need raw files retained locally for research and intentionally omitted from the public repository. A fresh checkout must report those steps as unavailable or skipped when their inputs are absent. It must not replace missing source records with synthetic records or claim to have rerun them.

The attributed aggregate tables and committed result summaries remain reviewable in a public checkout. Retain the reference period, population, units, transformations, and denominator when quoting a result.

## Backend delivery boundary

Backend code is an implementation handoff. The source may include interfaces, route handlers, domain calculations, persistence definitions, or job infrastructure described in its accompanying documentation. None has been started or verified during this delivery. Use the backend-specific README for its exact current file inventory and integration requirements.

Before anyone enables it operationally, a separate authorized validation task must establish:

1. A reproducible installation and explicit backend compile boundary.
2. Correct paise arithmetic, event ordering, maturity handling, and accounting identities.
3. Authentication, role enforcement, tenant scoping, safe errors, and bounded request parsing.
4. Database migrations, runtime row-security behavior, and atomic version checks.
5. Durable evaluation and outbox commits, repeated delivery, retry recovery, and failure handling.
6. API parity, ledger pagination, import rejection reports, and complete source lineage.
7. Independent replay and honest status reporting for any optimized schedule.

This list describes required future verification. It does not imply that these checks have passed.

## Production configuration design

The intended deployment separates the web process, calculation worker, PostgreSQL, Redis, and private object storage. Keep credentials in server-only environment variables. Never put database credentials, service tokens, or raw borrower files in browser assets.

Production deployments also need an identity provider, explicit membership and role rules, consent records, retention/deletion policies, encrypted transport, backups with restore verification, and a servicing integration that cannot activate a schedule silently.

Each evaluation should retain:

- Snapshot, loan, policy, engine, and source versions.
- Required and diagnostic scenario definitions and any random seed.
- Start/end timestamps, result hashes, candidate status, and solver status where applicable.
- A request identifier and redacted audit events.

## Monitoring design

Monitor queue age, job duration, repeated failures, invariant failures, source freshness, import rejection rates, stale-loan conflicts, and approval failures. Log record IDs and error categories without copying transaction details.

An engine failure means the calculation needs investigation. It must not produce an adverse borrower label. A timed optimization search with no valid result must remain `search_incomplete`; a proven infeasibility result needs solver evidence tied to its exact model.

For worker recovery, persist job intent with the evaluation in one database transaction. Treat every delivery as potentially repeated. Commit immutable results under an appropriate unique key. A queue-level deduplication option alone does not establish exactly-once state changes.

## Repository publishing

Publish the application source, documentation, screenshots, attributed aggregate research tables, and experiment summaries. Exclude credentials, dependency caches, local build outputs, private raw source files, and any household-level data without clear redistribution permission.

The [source provenance manifest](../data/public/provenance.md) distinguishes public accessibility from redistribution rights. Original publisher PDFs and FinMark household-level files are retained locally where needed for research. Their absence from a public checkout is deliberate.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Port 3000 is busy | Stop the other preview/development process or use an available port |
| Chromium is missing | Run `npx playwright install chromium` before frontend tests |
| Research reports missing raw data | Read the source instructions and retain the recorded run as historical evidence until authorized inputs are available |
| A browser draft is not visible elsewhere | Prototype drafts are local; they are not shared lender records |
| An API or worker fails | Keep the frontend in fixture mode and open a separate backend-validation task |
| A published number is misunderstood as product impact | Restore its population, period, denominator, and source note |
