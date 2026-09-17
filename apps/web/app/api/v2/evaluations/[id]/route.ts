import { requireMember } from '@/lib/server/auth';
import { getEvaluation } from '@/lib/server/evaluations';
import { id } from '@domino/contracts';
import { json, errorResponse } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireMember(request, 'read'),
      params = await context.params;
    return json(await getEvaluation(member, id.parse(params.id)));
  } catch (error) {
    return errorResponse(error);
  }
}
