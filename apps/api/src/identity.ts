import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { verify, hash, argon2id } from 'argon2';
import { tenantTransaction } from './db.js';
import { hashToken, signToken, tokenTenant } from './security.js';
export class DomainError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface Actor {
  tenantId: string;
  id: string;
  name: string;
  admin: boolean;
}
interface Membership {
  id: string;
  display_name: string;
  main_admin: boolean;
  password_hash: string;
}
export const passwordHash = (password: string) =>
  hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
export async function audit(
  db: PoolClient,
  actor: Actor,
  action: string,
  target: string | null = null,
) {
  await db.query(
    'INSERT INTO audit_events(tenant_id,id,actor_id,action,target_id) VALUES($1,$2,$3,$4,$5)',
    [actor.tenantId, randomUUID(), actor.id, action, target],
  );
}
export async function login(
  pool: Pool,
  slug: string,
  email: string,
  password: string,
  secret: string,
) {
  const tenants = await pool.query<{ id: string | null }>('SELECT resolve_tenant($1) AS id', [
    slug,
  ]);
  const tenantId = tenants.rows[0]?.id;
  if (!tenantId) throw new DomainError(401, 'INVALID_LOGIN', 'Invalid sign-in details');
  return tenantTransaction(pool, tenantId, async (db) => {
    const users = await db.query<Membership>(
      'SELECT id,display_name,main_admin,password_hash FROM memberships WHERE tenant_id=$1 AND email=$2 AND active=true FOR SHARE',
      [tenantId, email],
    );
    const user = users.rows[0];
    if (!user || !(await verify(user.password_hash, password)))
      throw new DomainError(401, 'INVALID_LOGIN', 'Invalid sign-in details');
    const actor: Actor = { tenantId, id: user.id, name: user.display_name, admin: user.main_admin };
    const token = signToken(tenantId, secret);
    await db.query(
      "INSERT INTO sessions(tenant_id,id,membership_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '8 hours')",
      [tenantId, randomUUID(), user.id, hashToken(token)],
    );
    await audit(db, actor, 'session.login');
    return { actor, token };
  });
}
export async function withActor<T>(
  pool: Pool,
  token: string,
  secret: string,
  work: (db: PoolClient, actor: Actor) => Promise<T>,
): Promise<T> {
  const tenantId = tokenTenant(token, secret);
  if (!tenantId) throw new DomainError(401, 'UNAUTHENTICATED', 'Sign in to continue');
  return tenantTransaction(pool, tenantId, async (db) => {
    const result = await db.query<{ id: string; display_name: string; main_admin: boolean }>(
      `SELECT m.id,m.display_name,m.main_admin FROM sessions s JOIN memberships m ON m.tenant_id=s.tenant_id AND m.id=s.membership_id WHERE s.tenant_id=$1 AND s.token_hash=$2 AND s.expires_at>now() AND m.active=true FOR SHARE OF m`,
      [tenantId, hashToken(token)],
    );
    const user = result.rows[0];
    if (!user)
      throw new DomainError(401, 'UNAUTHENTICATED', 'Session expired or membership disabled');
    return work(db, { tenantId, id: user.id, name: user.display_name, admin: user.main_admin });
  });
}
export async function requireFactory(
  db: PoolClient,
  actor: Actor,
  factoryId: string,
  department: string,
) {
  const f = await db.query('SELECT id FROM factories WHERE tenant_id=$1 AND id=$2', [
    actor.tenantId,
    factoryId,
  ]);
  if (!f.rowCount) throw new DomainError(404, 'NOT_FOUND', 'Factory not found');
  if (actor.admin) return;
  const access = await db.query(
    'SELECT 1 FROM role_assignments WHERE tenant_id=$1 AND membership_id=$2 AND factory_id=$3 AND department=$4',
    [actor.tenantId, actor.id, factoryId, department],
  );
  if (!access.rowCount)
    throw new DomainError(
      403,
      'FORBIDDEN',
      'This department and factory are outside your role assignment',
    );
}
