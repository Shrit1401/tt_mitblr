import { withTenant } from '@domino/db';
import { evaluationQueue, importQueue, tenants } from './queue.js';
export async function publishOutbox() {
  for (const tenantId of tenants) {
    await withTenant(tenantId, async (client) => {
      const rows = await client.query(
        'SELECT id,aggregate_id,kind FROM outbox WHERE tenant_id=$1 AND delivered_at IS NULL AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 25',
        [tenantId],
      );
      for (const row of rows.rows) {
        const queue = row.kind === 'evaluation' ? evaluationQueue : importQueue;
        const jobId = Buffer.from(`${tenantId}/${row.kind}/${row.aggregate_id}`).toString(
          'base64url',
        );
        const existing = await queue.getJob(jobId);
        if (existing && (await existing.getState()) === 'failed') {
          if (row.kind === 'evaluation')
            await client.query(
              "UPDATE evaluations SET status='failed',stage='failed',error_code='RETRIES_EXHAUSTED',lease_until=NULL WHERE tenant_id=$1 AND id=$2 AND status<>'complete' AND (lease_until IS NULL OR lease_until<now())",
              [tenantId, row.aggregate_id],
            );
          else
            await client.query(
              "UPDATE imports SET status='failed',report=$3 WHERE tenant_id=$1 AND id=$2 AND status='queued'",
              [tenantId, row.aggregate_id, JSON.stringify({ errorCode: 'RETRIES_EXHAUSTED' })],
            );
          await client.query(
            'UPDATE outbox SET delivered_at=now(),attempts=attempts+1 WHERE tenant_id=$1 AND id=$2',
            [tenantId, row.id],
          );
          continue;
        }
        await queue.add(
          row.kind,
          { tenantId, id: row.aggregate_id },
          {
            jobId,
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000, jitter: 0.5 },
            removeOnComplete: 500,
            removeOnFail: 1000,
          },
        );
        await client.query(
          'UPDATE outbox SET delivered_at=now(),attempts=attempts+1 WHERE tenant_id=$1 AND id=$2',
          [tenantId, row.id],
        );
      }
    });
  }
}
