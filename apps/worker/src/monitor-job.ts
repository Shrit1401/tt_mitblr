import { withTenant } from '@domino/db';
import { tenants } from './queue.js';
/** Recovery of persisted work after queue loss. This does not monitor borrower outcomes. */
export async function recoverQueueIntents() {
  for (const tenantId of tenants) {
    await withTenant(tenantId, async (client) => {
      await client.query(
        "UPDATE outbox o SET delivered_at=NULL,available_at=now() FROM evaluations e WHERE o.tenant_id=$1 AND e.tenant_id=o.tenant_id AND e.id=o.aggregate_id AND o.kind='evaluation' AND o.delivered_at<now()-interval '5 minutes' AND (e.status='queued' OR (e.status='running' AND e.lease_until<now()))",
        [tenantId],
      );
      await client.query(
        "UPDATE outbox o SET delivered_at=NULL,available_at=now() FROM imports i WHERE o.tenant_id=$1 AND i.tenant_id=o.tenant_id AND i.id=o.aggregate_id AND o.kind='import' AND o.delivered_at<now()-interval '5 minutes' AND i.status='queued'",
        [tenantId],
      );
    });
  }
}
