import { Queue } from 'bullmq';
if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required.');
const url = new URL(process.env.REDIS_URL);
if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('Unsupported Redis protocol.');
export const connection = {
  host: url.hostname,
  port: Number(url.port || 6379),
  username: url.username ? decodeURIComponent(url.username) : undefined,
  password: url.password ? decodeURIComponent(url.password) : undefined,
  db: Number(url.pathname.slice(1) || 0),
  ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
};
export const evaluationQueue = new Queue('domino-evaluation', { connection });
export const importQueue = new Queue('domino-import', { connection });
export interface JobReference {
  tenantId: string;
  id: string;
}
export const tenants = (process.env.WORKER_TENANT_IDS ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
if (!tenants.length) throw new Error('WORKER_TENANT_IDS must explicitly list authorized tenants.');
