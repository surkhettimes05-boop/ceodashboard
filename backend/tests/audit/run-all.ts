import { spawnSync } from 'node:child_process';
import path from 'node:path';

const backendRoot = path.resolve(__dirname, '../..');
const scripts = [
  'tests/audit/ledger-integrity.ts',
  'tests/audit/stock-reconciliation.ts',
  'tests/audit/concurrency-idempotency.ts',
  'tests/audit/route-matrix.ts',
];

for (const script of scripts) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['tsx', script], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgresql://postgres@localhost:55432/ceodashboard_audit?schema=public' },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error(`\n[audit] FAILED: ${script}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[audit] ALL AUDIT CHECKS PASSED');
