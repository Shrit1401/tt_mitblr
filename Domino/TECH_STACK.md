# Domino prototype: tech stack and build plan

Status: planning only. The application has not been scaffolded. Update this document now; do not start implementation or create Git worktrees until the next instruction.

## Ownership and collaboration

- Codex owns the backend: data fixtures, cash-flow engine, forecasts, repayment schedules, comparisons, explanations, API, and backend tests.
- Claude owns the frontend: React screens, styling, charts, interaction state, API integration, and frontend checks.
- Each agent will work on a separate branch in a separate Git worktree of the same repository.
- Agree on the API contract before either side implements it. Claude can build against contract-matching mock responses while Codex implements the backend.
- Neither agent edits the other agent's owned files without coordinating the change.

No Git repository currently exists in this folder or its parent chain. Repository initialization, the initial commit, and worktree creation are future setup steps, not actions performed by this document update.

## Product goal

Help microfinance lenders structure repayments around irregular or seasonal borrower cash flows while balancing affordability and sustainable recovery. Explain recommendations using transaction history, expenses, repayment behavior, and changes in financial condition.

The main decision is which repayment amounts and dates a borrower can sustain. The existing `../domino.html` provides a visual reference and simulation ideas. This project focuses on repayment schedules rather than allocating community rescue funds.

## Proposed tech stack

| Layer | Choice | Purpose |
| --- | --- | --- |
| Interface | React + TypeScript | Borrower screens, comparison controls, and typed financial data |
| Development and build | Vite | Local development and a static production build |
| Styling | CSS with shared design tokens | Adapt the existing Domino colors, cards, spacing, and responsive layouts |
| Charts | Recharts | Income, expenses, repayment schedules, and closing cash over time |
| State | React state and context | Selected borrower, scenario assumptions, and candidate plans |
| Backend runtime | Node.js + TypeScript | Local API and financial calculation service, owned by Codex |
| API transport | Node.js HTTP server with a JSON API | Small prototype API; a framework can be introduced if needed |
| UI persistence | Browser localStorage | Save synthetic scenario settings and simulated plan selections |
| Data | Backend-owned typed fixtures | Reproducible borrower histories and scenarios served through the API |
| Calculation engine | Pure TypeScript functions on the backend | Cash-flow forecasting, schedule generation, comparison, and explanations |
| Tests | Vitest | Verify financial arithmetic, schedules, scenario behavior, and recommendation rules |
| Package management | npm | Dependency installation, scripts, and a committed lockfile |

Use compatible stable dependency versions when scaffolding and record the exact resolution in `package-lock.json`. Check the installed Node.js version against tool requirements at that point.

The prototype will use a React frontend and a local Node.js backend. The backend is the source of truth for financial calculations; the frontend renders API results rather than duplicating the calculation engine. Authentication, bank connections, and a production database are future work. Recommendations initially come from explicit calculations and rules; no trained model or LLM is required.

Use a Vite development proxy for `/api` requests to the local backend. Synthetic fixtures remain read-only in the backend. For this milestone, localStorage stores only demo UI settings and simulated plan selections, not authoritative lending records.

Official references: [Vite guide](https://vite.dev/guide/), [Recharts](https://recharts.github.io/), and [Vitest guide](https://vitest.dev/guide/).

## First complete user journey

1. Select a seasonal farmer and inspect their loan and historical cash flows.
2. See where fixed repayments conflict with cash availability.
3. Compare fixed, income-aligned, seasonal, and temporarily reduced repayment schedules.
4. Inspect the recommended schedule, evidence, assumptions, and tradeoffs.
5. Stress-test delayed income and higher essential expenses.
6. Save a simulated plan selection and inspect subsequent monitoring signals.

## Screens

### Borrower overview

Show income sources, essential expenses, current cash, loan balance, interest terms, and repayment history. Clearly label all case data as synthetic.

### Cash-flow analysis

Show historical and projected income, essential expenses, repayments, and remaining cash. Separate observations from forecasts. Highlight cash shortfalls and explain whether the available evidence supports seasonality, irregular timing, sustained decline, or an uncertain assessment.

### Repayment comparison

Compare candidate plans using the same borrower assumptions and forecast scenarios. Display stress periods, cash remaining, projected amount recovered, outstanding balance, payoff date, and total interest. Show extension and catch-up payment consequences explicitly.

### Recommendation and monitoring

Explain why the selected plan performs better, which evidence supports it, and what would change the recommendation. Keep lender review and simulated acceptance visible. New observations should update the assessment without treating one missed payment as proof of permanent deterioration.

## Data and model foundation

- Begin with one seasonal farmer, then add irregular weekly earnings and sustained income decline cases.
- Use dated transactions and a weekly projection ledger so monthly totals do not hide timing problems.
- Prefer two years of synthetic history for the seasonal case to show repeated cycles. Mark any assessment based on shorter history as limited.
- Keep borrower records, loan terms, observed transactions, forecast assumptions, repayment schedules, and simulation results as separate types.
- Represent money in integer paise with explicit rounding rules.
- Calculate closing cash from opening cash plus income minus paid essentials and actual repayments.
- Track unpaid essentials separately from unpaid loan obligations. Carry outstanding principal and interest forward.
- Define interest accrual, payment application order, maturity, and permitted extensions before implementing schedule comparisons.
- Preserve a configurable cash buffer when estimating affordable payments. If essentials cannot be met, report the shortfall explicitly.
- Evaluate expected, delayed-income, and lower-income scenarios. Keep scenario estimates distinct from calibrated repayment probabilities.
- Generate explanations from the same evidence and calculations used to compare plans.

## Recommendation approach

Generate a small, inspectable set of schedules and evaluate each through the same cash-flow engine. Apply explicit constraints for essentials, cash buffer, loan terms, and maximum extension. Compare borrower stress with lender recovery and repayment duration.

Document ranking rules and thresholds as prototype assumptions. If no candidate meets the constraints, show that no affordable plan was found and explain the tradeoff instead of forcing a positive recommendation. Keep remaining debt visible at the end of the projection horizon.

## Planned source structure

```text
Domino/
  TECH_STACK.md
  contracts/                 # Shared API specification and example payloads
    api.md
    examples/
  frontend/                  # Claude owns this directory
    package.json
    package-lock.json
    src/
      app/
      components/
      screens/
      api/
      styles/
    tests/
  backend/                   # Codex owns this directory
    package.json
    package-lock.json
    src/
      server.ts
      routes/
      data/
      domain/
        types.ts
        cash-flow.ts
        forecast.ts
        schedules.ts
        compare.ts
        explain.ts
    tests/
```

Only this Markdown file exists initially; the tree above describes the intended scaffold.

Keep frontend and backend package manifests and lockfiles separate to reduce merge conflicts. Shared contract changes must be coordinated and integrated before either side relies on them.

## Proposed API boundary

Finalize field names, validation rules, and example payloads in `contracts/api.md` before coding.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Check local service availability |
| `GET /api/borrowers` | List the synthetic borrower cases |
| `GET /api/borrowers/:id` | Retrieve loan terms, observed history, and evidence metadata |
| `POST /api/borrowers/:id/evaluate` | Evaluate candidate schedules under supplied scenario assumptions and return comparisons, projections, and explanations |

Evaluation requests identify a borrower and contain scenario settings such as income delay, income reduction, essential-expense adjustment, and minimum cash buffer. The backend validates inputs and uses its own borrower and loan fixtures.

Evaluation responses should include:

- Contract and model versions, scenario inputs, and explicit modeling assumptions.
- Candidate plan identifiers, dated schedules, weekly cash-flow ledgers, and comparison metrics.
- Principal outstanding, interest accrued and paid, arrears, unpaid essentials, projected recovery, and payoff date or a clear unpaid-at-horizon outcome.
- Recommendation status, including a no-feasible-plan result, with evidence references and reasons.
- Financial-condition assessment with evidence periods and uncertainty.
- Structured validation errors that the frontend can display.

All monetary fields use integer paise, dates use `YYYY-MM-DD`, and observed versus projected data must be distinguishable. Plan selection remains a local simulated action for this milestone.

## Git worktree plan

When implementation is authorized:

1. Initialize `Domino` as the repository and commit the shared plan and agreed contract as the common baseline.
2. Create branch `codex/backend` in a sibling worktree named `Domino-backend`.
3. Create branch `claude/frontend` in a sibling worktree named `Domino-frontend`.
4. Codex changes `backend/`; Claude changes `frontend/`. Coordinate changes to `contracts/`, this document, and other shared files.
5. Commit each side's work independently and integrate both branches into the main checkout after their checks pass.
6. Run the integrated frontend against the real backend and verify that mocks and real responses follow the same contract.

Worktrees contain the same repository on different branches. They are not separate repositories. No branches, commits, or worktrees have been created yet.

## Build sequence

1. Agree on the API contract and example responses, then establish the repository and separate worktrees.
2. Codex scaffolds the backend and defines the farmer fixture, loan assumptions, and calculation engine.
3. Claude scaffolds React, TypeScript, and Vite and builds the four-screen journey against the agreed mock responses.
4. Codex verifies cash conservation, interest, arrears, payment caps, deferred balances, and API validation with meaningful tests.
5. Connect the frontend to the backend, then verify scenario controls and local simulated persistence.
6. Add the irregular-income and deterioration cases and validate their distinct explanations.
7. Review desktop and mobile layouts, keyboard interaction, chart readability, and the full integrated demo flow.

## First milestone completion criteria

A lender can inspect one borrower, identify a repayment timing problem, compare alternatives, understand the recommended plan, and test a delayed-income scenario. Every displayed amount comes from the shared model. Principal, interest, and arrears reconcile; rescheduling cannot erase debt. Refreshing preserves the synthetic demo selection, and resetting restores the initial case.
