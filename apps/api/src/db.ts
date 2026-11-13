import { Pool, type PoolClient } from 'pg';
export function makePool(connectionString: string, max = 10) {
  return new Pool({
    connectionString,
    max,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
  });
}
export async function tenantTransaction<T>(
  pool: Pool,
  tenantId: string,
  work: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
export async function assertRuntimeRole(pool: Pool) {
  const result = await pool.query<{
    unsafe: boolean;
  }>(`SELECT (r.rolsuper OR r.rolbypassrls OR EXISTS (
 SELECT 1 FROM pg_class c WHERE c.relname IN ('memberships','factory_notes','factories','sessions') AND pg_has_role(current_user,c.relowner,'MEMBER'))) AS unsafe
 FROM pg_roles r WHERE r.rolname = current_user`);
  if (result.rows[0]?.unsafe !== false)
    throw new Error('Runtime database role must not own tenant tables or bypass RLS');
}
