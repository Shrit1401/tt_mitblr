import { borrowers } from '@domino/engine/fixtures';
import { evaluate } from '@domino/engine/legacy';
import { legacyScenario } from '@domino/contracts';
import { requireMember } from '@/lib/server/auth';
import { json, errorResponse, HttpError, readBoundedJson } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireMember(request, 'evaluate');
    const { id } = await context.params;
    const borrower = borrowers.find((b) => b.id === id);
    if (!borrower) throw new HttpError(404, 'BORROWER_NOT_FOUND', 'Borrower not found.');
    return json(evaluate(borrower, legacyScenario.parse(await readBoundedJson(request))));
  } catch (error) {
    return errorResponse(error);
  }
}
