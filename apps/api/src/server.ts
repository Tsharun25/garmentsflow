import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { configSchema } from './config.js';
import { makePool, assertRuntimeRole } from './db.js';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    'Invalid API configuration. Check .env.example; database and session secrets are required.',
  );
  process.exit(1);
}
const config = parsed.data;
const pool = makePool(config.DATABASE_URL);
try {
  await assertRuntimeRole(pool);
  await pool.query('SELECT 1 FROM factories LIMIT 0');
} catch {
  console.error(
    'Database startup failed. Check migrations, runtime permissions and database access.',
  );
  await pool.end();
  process.exit(1);
}
let ready = true;
const health = setInterval(() => {
  void pool
    .query('SELECT 1')
    .then(() => {
      ready = true;
    })
    .catch(() => {
      ready = false;
    });
}, 5000).unref();
const server = createApp(() => ready, {
  pool,
  secret: config.SESSION_SECRET,
  origin: config.CLIENT_URL,
  production: config.NODE_ENV === 'production',
}).listen(config.PORT, config.HOST, () =>
  console.log(`GarmentFlow API listening on port ${config.PORT}`),
);
function shutdown() {
  clearInterval(health);
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
