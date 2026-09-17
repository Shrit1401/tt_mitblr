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
          'SELECT id,borrower_id,source_id,status,report,created_at FROM imports WHERE tenant_id=$1 AND id=$2',
          [member.tenantId, id.parse(params.id)],
        );
        if (!result.rows[0]) throw new HttpError(404, 'IMPORT_NOT_FOUND', 'Import not found.');
        return result.rows[0];
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
