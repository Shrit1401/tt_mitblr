import { requireMember } from '@/lib/server/auth';
import { listBorrowers } from '@/lib/server/evaluations';
import { json, errorResponse, paging } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const member = await requireMember(request, 'read');
    return json(
      await listBorrowers(
        member,
        paging(request).limit,
        new URL(request.url).searchParams.get('cursor'),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
