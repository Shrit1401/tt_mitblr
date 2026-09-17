import 'server-only';
import { createHash } from 'node:crypto';
import { database } from '@domino/db';
import { HttpError } from './errors';
export interface Member {
  tenantId: string;
  userId: string;
  role: 'viewer' | 'reviewer' | 'approver' | 'admin';
}
export type Permission = 'read' | 'evaluate' | 'import' | 'select' | 'approve';
const permissions: Record<Member['role'], Permission[]> = {
  viewer: ['read'],
  reviewer: ['read', 'evaluate', 'import', 'select'],
  approver: ['read', 'evaluate', 'import', 'select', 'approve'],
  admin: ['read', 'evaluate', 'import', 'select', 'approve'],
};
/** Only high entropy server-issued bearer sessions are accepted. No tenant headers or demo bypass. */
export async function requireMember(request: Request, permission: Permission): Promise<Member> {
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer [A-Za-z0-9_-]{43,200}$/.test(authorization))
    throw new HttpError(401, 'UNAUTHENTICATED', 'A valid bearer session is required.');
  const digest = createHash('sha256').update(authorization.slice(7)).digest('hex');
  const result = await database().query<{
    tenant_id: string;
    user_id: string;
    role: Member['role'];
  }>('SELECT * FROM resolve_session($1)', [digest]);
  const row = result.rows[0];
  if (!row) throw new HttpError(401, 'UNAUTHENTICATED', 'Session is invalid or expired.');
  if (!permissions[row.role]?.includes(permission))
    throw new HttpError(403, 'FORBIDDEN', 'Your role cannot perform this action.');
  // Cookie authentication is deliberately unsupported, so ambient browser credentials cannot mutate state.
  return { tenantId: row.tenant_id, userId: row.user_id, role: row.role };
}
