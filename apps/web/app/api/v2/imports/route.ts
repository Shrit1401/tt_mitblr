import { requireMember } from '@/lib/server/auth';
import { createImport } from '@/lib/server/imports';
import { importRequest } from '@domino/contracts';
import { json, errorResponse, readBoundedJson } from '@/lib/server/errors';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const member = await requireMember(request, 'import');
    const result = await createImport(
      member,
      importRequest.parse(await readBoundedJson(request, 1_048_576)),
      request.headers.get('idempotency-key'),
    );
    return json(result, 202, { Location: result.statusUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
