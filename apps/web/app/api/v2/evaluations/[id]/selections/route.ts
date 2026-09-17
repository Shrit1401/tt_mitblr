import { requireMember } from '@/lib/server/auth';
import { selectPlan } from '@/lib/server/selections';
import { id, selectionRequest } from '@domino/contracts';
import { json, errorResponse, readBoundedJson } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireMember(request, 'select'),
      params = await context.params;
    return json(
      await selectPlan(
        member,
        id.parse(params.id),
        selectionRequest.parse(await readBoundedJson(request)),
      ),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
