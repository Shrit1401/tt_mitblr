import { randomUUID } from 'node:crypto';
import { withTenant } from '@domino/db';
import { contentHash } from '@domino/data';
import { evaluateRequestV2, operationalSnapshot, policySchema } from '@domino/contracts';
import { evaluateV2, ENGINE_VERSION } from '@domino/engine';
import { optimize } from './optimizer-client.js';
import type { JobReference } from './queue.js';
export async function evaluateJob({ tenantId, id }: JobReference) {
  const token = randomUUID();
  const input = await withTenant(tenantId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tenantId]);
    const result = await client.query(
      'SELECT e.*,s.body AS snapshot,p.policy FROM evaluations e JOIN snapshots s ON s.tenant_id=e.tenant_id AND s.id=e.snapshot_id JOIN policies p ON p.tenant_id=e.tenant_id AND p.id=e.policy_id WHERE e.tenant_id=$1 AND e.id=$2 FOR UPDATE OF e',
      [tenantId, id],
    );
    const row = result.rows[0];
    if (!row || row.status === 'complete') return null;
    if (row.engine_version !== ENGINE_VERSION) throw new Error('ENGINE_VERSION_UNAVAILABLE');
    if (row.status === 'running' && row.lease_until && new Date(row.lease_until) > new Date())
      throw new Error('EVALUATION_LEASE_BUSY');
    const active = await client.query(
      "SELECT count(*)::integer AS count FROM evaluations WHERE tenant_id=$1 AND status='running' AND lease_until>now()",
      [tenantId],
    );
    if (active.rows[0].count >= 2) throw new Error('TENANT_CONCURRENCY_LIMIT');
    await client.query(
      "UPDATE evaluations SET status='running',stage='scenario_replay',lease_until=now()+interval '60 seconds',attempt_token=$3,error_code=NULL WHERE tenant_id=$1 AND id=$2",
      [tenantId, id, token],
    );
    return row;
  });
  if (!input) return;
  try {
    const snapshot = operationalSnapshot.parse(input.snapshot),
      policy = policySchema.parse(input.policy),
      request = evaluateRequestV2.parse(input.request);
    let result = evaluateV2(snapshot, policy, request);
    if (request.requestedCandidates.includes('robust_optimized')) {
      const optimized = await optimize(snapshot, policy, request);
      if (optimized.schedule) {
        try {
          result = evaluateV2(snapshot, policy, request, {
            schedule: optimized.schedule,
            metadata: optimized.metadata,
          });
          if (!result.candidates.find((c) => c.id === 'robust_optimized')?.feasible)
            result.solver = {
              status: 'MODEL_INVALID',
              optimalityProved: false,
              reason: 'Independent ledger rejected the returned candidate.',
            };
        } catch {
          result.solver = {
            status: 'MODEL_INVALID',
            optimalityProved: false,
            reason: 'Independent ledger rejected the returned schedule.',
          };
        }
      } else result.solver = optimized.metadata;
    }
    await withTenant(tenantId, async (client) => {
      const claim = await client.query(
        'SELECT status,attempt_token FROM evaluations WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
        [tenantId, id],
      );
      if (claim.rows[0]?.status === 'complete') return;
      if (claim.rows[0]?.attempt_token !== token) throw new Error('STALE_WORKER_LEASE');
      const summary = {
        ...result,
        candidates: result.candidates.map((c) => ({
          ...c,
          scenarios: c.scenarios.map(({ ledger, ...scenario }) => ({
            ...scenario,
            ledgerRows: ledger.length,
          })),
        })),
      };
      await client.query(
        'INSERT INTO evaluation_results(tenant_id,evaluation_id,body) VALUES($1,$2,$3)',
        [tenantId, id, JSON.stringify(summary)],
      );
      for (const candidate of result.candidates) {
        await client.query(
          'INSERT INTO candidate_plans(tenant_id,evaluation_id,plan_id,feasible,schedule,summary) VALUES($1,$2,$3,$4,$5,$6)',
          [
            tenantId,
            id,
            candidate.id,
            candidate.feasible,
            JSON.stringify(candidate.schedule),
            JSON.stringify(summary.candidates.find((c) => c.id === candidate.id)),
          ],
        );
        for (const scenario of candidate.scenarios)
          await client.query(
            'INSERT INTO plan_ledgers(tenant_id,evaluation_id,plan_id,scenario_id,rows) VALUES($1,$2,$3,$4,$5)',
            [tenantId, id, candidate.id, scenario.scenarioId, JSON.stringify(scenario.ledger)],
          );
      }
      await client.query(
        "UPDATE evaluations SET status='complete',stage='complete',completed_at=now(),result_hash=$3,lease_until=NULL WHERE tenant_id=$1 AND id=$2 AND attempt_token=$4",
        [tenantId, id, contentHash(result), token],
      );
    });
  } catch (error) {
    await withTenant(tenantId, async (client) => {
      await client.query(
        "UPDATE evaluations SET status='queued',stage='retry_pending',lease_until=NULL,error_code=$4 WHERE tenant_id=$1 AND id=$2 AND attempt_token=$3 AND status<>'complete'",
        [
          tenantId,
          id,
          token,
          error instanceof Error && error.message === 'INSUFFICIENT_DATA'
            ? 'INSUFFICIENT_DATA'
            : 'WORKER_ERROR',
        ],
      );
    });
    throw error;
  }
}
