import 'server-only';
import { randomUUID } from 'node:crypto';
import { withTenant, type PoolClient } from '@domino/db';
import { contentHash } from '@domino/data';
import { operationalSnapshot, policySchema, type EvaluateRequestV2 } from '@domino/contracts';
import { ENGINE_VERSION } from '@domino/engine';
import { HttpError } from './errors';
import type { Member } from './auth';
export async function audit(
  client: PoolClient,
  member: Member,
  action: string,
  recordId: string,
  summary: Record<string, unknown>,
) {
  await client.query(
    'INSERT INTO audit_events(tenant_id,id,actor_id,action,record_id,request_id,summary) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [
      member.tenantId,
      randomUUID(),
      member.userId,
      action,
      recordId,
      randomUUID(),
      JSON.stringify(summary),
    ],
  );
}
export async function requestEvaluation(
  member: Member,
  borrowerId: string,
  request: EvaluateRequestV2,
  idempotencyKey: string | null,
) {
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey))
    throw new HttpError(
      400,
      'INVALID_INPUT',
      'Supply an Idempotency-Key with 16 to 128 letters, digits, underscores or hyphens.',
    );
  const route = `/api/v2/borrowers/${borrowerId}/evaluate`,
    requestHash = contentHash(request);
  return withTenant(member.tenantId, async (client) => {
    // Serialize quota and duplicate-request decisions within a tenant, including across app instances.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [member.tenantId]);
    const prior = await client.query(
      'SELECT request_hash,response FROM idempotency_keys WHERE tenant_id=$1 AND route=$2 AND key=$3',
      [member.tenantId, route, idempotencyKey],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].request_hash !== requestHash)
        throw new HttpError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'This idempotency key was used with different input.',
        );
      return prior.rows[0].response;
    }
    const quota = await client.query(
      "SELECT count(*)::integer AS count FROM evaluations WHERE tenant_id=$1 AND created_at>now()-interval '1 minute'",
      [member.tenantId],
    );
    if (quota.rows[0].count >= 30)
      throw new HttpError(
        429,
        'RATE_LIMITED',
        'Tenant evaluation quota reached. Try again shortly.',
      );
    const borrower = await client.query(
      'SELECT * FROM borrowers WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
      [member.tenantId, borrowerId],
    );
    if (!borrower.rows[0]) throw new HttpError(404, 'BORROWER_NOT_FOUND', 'Borrower not found.');
    if (borrower.rows[0].loan_version !== request.loanVersion)
      throw new HttpError(
        409,
        'STALE_LOAN_VERSION',
        'Loan terms changed. Refresh and evaluate again.',
      );
    const loan = await client.query(
      'SELECT snapshot FROM loan_snapshots WHERE tenant_id=$1 AND borrower_id=$2 AND version=$3',
      [member.tenantId, borrowerId, request.loanVersion],
    );
    if (!loan.rows[0])
      throw new HttpError(
        422,
        'INSUFFICIENT_DATA',
        'An immutable loan and cash-flow snapshot is required.',
      );
    const snapshot = operationalSnapshot.parse(loan.rows[0].snapshot);
    if (snapshot.borrowerId !== borrowerId || snapshot.loanVersion !== request.loanVersion)
      throw new HttpError(422, 'INSUFFICIENT_DATA', 'Snapshot identity does not match the loan.');
    const policyRow = await client.query(
      'SELECT policy FROM policies WHERE tenant_id=$1 AND id=$2',
      [member.tenantId, request.policyVersionId],
    );
    if (!policyRow.rows[0])
      throw new HttpError(404, 'POLICY_NOT_FOUND', 'Policy version not found.');
    const policy = policySchema.parse(policyRow.rows[0].policy);
    if (
      policy.id !== request.policyVersionId ||
      snapshot.termWeeks > policy.maximumTermWeeks ||
      !policy.allowedPaymentWeeks.includes(snapshot.termWeeks)
    )
      throw new HttpError(422, 'POLICY_MISMATCH', 'Loan maturity does not fit this policy.');
    const snapshotId = randomUUID(),
      evaluationId = randomUUID();
    const body = {
      contractVersion: '2.0',
      evaluationId,
      status: 'queued',
      statusUrl: `/api/v2/evaluations/${evaluationId}`,
      snapshotId,
      loanVersion: request.loanVersion,
    };
    await client.query(
      'INSERT INTO snapshots(tenant_id,id,borrower_id,loan_version,content_hash,body) VALUES($1,$2,$3,$4,$5,$6)',
      [
        member.tenantId,
        snapshotId,
        borrowerId,
        request.loanVersion,
        contentHash(snapshot),
        JSON.stringify(snapshot),
      ],
    );
    await client.query(
      'INSERT INTO evaluations(tenant_id,id,borrower_id,snapshot_id,policy_id,loan_version,request,engine_version,scenario_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        member.tenantId,
        evaluationId,
        borrowerId,
        snapshotId,
        request.policyVersionId,
        request.loanVersion,
        JSON.stringify(request),
        ENGINE_VERSION,
        contentHash({ id: request.scenarioSetId, assumptions: request.assumptions }),
      ],
    );
    await client.query(
      "INSERT INTO outbox(tenant_id,id,aggregate_id,kind) VALUES($1,$2,$3,'evaluation')",
      [member.tenantId, randomUUID(), evaluationId],
    );
    await client.query(
      'INSERT INTO idempotency_keys(tenant_id,route,key,request_hash,response) VALUES($1,$2,$3,$4,$5)',
      [member.tenantId, route, idempotencyKey, requestHash, JSON.stringify(body)],
    );
    await audit(client, member, 'evaluation.requested', evaluationId, {
      loanVersion: request.loanVersion,
      snapshotId,
    });
    return body;
  });
}
export async function getEvaluation(member: Member, id: string) {
  return withTenant(member.tenantId, async (client) => {
    const response = await client.query(
      'SELECT e.id,e.borrower_id,e.snapshot_id,e.loan_version,e.engine_version,e.status,e.stage,e.error_code,e.created_at,e.completed_at,e.result_hash,r.body AS result FROM evaluations e LEFT JOIN evaluation_results r ON r.tenant_id=e.tenant_id AND r.evaluation_id=e.id WHERE e.tenant_id=$1 AND e.id=$2',
      [member.tenantId, id],
    );
    if (!response.rows[0])
      throw new HttpError(404, 'EVALUATION_NOT_FOUND', 'Evaluation not found.');
    return response.rows[0];
  });
}
export async function listBorrowers(member: Member, limit: number, cursor: string | null) {
  return withTenant(member.tenantId, async (client) => {
    let after: { updatedAt: string; id: string } | null = null;
    if (cursor) {
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (
          !after ||
          typeof after.updatedAt !== 'string' ||
          Number.isNaN(Date.parse(after.updatedAt)) ||
          typeof after.id !== 'string' ||
          after.id.length > 100
        )
          throw new Error();
      } catch {
        throw new HttpError(400, 'INVALID_INPUT', 'Invalid borrower cursor.');
      }
    }
    const result = await client.query(
      'SELECT id,display_name,occupation,currency,source_kind,loan_version,updated_at FROM borrowers WHERE tenant_id=$1 AND ($2::timestamptz IS NULL OR (updated_at,id)<($2::timestamptz,$3)) ORDER BY updated_at DESC,id DESC LIMIT $4',
      [member.tenantId, after?.updatedAt ?? null, after?.id ?? null, limit + 1],
    );
    const hasNext = result.rows.length > limit,
      rows = result.rows.slice(0, limit),
      last = rows.at(-1);
    return {
      borrowers: rows,
      nextCursor:
        hasNext && last
          ? Buffer.from(
              JSON.stringify({ updatedAt: last.updated_at.toISOString(), id: last.id }),
            ).toString('base64url')
          : null,
    };
  });
}
export async function getBorrower(member: Member, id: string, limit: number, offset: number) {
  return withTenant(member.tenantId, async (client) => {
    const result = await client.query(
      'SELECT b.*,l.snapshot FROM borrowers b LEFT JOIN loan_snapshots l ON l.tenant_id=b.tenant_id AND l.borrower_id=b.id AND l.version=b.loan_version WHERE b.tenant_id=$1 AND b.id=$2',
      [member.tenantId, id],
    );
    if (!result.rows[0]) throw new HttpError(404, 'BORROWER_NOT_FOUND', 'Borrower not found.');
    const { snapshot, ...borrower } = result.rows[0];
    if (!snapshot)
      return { borrower, loan: null, history: [], dataQuality: { status: 'insufficient_data' } };
    const { history, ...loan } = snapshot;
    return {
      borrower,
      loan,
      history: history.slice(offset, offset + limit),
      nextOffset: offset + limit < history.length ? offset + limit : null,
      dataQuality: {
        status: history.some((r: { incomePaise: unknown }) => r.incomePaise === null)
          ? 'missing_periods'
          : 'not_assessed',
      },
    };
  });
}
