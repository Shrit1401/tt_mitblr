import { requireMember } from '@/lib/server/auth';
import { withTenant } from '@domino/db';
import { id } from '@domino/contracts';
import { json, errorResponse, HttpError } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireMember(request, 'read'),
      params = await context.params;
    return json(
      await withTenant(member.tenantId, async (client) => {
        const result = await client.query(
          "SELECT id,kind,publisher,reference_period,geography,units,access_terms,CASE WHEN kind IN ('public_aggregate','public_microdata') THEN public_url ELSE NULL END AS public_url,checksum,retrieved_at FROM sources WHERE tenant_id=$1 AND id=$2",
          [member.tenantId, id.parse(params.id)],
        );
        if (!result.rows[0]) throw new HttpError(404, 'SOURCE_NOT_FOUND', 'Source not found.');
        return result.rows[0];
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
