import { borrowers } from '@domino/engine/fixtures';
import { requireMember } from '@/lib/server/auth';
import { json, errorResponse, HttpError } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireMember(request, 'read');
    const { id } = await context.params;
    const borrower = borrowers.find((b) => b.id === id);
    if (!borrower) throw new HttpError(404, 'BORROWER_NOT_FOUND', 'Borrower not found.');
    return json({ borrower });
  } catch (error) {
    return errorResponse(error);
  }
}
