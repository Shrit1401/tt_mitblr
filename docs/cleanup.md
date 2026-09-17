# Repository consolidation

The published project has one frontend, one shared calculation package, and a separate worker. The old single-file HTML prototypes, duplicated prototype tests, bundled ZIP, and superseded design notes were removed from the active repository. Original local files were preserved in a sibling archive before removal.

The original engine source and its model regression references are retained in `packages/engine`. Its existing saved demonstration responses are retained in `apps/web/lib`. The former custom Node HTTP wrapper is replaced by Next.js Route Handler source. Backend regression references were not executed.

Presentation build caches, chart snapshots, generated test output, installed packages, nested legacy projects, local credentials, third-party source PDFs and raw household records are excluded from publication. Public research analysis source, attributed aggregate tables, source hashes and methodology remain available. Read the data README for reproducibility boundaries.

The frontend shares presentation utilities and fixtures across its views. Font assets are self-hosted with their original SIL Open Font License notices. The static build uses a strict copy allowlist so API and worker code cannot enter the prototype build.
