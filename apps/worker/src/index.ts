import { Worker } from 'bullmq';
import { withTenant, database } from '@domino/db';
import { connection, tenants, evaluationQueue, importQueue, type JobReference } from './queue.js';
import { publishOutbox } from './outbox-publisher.js';
import { recoverQueueIntents } from './monitor-job.js';
import { evaluateJob } from './evaluate-job.js';
import { importJob } from './import-job.js';
const authorized = (data: JobReference) => {
  if (!tenants.includes(data.tenantId) || typeof data.id !== 'string')
    throw new Error('UNAUTHORIZED_JOB_TENANT');
};
const evaluations = new Worker<JobReference>(
  'domino-evaluation',
  async (job) => {
    authorized(job.data);
    await evaluateJob(job.data);
  },
  { connection, concurrency: 2, lockDuration: 90_000, maxStalledCount: 2 },
);
const imports = new Worker<JobReference>(
  'domino-import',
  async (job) => {
    authorized(job.data);
    await importJob(job.data);
  },
  { connection, concurrency: 1 },
);
evaluations.on('failed', (job, error) => {
  if (!job || !tenants.includes(job.data.tenantId)) return;
  const final = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (!final) return;
  void withTenant(job.data.tenantId, async (client) => {
    await client.query(
      "UPDATE evaluations SET status=$3,stage=$3,error_code=$4,lease_until=NULL WHERE tenant_id=$1 AND id=$2 AND status='queued'",
      [
        job.data.tenantId,
        job.data.id,
        'failed',
        error.message === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : 'WORKER_ERROR',
      ],
    );
  }).catch(() => {});
});
imports.on('failed', (job) => {
  if (!job || !tenants.includes(job.data.tenantId) || job.attemptsMade < (job.opts.attempts ?? 1))
    return;
  void withTenant(job.data.tenantId, async (client) => {
    await client.query(
      "UPDATE imports SET status='failed',report=$3 WHERE tenant_id=$1 AND id=$2 AND status<>'complete'",
      [job.data.tenantId, job.data.id, JSON.stringify({ errorCode: 'IMPORT_WORKER_ERROR' })],
    );
  }).catch(() => {});
});
for (const worker of [evaluations, imports])
  worker.on('error', () =>
    process.stderr.write(JSON.stringify({ event: 'worker.connection_error' }) + '\n'),
  );
let stopping = false;
async function loop() {
  while (!stopping) {
    try {
      await recoverQueueIntents();
      await publishOutbox();
    } catch {
      process.stderr.write(JSON.stringify({ event: 'outbox.retry' }) + '\n');
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
const running = loop();
async function shutdown() {
  stopping = true;
  await Promise.all([evaluations.close(), imports.close(), running]);
  await Promise.all([evaluationQueue.close(), importQueue.close()]);
  await database().end();
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
