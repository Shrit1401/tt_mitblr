import { withTenant } from '@domino/db';
import { contentHash, normalizeTransactions } from '@domino/data';
import type { JobReference } from './queue.js';
export async function importJob({ tenantId, id }: JobReference) {
  return withTenant(tenantId, async (client) => {
    const result = await client.query(
      'SELECT * FROM imports WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
      [tenantId, id],
    );
    const row = result.rows[0];
    if (!row || row.status === 'complete') return;
    const validated = normalizeTransactions(row.records);
    let inserted = 0,
      duplicates = 0;
    const conflicts: string[] = [];
    for (const record of validated.records) {
      const prior = await client.query(
        'SELECT record FROM transactions WHERE tenant_id=$1 AND borrower_id=$2 AND source_id=$3 AND source_key=$4',
        [tenantId, row.borrower_id, row.source_id, record.sourceKey],
      );
      if (prior.rows[0]) {
        if (contentHash(prior.rows[0].record) === contentHash(record)) duplicates++;
        else conflicts.push(record.sourceKey);
        continue;
      }
      await client.query(
        'INSERT INTO transactions(tenant_id,borrower_id,source_id,source_key,occurred_on,amount_paise,kind,record,import_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          tenantId,
          row.borrower_id,
          row.source_id,
          record.sourceKey,
          record.date,
          record.amountPaise,
          record.type,
          JSON.stringify(record),
          id,
        ],
      );
      inserted++;
    }
    await client.query(
      "UPDATE imports SET status='complete',report=$3 WHERE tenant_id=$1 AND id=$2",
      [
        tenantId,
        id,
        JSON.stringify({
          inserted,
          duplicates,
          rejected: validated.rejected,
          conflicts,
          snapshotUpdated: false,
          note: 'Imported events are retained as evidence. Reconciliation and a new approved cash-flow snapshot are required before evaluation.',
        }),
      ],
    );
  });
}
