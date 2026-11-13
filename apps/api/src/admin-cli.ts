import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { makePool, tenantTransaction } from './db.js';
import { migrate, grantRuntime } from './migrations.js';
import { passwordHash } from './identity.js';
const url = z
  .string()
  .regex(/^postgres(?:ql)?:\/\//)
  .parse(process.env.MIGRATION_DATABASE_URL);
const pool = makePool(url);
try {
  const command = process.argv[2];
  if (command === 'migrate') {
    await migrate(pool);
    await grantRuntime(pool, z.string().parse(process.env.RUNTIME_DATABASE_ROLE));
    console.log('Migrations and runtime grants applied.');
  } else if (command === 'provision') {
    const input = z
      .object({
        slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
        name: z.string().min(1).max(100),
        email: z.email().transform((v) => v.toLowerCase()),
        password: z.string().min(14).max(128),
        mode: z.enum(['single-business', 'saas']),
      })
      .parse({
        slug: process.env.PROVISION_TENANT_SLUG,
        name: process.env.PROVISION_TENANT_NAME,
        email: process.env.PROVISION_ADMIN_EMAIL,
        password: process.env.PROVISION_ADMIN_PASSWORD,
        mode: process.env.DEPLOYMENT_MODE,
      });
    const tenantId = randomUUID(),
      id = randomUUID(),
      password = await passwordHash(input.password);
    await tenantTransaction(pool, tenantId, async (db) => {
      await db.query('INSERT INTO tenants(id,slug,name,mode) VALUES($1,$2,$3,$4)', [
        tenantId,
        input.slug,
        input.name,
        input.mode,
      ]);
      await db.query(
        'INSERT INTO memberships(tenant_id,id,email,display_name,password_hash,main_admin) VALUES($1,$2,$3,$4,$5,true)',
        [tenantId, id, input.email, 'Main Admin', password],
      );
      await db.query('INSERT INTO factories(tenant_id,id,name) VALUES($1,$2,$3)', [
        tenantId,
        randomUUID(),
        'Initial factory',
      ]);
      await db.query('INSERT INTO audit_events(tenant_id,id,actor_id,action) VALUES($1,$2,$3,$4)', [
        tenantId,
        randomUUID(),
        id,
        'tenant.provision',
      ]);
    });
    console.log('Tenant provisioned. No credentials are printed.');
  } else throw new Error('Use migrate or provision');
} catch {
  console.error(
    'Administrative command failed. Check required environment fields, migration state and unique identifiers.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
