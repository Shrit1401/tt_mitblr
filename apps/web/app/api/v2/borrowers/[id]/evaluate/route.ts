import { requireMember } from '@/lib/server/auth';
import { requestEvaluation } from '@/lib/server/evaluations';
import { evaluateRequestV2, id } from '@domino/contracts';
import { json, errorResponse, readBoundedJson } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const member = await requireMember(request, 'evaluate'),
      params = await context.params,
      body = evaluateRequestV2.parse(await readBoundedJson(request));
    const result = await requestEvaluation(
      member,
      id.parse(params.id),
      body,
      request.headers.get('idempotency-key'),
    );
    return json(result, 202, { Location: result.statusUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
