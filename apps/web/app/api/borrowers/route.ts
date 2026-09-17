import { borrowers } from '@domino/engine/fixtures';
import { requireMember } from '@/lib/server/auth';
import { json, errorResponse } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    await requireMember(request, 'read');
    return json({
      borrowers: borrowers.map(({ id, name, occupation, pattern, synthetic }) => ({
        id,
        name,
        occupation,
        pattern,
        synthetic,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
