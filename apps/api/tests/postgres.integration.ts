import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { makePool, tenantTransaction, assertRuntimeRole } from '../src/db.js';
import { migrate, grantRuntime } from '../src/migrations.js';
import { passwordHash } from '../src/identity.js';
import { hashToken } from '../src/security.js';
import { createApp } from '../src/app.js';
const owner = makePool(process.env.TEST_MIGRATION_DATABASE_URL!, 1),
  pool = makePool(process.env.TEST_DATABASE_URL!, 1);
const tenantA = randomUUID(),
  tenantB = randomUUID(),
  factoryA = randomUUID(),
  factoryA2 = randomUUID(),
  factoryB = randomUUID(),
  adminA = randomUUID(),
  staffA = randomUUID(),
  staffB = randomUUID(),
  browserStaff = randomUUID(),
  unassigned = randomUUID();
const secret = randomBytes(48).toString('hex'),
  password = randomBytes(24).toString('hex'),
  origin = 'http://127.0.0.1:5173';
let app = createApp(() => true, { pool, secret, origin, production: false });
async function signIn(tenant: string, email: string) {
  const result = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', origin)
    .send({ tenant, email, password });
  expect(result.status).toBe(200);
  return {
    cookie: (result.headers['set-cookie'] as unknown as string[])[0].split(';')[0],
    csrf: result.body.data.csrfToken as string,
  };
}
async function writeNote(
  auth: { cookie: string; csrf: string },
  factory: string,
  department = 'Store',
  body = 'Synthetic work note',
) {
  return request(app)
    .post(`/api/v1/factories/${factory}/notes`)
    .set('Origin', origin)
    .set('Cookie', auth.cookie)
    .set('X-CSRF-Token', auth.csrf)
    .send({ department, body });
}
beforeAll(async () => {
  await migrate(owner);
  await migrate(owner);
  await grantRuntime(owner, process.env.TEST_RUNTIME_ROLE!);
  const hashed = await passwordHash(password);
  for (const [tenant, slug, mode] of [
    [tenantA, 'sample-woven', 'saas'],
    [tenantB, 'sample-knit', 'single-business'],
  ]) {
    await tenantTransaction(owner, tenant, async (db) => {
      await db.query('INSERT INTO tenants(id,slug,name,mode) VALUES($1,$2,$2,$3)', [
        tenant,
        slug,
        mode,
      ]);
    });
  }
  await tenantTransaction(owner, tenantA, async (db) => {
    for (const [id, name] of [
      [factoryA, 'Factory A'],
      [factoryA2, 'Factory A2'],
    ])
      await db.query('INSERT INTO factories(tenant_id,id,name) VALUES($1,$2,$3)', [
        tenantA,
        id,
        name,
      ]);
    for (const [id, email, admin] of [
      [adminA, 'admin@example.test', true],
      [staffA, 'staff@example.test', false],
      [browserStaff, 'operator@example.test', false],
      [unassigned, 'new@example.test', false],
    ])
      await db.query(
        'INSERT INTO memberships(tenant_id,id,email,display_name,password_hash,main_admin) VALUES($1,$2,$3,$3,$4,$5)',
        [tenantA, id, email, hashed, admin],
      );
    await db.query(
      "INSERT INTO role_assignments VALUES($1,$2,$3,'Store','staff'),($1,$2,$4,'Planning','staff')",
      [tenantA, staffA, factoryA, factoryA2],
    );
    await db.query(
      "INSERT INTO role_assignments VALUES($1,$2,$3,'Store','staff'),($1,$2,$4,'Planning','staff')",
      [tenantA, browserStaff, factoryA, factoryA2],
    );
  });
  await tenantTransaction(owner, tenantB, async (db) => {
    await db.query('INSERT INTO factories VALUES($1,$2,$3)', [tenantB, factoryB, 'Knit factory']);
    await db.query(
      'INSERT INTO memberships(tenant_id,id,email,display_name,password_hash,main_admin) VALUES($1,$2,$3,$3,$4,true)',
      [tenantB, staffB, 'admin@example.test', hashed],
    );
  });
});
beforeEach(() => {
  app = createApp(() => true, { pool, secret, origin, production: false });
});
afterAll(async () => {
  await pool.end();
  await owner.end();
});
describe('real PostgreSQL isolation and identity slice', () => {
  it('runs as non-owner and rejects an owner connection', async () => {
    await assertRuntimeRole(pool);
    await expect(assertRuntimeRole(owner)).rejects.toThrow();
    const r = await owner.query('SELECT count(*)::int AS n FROM schema_migrations');
    expect(r.rows[0].n).toBe(1);
  });
  it('forces RLS even for the migration owner with no tenant context', async () => {
    expect((await owner.query('SELECT * FROM factories')).rows).toHaveLength(0);
    expect((await pool.query('SELECT * FROM factories')).rows).toHaveLength(0);
  });
  it('fails closed and resets context after commit and rollback on reused connection', async () => {
    await tenantTransaction(pool, tenantA, async (db) => {
      expect((await db.query('SELECT * FROM factories')).rows).toHaveLength(2);
    });
    expect((await pool.query('SELECT * FROM factories')).rows).toHaveLength(0);
    await expect(
      tenantTransaction(pool, tenantA, async () => {
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect((await pool.query('SELECT * FROM factories')).rows).toHaveLength(0);
    await tenantTransaction(pool, tenantB, async (db) =>
      expect((await db.query('SELECT * FROM factories')).rows).toHaveLength(1),
    );
  });
  it('rejects cross-tenant SELECT, INSERT, UPDATE, DELETE and foreign references', async () => {
    await tenantTransaction(pool, tenantA, async (db) => {
      expect((await db.query('SELECT * FROM memberships WHERE id=$1', [staffB])).rowCount).toBe(0);
      expect(
        (await db.query('UPDATE memberships SET active=false WHERE id=$1', [staffB])).rowCount,
      ).toBe(0);
    });
    await expect(
      tenantTransaction(pool, tenantA, (db) =>
        db.query(
          'INSERT INTO factory_notes(tenant_id,id,factory_id,actor_id,department,body) VALUES($1,$2,$3,$4,$5,$6)',
          [tenantB, randomUUID(), factoryB, staffB, 'Store', 'denied'],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      tenantTransaction(pool, tenantA, (db) =>
        db.query(
          'INSERT INTO factory_notes(tenant_id,id,factory_id,actor_id,department,body) VALUES($1,$2,$3,$4,$5,$6)',
          [tenantA, randomUUID(), factoryB, staffA, 'Store', 'denied'],
        ),
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query(
        'INSERT INTO factory_notes(tenant_id,id,factory_id,actor_id,department,body) VALUES($1,$2,$3,$4,$5,$6)',
        [tenantA, randomUUID(), factoryA, staffA, 'Store', 'missing context'],
      ),
    ).rejects.toMatchObject({ code: '42501' });
    const b = await signIn('sample-knit', 'admin@example.test');
    await tenantTransaction(pool, tenantA, async (db) => {
      expect(
        (
          await db.query('DELETE FROM sessions WHERE token_hash=$1', [
            hashToken(b.cookie.split('=')[1]),
          ])
        ).rowCount,
      ).toBe(0);
    });
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', b.cookie)).status).toBe(200);
  });
  it('uses HttpOnly SameSite cookies, rejects forged tokens and wrong credentials', async () => {
    const r = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ tenant: 'sample-woven', email: 'staff@example.test', password: 'wrong' });
    expect(r.status).toBe(401);
    const a = await signIn('sample-woven', 'staff@example.test');
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', a.cookie + 'f')
      ).status,
    ).toBe(401);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ tenant: 'sample-woven', email: 'admin@example.test', password });
    expect(String(login.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(login.headers['set-cookie'])).toContain('SameSite=Strict');
  });
  it('isolates role/scope combinations and prevents tenant injection in body', async () => {
    const a = await signIn('sample-woven', 'staff@example.test');
    expect((await writeNote(a, factoryA)).status).toBe(201);
    expect((await writeNote(a, factoryA2, 'Planning')).status).toBe(201);
    expect((await writeNote(a, factoryA2, 'Store')).status).toBe(403);
    expect((await writeNote(a, factoryA, 'Planning')).status).toBe(403);
    expect((await writeNote(a, factoryB)).status).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/v1/factories/${factoryA2}/notes?department=Store`)
          .set('Cookie', a.cookie)
      ).status,
    ).toBe(403);
    const r = await request(app)
      .post(`/api/v1/factories/${factoryA}/notes`)
      .set('Origin', origin)
      .set('Cookie', a.cookie)
      .set('X-CSRF-Token', a.csrf)
      .send({ department: 'Store', body: 'attempt', tenantId: tenantB });
    expect(r.status).toBe(400);
    const b = await signIn('sample-knit', 'admin@example.test');
    expect(
      (await request(app).get('/api/v1/factories').set('Cookie', b.cookie)).body.data,
    ).toHaveLength(1);
  });
  it('gives unassigned employees no factory access', async () => {
    const auth = await signIn('sample-woven', 'new@example.test');
    expect(
      (await request(app).get('/api/v1/factories').set('Cookie', auth.cookie)).body.data,
    ).toEqual([]);
    expect((await writeNote(auth, factoryA)).status).toBe(403);
  });
  it('rejects CSRF and foreign origins before writes', async () => {
    const auth = await signIn('sample-woven', 'admin@example.test');
    expect(
      (
        await request(app)
          .post(`/api/v1/factories/${factoryA}/notes`)
          .set('Origin', origin)
          .set('Cookie', auth.cookie)
          .send({ department: 'Store', body: 'denied' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Origin', 'https://untrusted.test')
          .send({})
      ).status,
    ).toBe(403);
  });
  it('commits a note with audit, and rolls failed transactions back', async () => {
    const a = await signIn('sample-knit', 'admin@example.test');
    const note = await writeNote(a, factoryB);
    expect(note.status).toBe(201);
    await tenantTransaction(owner, tenantB, async (db) => {
      expect(
        (
          await db.query(
            "SELECT * FROM audit_events WHERE target_id=$1 AND action='factory-note.create'",
            [note.body.data.id],
          )
        ).rowCount,
      ).toBe(1);
    });
    const id = randomUUID();
    await expect(
      tenantTransaction(pool, tenantA, async (db) => {
        await db.query("INSERT INTO factory_notes VALUES($1,$2,$3,$4,'Store','rollback',now())", [
          tenantA,
          id,
          factoryA,
          staffA,
        ]);
        throw new Error('forced failure');
      }),
    ).rejects.toThrow();
    await tenantTransaction(pool, tenantA, async (db) =>
      expect((await db.query('SELECT * FROM factory_notes WHERE id=$1', [id])).rowCount).toBe(0),
    );
  });
  it('rate limits repeated sign-in failures', async () => {
    for (let i = 0; i < 10; i++) {
      expect(
        (
          await request(app)
            .post('/api/v1/auth/login')
            .set('Origin', origin)
            .send({ tenant: 'sample-woven', email: 'absent@example.test', password: 'invalid' })
        ).status,
      ).toBe(401);
    }
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Origin', origin)
          .send({ tenant: 'sample-woven', email: 'absent@example.test', password: 'invalid' })
      ).status,
    ).toBe(429);
  });
  it('protects last Main Admin and rejects a disabled membership immediately', async () => {
    const admin = await signIn('sample-woven', 'admin@example.test'),
      staff = await signIn('sample-woven', 'staff@example.test');
    expect(
      (
        await request(app)
          .post(`/api/v1/memberships/${adminA}/disable`)
          .set('Origin', origin)
          .set('Cookie', admin.cookie)
          .set('X-CSRF-Token', admin.csrf)
          .send({})
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`/api/v1/memberships/${staffB}/disable`)
          .set('Origin', origin)
          .set('Cookie', admin.cookie)
          .set('X-CSRF-Token', admin.csrf)
          .send({})
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/api/v1/memberships/${staffA}/disable`)
          .set('Origin', origin)
          .set('Cookie', staff.cookie)
          .set('X-CSRF-Token', staff.csrf)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/v1/memberships/${staffA}/disable`)
          .set('Origin', origin)
          .set('Cookie', admin.cookie)
          .set('X-CSRF-Token', admin.csrf)
          .send({})
      ).status,
    ).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', staff.cookie)).status).toBe(
      401,
    );
    expect((await writeNote(staff, factoryA)).status).toBe(401);
  });
  it('completes desktop and mobile browser sign-in, scoped notes and logout', async () => {
    const browserOrigin = 'http://127.0.0.1:5317';
    const apiServer = createApp(() => true, {
      pool,
      secret,
      origin: browserOrigin,
      production: false,
    }).listen(0, '127.0.0.1');
    await once(apiServer, 'listening');
    const address = apiServer.address();
    if (!address || typeof address === 'string') throw new Error('API listener failed');
    const web = await createServer({
      configFile: fileURLToPath(new URL('../../web/vite.config.ts', import.meta.url)),
      root: fileURLToPath(new URL('../../web/', import.meta.url)),
      server: {
        port: 5317,
        strictPort: true,
        host: '127.0.0.1',
        proxy: { '/api': `http://127.0.0.1:${address.port}` },
      },
    });
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      await web.listen();
      browser = await chromium.launch({
        headless: true,
        ...(process.platform === 'win32' ? { channel: 'chrome' } : {}),
      });
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(browserOrigin + '/#workspace');
      await page.getByLabel('Business slug').fill('sample-knit');
      await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
      await page.getByLabel('Factory', { exact: true }).selectOption({ label: 'Knit factory' });
      await page.getByLabel('Department', { exact: true }).selectOption('Packing');
      const body = 'Browser-verified synthetic packing note';
      await page.getByLabel('New work note').fill(body);
      await page.getByRole('button', { name: 'Save work note' }).click();
      await page.getByText(body, { exact: true }).waitFor();
      const directory = fileURLToPath(new URL('../../../.local/qa/', import.meta.url));
      await mkdir(directory, { recursive: true });
      await page.screenshot({ path: join(directory, 'workspace-desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: join(directory, 'workspace-mobile.png'), fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const cookies = await page.context().cookies();
      expect(cookies.find((c) => c.name === 'garmentflow')?.httpOnly).toBe(true);
      expect(await page.evaluate(() => localStorage.length)).toBe(0);
      await page.reload();
      await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
      await page.getByLabel('Business slug').fill('sample-woven');
      await page.getByLabel('Email', { exact: true }).fill('operator@example.test');
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
      await page.getByLabel('Factory', { exact: true }).selectOption(factoryA2);
      expect(
        await page.getByLabel('Department', { exact: true }).locator('option').allTextContents(),
      ).toEqual(['Select department', 'Planning']);
      expect(
        await page.getByLabel('Factory', { exact: true }).locator('option').allTextContents(),
      ).not.toContain('Knit factory');
      await page.getByLabel('Department', { exact: true }).selectOption('Planning');
      const operatorNote = 'Scoped operator browser note';
      await page.getByLabel('New work note').fill(operatorNote);
      await page.getByRole('button', { name: 'Save work note' }).click();
      await page.getByText(operatorNote, { exact: true }).waitFor();
      const admin = await signIn('sample-woven', 'admin@example.test');
      expect(
        (
          await request(app)
            .post(`/api/v1/memberships/${browserStaff}/disable`)
            .set('Origin', origin)
            .set('Cookie', admin.cookie)
            .set('X-CSRF-Token', admin.csrf)
            .send({})
        ).status,
      ).toBe(200);
      await page.reload();
      await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
      expect(await page.getByText(operatorNote, { exact: true }).count()).toBe(0);
      await page.getByRole('button', { name: 'Sample dashboard', exact: true }).click();
      await page.getByRole('heading', { name: 'Factory overview' }).waitFor();
      await page.getByRole('button', { name: 'Knit', exact: true }).click();
      expect(await page.locator('tbody tr').count()).toBe(2);
      expect(errors).toEqual([]);
    } finally {
      await browser?.close();
      await web.close();
      await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    }
  }, 60000);
});
