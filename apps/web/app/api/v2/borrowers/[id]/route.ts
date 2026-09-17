import { requireMember } from '@/lib/server/auth';
import { getBorrower } from '@/lib/server/evaluations';
import { id } from '@domino/contracts';
import { json, errorResponse, paging } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireMember(request, 'read'),
      params = await context.params,
      page = paging(request);
    return json(await getBorrower(member, id.parse(params.id), page.limit, page.offset));
  } catch (error) {
    return errorResponse(error);
  }
}
