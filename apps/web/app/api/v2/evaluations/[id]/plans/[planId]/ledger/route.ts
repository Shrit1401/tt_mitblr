import { requireMember } from '@/lib/server/auth';
import { withTenant } from '@domino/db';
import { id, candidateId } from '@domino/contracts';
import { json, errorResponse, HttpError, paging } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; planId: string }> },
) {
  try {
    const member = await requireMember(request, 'read'),
      params = await context.params,
      page = paging(request),
      scenarioId = id.parse(new URL(request.url).searchParams.get('scenarioId') ?? 'baseline');
    const result = await withTenant(member.tenantId, async (client) => {
      const result = await client.query(
        'SELECT rows FROM plan_ledgers WHERE tenant_id=$1 AND evaluation_id=$2 AND plan_id=$3 AND scenario_id=$4',
        [member.tenantId, id.parse(params.id), candidateId.parse(params.planId), scenarioId],
      );
      if (!result.rows[0]) throw new HttpError(404, 'LEDGER_NOT_FOUND', 'Ledger not found.');
      const rows = result.rows[0].rows;
      return {
        evaluationId: params.id,
        planId: params.planId,
        scenarioId,
        rows: rows.slice(page.offset, page.offset + page.limit),
        nextOffset: page.offset + page.limit < rows.length ? page.offset + page.limit : null,
      };
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
