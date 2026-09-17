import 'server-only';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function readBoundedJson(request: Request, maxBytes = 65_536): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json'
  )
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json.');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(declared) || declared < 0)
    throw new HttpError(400, 'INVALID_INPUT', 'Invalid body length.');
  if (declared > maxBytes)
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_JSON', 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}
export function json(body: unknown, status = 200, extra?: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
}
export function errorResponse(error: unknown, requestId = randomUUID()) {
  const known =
    error instanceof HttpError
      ? error
      : error instanceof ZodError
        ? new HttpError(400, 'INVALID_INPUT', 'Input does not match the contract.')
        : new HttpError(
            503,
            'TEMPORARILY_UNAVAILABLE',
            'The service could not complete this request.',
          );
  return json(
    {
      error: {
        code: known.code,
        message: known.message,
        requestId,
        ...(error instanceof ZodError
          ? { fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }
          : {}),
      },
    },
    known.status,
    { 'X-Request-ID': requestId },
  );
}
export function paging(request: Request) {
  const search = new URL(request.url).searchParams;
  const limit = Number(search.get('limit') ?? 25),
    offset = Number(search.get('offset') ?? 0);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    throw new HttpError(400, 'INVALID_INPUT', 'Invalid pagination.');
  return { limit, offset };
}
