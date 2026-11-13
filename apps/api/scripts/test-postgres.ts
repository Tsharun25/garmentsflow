import EmbeddedPostgres from 'embedded-postgres';
import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const suffix = randomBytes(6).toString('hex');
let disposableDirectory: string | undefined;
let pgCtl: string | undefined;
async function execute(file: string, args: string[]) {
  await new Promise<void>((resolveCommand, rejectCommand) => {
    const child = spawn(file, args, { stdio: 'ignore', windowsHide: true });
    child.once('error', rejectCommand);
    child.once('exit', (code) =>
      code === 0 ? resolveCommand() : rejectCommand(new Error('PostgreSQL controller failed')),
    );
  });
}
let embedded: EmbeddedPostgres | undefined;
let admin: Pool | undefined;
const appRole = `gf_app_${suffix}`,
  ownerRole = `gf_owner_${suffix}`,
  database = `gf_test_${suffix}`;
const appPassword = randomBytes(32).toString('hex'),
  ownerPassword = randomBytes(32).toString('hex');
let exitCode = 1;
try {
  let adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
  if (!adminUrl) {
    const base = resolve(root, '.local');
    await mkdir(base, { recursive: true });
    const directory = await mkdtemp(resolve(base, 'pg-test-'));
    if (!directory.startsWith(base + '\\') && !directory.startsWith(base + '/'))
      throw new Error('Test data path outside workspace');
    const listener = createServer();
    await new Promise<void>((r) => listener.listen(0, '127.0.0.1', r));
    const address = listener.address();
    if (!address || typeof address === 'string') throw new Error('No test port');
    const port = address.port;
    await new Promise<void>((r, j) => listener.close((e) => (e ? j(e) : r())));
    disposableDirectory = directory;
    const password = randomBytes(32).toString('hex');
    embedded = new EmbeddedPostgres({
      databaseDir: directory,
      user: 'postgres',
      password,
      port,
      persistent: true,
      authMethod: 'scram-sha-256',
      postgresFlags: ['-h', '127.0.0.1'],
      onLog: () => {},
      onError: () => {},
    });
    await embedded.initialise();
    // Use PostgreSQL's controller to reap workers gracefully on Windows.
    // embedded-postgres.stop() force-kills there and can leave inherited pipes open.
    const platformPackage = `@embedded-postgres/${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
    const binaries = (await import(platformPackage)) as { pg_ctl: string };
    pgCtl = binaries.pg_ctl;
    await execute(pgCtl, [
      '-D',
      directory,
      '-l',
      resolve(directory, 'server.log'),
      '-o',
      `-h 127.0.0.1 -p ${port}`,
      '-w',
      '-t',
      '15',
      'start',
    ]);
    adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
  }
  admin = new Pool({ connectionString: adminUrl });
  for (const [name, password] of [
    [appRole, appPassword],
    [ownerRole, ownerPassword],
  ]) {
    const ddl = await admin.query<{ sql: string }>(
      "SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L',$1::text,$2::text) AS sql",
      [name, password],
    );
    await admin.query(ddl.rows[0].sql);
  }
  const ddl = await admin.query<{ sql: string }>(
    "SELECT format('CREATE DATABASE %I OWNER %I',$1::text,$2::text) AS sql",
    [database, ownerRole],
  );
  await admin.query(ddl.rows[0].sql);
  const appUrl = new URL(adminUrl);
  appUrl.username = appRole;
  appUrl.password = appPassword;
  appUrl.pathname = `/${database}`;
  const ownerUrl = new URL(adminUrl);
  ownerUrl.username = ownerRole;
  ownerUrl.password = ownerPassword;
  ownerUrl.pathname = `/${database}`;
  const executable = resolve(root, 'node_modules/vitest/vitest.mjs');
  exitCode = await new Promise<number>((r) => {
    const child = spawn(process.execPath, [executable, 'run', 'tests/postgres.integration.ts'], {
      cwd: resolve(root, 'apps/api'),
      env: {
        ...process.env,
        TEST_DATABASE_URL: appUrl.toString(),
        TEST_MIGRATION_DATABASE_URL: ownerUrl.toString(),
        TEST_RUNTIME_ROLE: appRole,
      },
      stdio: 'inherit',
    });
    child.on('error', () => r(1));
    child.on('exit', (code) => r(code ?? 1));
  });
} catch {
  console.error(
    'Real PostgreSQL test setup failed. Check the installed binary or TEST_ADMIN_DATABASE_URL and role/database creation permissions.',
  );
} finally {
  if (admin) {
    try {
      await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      await admin.query(`DROP ROLE IF EXISTS "${appRole}"`);
      await admin.query(`DROP ROLE IF EXISTS "${ownerRole}"`);
    } catch {
      console.error('Disposable PostgreSQL cleanup incomplete.');
    }
    await admin.end();
  }
  if (embedded) {
    if (pgCtl && disposableDirectory) {
      await execute(pgCtl, ['-D', disposableDirectory, '-m', 'fast', '-w', '-t', '15', 'stop']);
    }
    await embedded.stop();
    if (disposableDirectory)
      await rm(disposableDirectory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 300,
      });
  }
}
process.exitCode = exitCode;
