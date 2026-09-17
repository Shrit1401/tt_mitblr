import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const destination = resolve('.prototype-build');
await rm(destination, { recursive: true, force: true });
await mkdir(destination + '/app', { recursive: true });
// Explicit allowlist: no API, server service, engine, worker or database is copied.
for (const file of ['page.tsx', 'layout.tsx', 'globals.css'])
  await cp(`apps/web/app/${file}`, `${destination}/app/${file}`);
await cp('apps/web/app/fonts', `${destination}/app/fonts`, { recursive: true });
for (const dir of ['components', 'public'])
  await cp(`apps/web/${dir}`, `${destination}/${dir}`, { recursive: true });
await mkdir(destination + '/lib');
for (const file of [
  'demo.ts',
  'saved-evaluation.json',
  'saved-decline.json',
  'saved-borrower.json',
])
  await cp(`apps/web/lib/${file}`, `${destination}/lib/${file}`);
await cp('apps/web/tsconfig.json', `${destination}/tsconfig.json`);
await writeFile(`${destination}/package.json`, JSON.stringify({ private: true }));
await writeFile(
  `${destination}/next.config.mjs`,
  `export default { output: 'export', trailingSlash: true, devIndicators: false, images: { unoptimized: true }, basePath: ${JSON.stringify(process.env.PROTOTYPE_BASE_PATH || '')} };\n`,
);
const result = spawnSync(
  process.execPath,
  [resolve('node_modules/next/dist/bin/next'), 'build', destination],
  { stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } },
);
process.exit(result.status ?? 1);
