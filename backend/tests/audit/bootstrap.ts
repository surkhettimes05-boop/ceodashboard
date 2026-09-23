import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const pgBin = process.env.POSTGRES_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const defaultDbName = process.env.AUDIT_DB_NAME || 'ceodashboard_audit';
const defaultDbUrl = process.env.DATABASE_URL || process.env.AUDIT_DB_URL || `postgresql://postgres@localhost:55432/${defaultDbName}?schema=public`;

export function getAuditDatabaseUrl() {
  return defaultDbUrl;
}

function runCommand(command: string, args: string[], label: string) {
  const cmd = command.includes(' ') ? `"${command}"` : command;
  const result = spawnSync(cmd, args, {
    cwd: backendRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: defaultDbUrl },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`${label} failed with exit code ${result.status}\n${output}`);
  }

  return result.stdout.trim();
}

export function ensureAuditDb() {
  const dbUrl = new URL(defaultDbUrl);
  const dbName = decodeURIComponent(dbUrl.pathname.replace(/^\//, '')) || defaultDbName;
  const dataDir = path.resolve(backendRoot, '.pg_audit_data');
  const initDb = path.join(pgBin, 'initdb.exe');
  const pgCtl = path.join(pgBin, 'pg_ctl.exe');
  const dropDb = path.join(pgBin, 'dropdb.exe');
  const createDb = path.join(pgBin, 'createdb.exe');

  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    runCommand(initDb, ['-D', dataDir, '--username=postgres', '--auth=trust', '--encoding=UTF8'], 'initdb');
  }

  const status = spawnSync('"' + pgCtl + '"', ['-D', dataDir, 'status'], {
    cwd: backendRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: defaultDbUrl },
  });

  if (status.status !== 0) {
    runCommand(pgCtl, ['-D', dataDir, '-l', path.join(dataDir, 'postgres.log'), '-o', '"-p 55432 -h localhost"', 'start'], 'pg_ctl start');
  }

  try {
    runCommand(dropDb, ['-h', 'localhost', '-p', '55432', '-U', 'postgres', '--if-exists', dbName], 'dropdb');
  } catch (error) {
    console.warn(`[audit] dropdb skipped: ${String(error)}`);
  }

  runCommand(createDb, ['-h', 'localhost', '-p', '55432', '-U', 'postgres', dbName], 'createdb');
  console.log(`[audit] Ready: ${defaultDbUrl}`);
}

export function runPrismaMigrate() {
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  runCommand(npxCommand, ['prisma', 'migrate', 'deploy', '--schema=./prisma/schema.prisma'], 'prisma migrate deploy');
}

export function runSeed() {
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  runCommand(npxCommand, ['tsx', 'prisma/seed.ts'], 'seed');
}

export function bootstrapAuditDatabase() {
  ensureAuditDb();
  runPrismaMigrate();
  runSeed();
}
