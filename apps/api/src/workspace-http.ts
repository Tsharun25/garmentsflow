import type { Express, Request } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { login, withActor, requireFactory, audit, DomainError } from './identity.js';
import { readCookie, csrfToken, hashToken } from './security.js';
const department = z.enum([
  'Merchandising',
  'Planning',
  'Commercial',
  'Store',
  'Cutting',
  'Sewing',
  'Packing',
  'Quality',
]);
const credentials = z
  .object({
    tenant: z.string().regex(/^[a-z0-9-]{2,60}$/),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();
export function mountWorkspace(
  app: Express,
  options: { pool: Pool; secret: string; origin: string; production: boolean },
) {
  const { pool, secret, origin, production } = options;
  const cookieName = production ? '__Host-garmentflow' : 'garmentflow';
  const cookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: 'strict' as const,
    path: '/',
  };
  const token = (req: Request) => readCookie(req.headers.cookie, cookieName);
  app.use('/api/v1', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next();
      return;
    }
    if (req.get('origin') !== origin) {
      next(new DomainError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed'));
      return;
    }
    if (req.path === '/auth/login') {
      next();
      return;
    }
    const session = token(req);
    const supplied = req.get('x-csrf-token');
    if (!session || !supplied || supplied !== csrfToken(session, secret)) {
      next(new DomainError(403, 'CSRF_REJECTED', 'Reload the workspace and try again'));
      return;
    }
    next();
  });
  app.post(
    '/api/v1/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try later.' },
      },
    }),
    async (req, res) => {
      const input = credentials.parse(req.body);
      const result = await login(pool, input.tenant, input.email, input.password, secret);
      res.cookie(cookieName, result.token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
      res.set('Cache-Control', 'no-store').json({
        success: true,
        data: { actor: result.actor, csrfToken: csrfToken(result.token, secret) },
      });
    },
  );
  app.get('/api/v1/auth/me', async (req, res) => {
    const actor = await withActor(pool, token(req), secret, async (_db, actor) => actor);
    res
      .set('Cache-Control', 'no-store')
      .json({ success: true, data: { actor, csrfToken: csrfToken(token(req), secret) } });
  });
  app.post('/api/v1/auth/logout', async (req, res) => {
    await withActor(pool, token(req), secret, async (db, actor) => {
      await db.query('DELETE FROM sessions WHERE tenant_id=$1 AND token_hash=$2', [
        actor.tenantId,
        hashToken(token(req)),
      ]);
      await audit(db, actor, 'session.logout');
    });
    res.clearCookie(cookieName, cookieOptions).json({ success: true, data: null });
  });
  app.get('/api/v1/factories', async (req, res) => {
    const data = await withActor(pool, token(req), secret, async (db, actor) => {
      const result = await db.query<{ id: string; name: string; departments: string[] }>(
        `SELECT f.id,f.name,CASE WHEN $3::boolean THEN ARRAY['Merchandising','Planning','Commercial','Store','Cutting','Sewing','Packing','Quality']::text[] ELSE array_agg(DISTINCT a.department ORDER BY a.department) END AS departments FROM factories f LEFT JOIN role_assignments a ON a.tenant_id=f.tenant_id AND a.factory_id=f.id AND a.membership_id=$2 WHERE f.tenant_id=$1 AND ($3::boolean OR a.membership_id IS NOT NULL) GROUP BY f.id,f.name ORDER BY f.name LIMIT 100`,
        [actor.tenantId, actor.id, actor.admin],
      );
      return result.rows;
    });
    res.set('Cache-Control', 'no-store').json({ success: true, data });
  });
  app.get('/api/v1/factories/:id/notes', async (req, res) => {
    const factoryId = z.uuid().parse(req.params.id);
    const dept = department.parse(req.query.department);
    const data = await withActor(pool, token(req), secret, async (db, actor) => {
      await requireFactory(db, actor, factoryId, dept);
      return (
        await db.query(
          'SELECT id,department,body,created_at FROM factory_notes WHERE tenant_id=$1 AND factory_id=$2 AND department=$3 ORDER BY created_at DESC,id DESC LIMIT 50',
          [actor.tenantId, factoryId, dept],
        )
      ).rows;
    });
    res.set('Cache-Control', 'no-store').json({ success: true, data });
  });
  app.post('/api/v1/factories/:id/notes', async (req, res) => {
    const factoryId = z.uuid().parse(req.params.id);
    const input = z
      .object({ department, body: z.string().trim().min(1).max(1000) })
      .strict()
      .parse(req.body);
    const data = await withActor(pool, token(req), secret, async (db, actor) => {
      await requireFactory(db, actor, factoryId, input.department);
      const id = randomUUID();
      await db.query(
        'INSERT INTO factory_notes(tenant_id,id,factory_id,actor_id,department,body) VALUES($1,$2,$3,$4,$5,$6)',
        [actor.tenantId, id, factoryId, actor.id, input.department, input.body],
      );
      await audit(db, actor, 'factory-note.create', id);
      return { id };
    });
    res.status(201).json({ success: true, data });
  });
  app.post('/api/v1/memberships/:id/disable', async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    z.object({}).strict().parse(req.body);
    await withActor(pool, token(req), secret, async (db, actor) => {
      if (!actor.admin)
        throw new DomainError(403, 'FORBIDDEN', 'Main Admin permission is required');
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [actor.tenantId]);
      const target = (
        await db.query<{ main_admin: boolean; active: boolean }>(
          'SELECT main_admin,active FROM memberships WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
          [actor.tenantId, id],
        )
      ).rows[0];
      if (!target) throw new DomainError(404, 'NOT_FOUND', 'Membership not found');
      if (target.main_admin && target.active) {
        const count = await db.query<{ count: string }>(
          'SELECT count(*) FROM memberships WHERE tenant_id=$1 AND main_admin AND active',
          [actor.tenantId],
        );
        if (Number(count.rows[0].count) <= 1)
          throw new DomainError(409, 'LAST_ADMIN', 'The last active Main Admin cannot be disabled');
      }
      await db.query('UPDATE memberships SET active=false WHERE tenant_id=$1 AND id=$2', [
        actor.tenantId,
        id,
      ]);
      await db.query('DELETE FROM sessions WHERE tenant_id=$1 AND membership_id=$2', [
        actor.tenantId,
        id,
      ]);
      await audit(db, actor, 'membership.disable', id);
    });
    res.json({ success: true, data: null });
  });
}
