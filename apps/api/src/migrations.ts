import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
export async function migrate(pool: Pool) {
  const db = await pool.connect();
  try {
    await db.query('SELECT pg_advisory_lock(7091313)');
    await db.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const directory = fileURLToPath(new URL('../../../db/migrations/', import.meta.url));
    for (const name of (await readdir(directory)).filter((n) => n.endsWith('.sql')).sort()) {
      const sql = await readFile(`${directory}/${name}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = await db.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE name=$1',
        [name],
      );
      if (previous.rows.length) {
        if (previous.rows[0].checksum !== checksum)
          throw new Error('Applied migration checksum changed');
        continue;
      }
      await db.query('BEGIN');
      try {
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
          name,
          checksum,
        ]);
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await db.query('SELECT pg_advisory_unlock(7091313)');
    db.release();
  }
}
export async function grantRuntime(pool: Pool, role: string) {
  // The role is validated before interpolation; passwords are never interpolated.
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role)) throw new Error('Invalid runtime role name');
  await pool.query(`GRANT USAGE ON SCHEMA public TO "${role}";
 GRANT EXECUTE ON FUNCTION resolve_tenant(text) TO "${role}";
 GRANT SELECT ON factories, memberships, role_assignments TO "${role}";
 GRANT UPDATE(active) ON memberships TO "${role}";
 GRANT SELECT,INSERT,DELETE ON sessions TO "${role}";
 GRANT SELECT,INSERT ON factory_notes TO "${role}";
 GRANT SELECT,INSERT ON audit_events TO "${role}";`);
}
