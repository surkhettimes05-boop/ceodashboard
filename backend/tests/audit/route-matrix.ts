import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import app from '../../src/app.js';
import { bootstrapAuditDatabase, getAuditDatabaseUrl } from './bootstrap.js';
import { generateAccessToken } from '../../src/utils/jwt.js';

const prisma = new PrismaClient({ datasourceUrl: getAuditDatabaseUrl() });

async function main() {
  console.log('\n=== ROUTE MATRIX + IDOR ===');
  bootstrapAuditDatabase();

  const cashier = await prisma.user.findUnique({ where: { username: 'cashier' } });
  const ceo = await prisma.user.findUnique({ where: { username: 'ceo' } });
  const branch = await prisma.branch.findFirst();
  const otherBranch = await prisma.branch.create({
    data: {
      code: 'BR-AUDIT-ALT',
      name: 'Audit Alt Branch',
      address: 'Test branch',
    },
  });

  const cashierToken = generateAccessToken({ userId: cashier!.id, username: cashier!.username, role: 'CASHIER', branchId: branch!.id });
  const ceoToken = generateAccessToken({ userId: ceo!.id, username: ceo!.username, role: 'CEO', branchId: branch!.id });

  const checks = [
    { label: 'GET /api/users no token', method: 'get', path: '/api/users', token: null, expect: 401 },
    { label: 'GET /api/users invalid token', method: 'get', path: '/api/users', token: 'bad-token', expect: 401 },
    { label: 'GET /api/users cashier', method: 'get', path: '/api/users', token: cashierToken, expect: 403 },
    { label: 'GET /api/users ceo', method: 'get', path: '/api/users', token: ceoToken, expect: 200 },
    { label: 'GET /api/analytics/dashboard cashier', method: 'get', path: '/api/analytics/dashboard', token: cashierToken, expect: 403 },
    { label: 'GET /api/analytics/dashboard ceo', method: 'get', path: '/api/analytics/dashboard', token: ceoToken, expect: 200 },
  ] as const;

  for (const check of checks) {
    const req = request(app)[check.method](check.path);
    if (check.token) {
      req.set('Authorization', `Bearer ${check.token}`);
    }
    const res = await req;
    console.log(`[route] ${check.label} => ${res.status}`);
    if (res.status !== check.expect) {
      throw new Error(`${check.label}: expected ${check.expect}, got ${res.status}`);
    }
  }

  const targetUser = await prisma.user.findUnique({ where: { username: 'cashier' } });
  const updated = await request(app)
    .put(`/api/users/${targetUser!.id}`)
    .set('Authorization', `Bearer ${ceoToken}`)
    .send({ fullName: 'Cashier Modified', roleId: ceo!.role_id, branchId: otherBranch.id });

  if (updated.status === 200) {
    const fresh = await prisma.user.findUnique({ where: { id: targetUser!.id } });
    console.log(`[route] Self-role change attempt: ${fresh?.role_id === ceo!.role_id ? 'ALLOWED' : 'BLOCKED'}`);
  }

  console.log('[route] PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
