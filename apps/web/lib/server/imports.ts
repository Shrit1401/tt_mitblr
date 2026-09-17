import 'server-only';
import { randomUUID } from 'node:crypto';
import { withTenant } from '@domino/db';
import { contentHash } from '@domino/data';
import type { z } from 'zod';
import type { importRequest } from '@domino/contracts';
import type { Member } from './auth';
import { HttpError } from './errors';
import { audit } from './evaluations';
export async function createImport(
  member: Member,
  request: z.infer<typeof importRequest>,
  key: string | null,
) {
  if (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
    throw new HttpError(400, 'INVALID_INPUT', 'A 16 to 128 character Idempotency-Key is required.');
  return withTenant(member.tenantId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [member.tenantId]);
    const hash = contentHash(request),
      route = '/api/v2/imports';
    const prior = await client.query(
      'SELECT request_hash,response FROM idempotency_keys WHERE tenant_id=$1 AND route=$2 AND key=$3',
      [member.tenantId, route, key],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].request_hash !== hash)
        throw new HttpError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key conflicts with earlier input.',
        );
      return prior.rows[0].response;
    }
    const quota = await client.query(
      "SELECT count(*)::integer AS count FROM imports WHERE tenant_id=$1 AND created_at>now()-interval '1 minute'",
      [member.tenantId],
    );
    if (quota.rows[0].count >= 10)
      throw new HttpError(429, 'RATE_LIMITED', 'Tenant import quota reached.');
    const borrower = await client.query('SELECT id FROM borrowers WHERE tenant_id=$1 AND id=$2', [
      member.tenantId,
      request.borrowerId,
    ]);
    if (!borrower.rows[0]) throw new HttpError(404, 'BORROWER_NOT_FOUND', 'Borrower not found.');
    const source = await client.query('SELECT kind FROM sources WHERE tenant_id=$1 AND id=$2', [
      member.tenantId,
      request.sourceId,
    ]);
    if (!source.rows[0] || source.rows[0].kind !== 'borrower_observation')
      throw new HttpError(
        422,
        'INVALID_SOURCE_KIND',
        'Operational imports require a borrower-observation source. Public research belongs in a separate dataset.',
      );
    const importId = randomUUID(),
      response = {
        importId,
        status: 'queued',
        statusUrl: `/api/v2/imports/${importId}`,
        rowsReceived: request.records.length,
      };
    await client.query(
      'INSERT INTO imports(tenant_id,id,borrower_id,source_id,consent_reference,request_hash,records) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        member.tenantId,
        importId,
        request.borrowerId,
        request.sourceId,
        request.consentReference,
        hash,
        JSON.stringify(request.records),
      ],
    );
    await client.query(
      "INSERT INTO outbox(tenant_id,id,aggregate_id,kind) VALUES($1,$2,$3,'import')",
      [member.tenantId, randomUUID(), importId],
    );
    await client.query(
      'INSERT INTO idempotency_keys(tenant_id,route,key,request_hash,response) VALUES($1,$2,$3,$4,$5)',
      [member.tenantId, route, key, hash, JSON.stringify(response)],
    );
    await audit(client, member, 'import.requested', importId, {
      rows: request.records.length,
      sourceId: request.sourceId,
    });
    return response;
  });
}
