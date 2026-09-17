import { requireMember } from '@/lib/server/auth';
import { approveSelection } from '@/lib/server/selections';
import { id, approvalRequest } from '@domino/contracts';
import { json, errorResponse, readBoundedJson } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireMember(request, 'approve'),
      params = await context.params;
    return json(
      await approveSelection(
        member,
        id.parse(params.id),
        approvalRequest.parse(await readBoundedJson(request)),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
