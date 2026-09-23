import { prisma } from '../../db/prisma.js';
import { CreateBranchInput, UpdateBranchInput } from './branches.schema.js';
import { AuditService } from '../audit/audit.service.js';

export class BranchesService {
  static async getBranches() {
    return prisma.branch.findMany({
      include: {
        warehouses: true,
        _count: { select: { users: true, sales: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  static async getBranchById(id: string) {
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: { warehouses: true },
    });
    if (!branch) throw new Error('Branch not found.');
    return branch;
  }

  static async createBranch(input: CreateBranchInput, actorUserId?: string) {
    const existing = await prisma.branch.findUnique({ where: { code: input.code } });
    if (existing) throw new Error(`Branch code ${input.code} already exists.`);

    const newBranch = await prisma.branch.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        address: input.address || null,
        phone: input.phone || null,
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'BRANCH_CREATED',
      entity: 'Branch',
      entityId: newBranch.id,
      newValues: { code: newBranch.code, name: newBranch.name },
    });

    return newBranch;
  }

  static async updateBranch(id: string, input: UpdateBranchInput, actorUserId?: string) {
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new Error('Branch not found.');

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        code: input.code ? input.code.toUpperCase() : branch.code,
        name: input.name ?? branch.name,
        address: input.address !== undefined ? input.address : branch.address,
        phone: input.phone !== undefined ? input.phone : branch.phone,
        is_active: input.isActive !== undefined ? input.isActive : branch.is_active,
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'BRANCH_UPDATED',
      entity: 'Branch',
      entityId: id,
      oldValues: { name: branch.name, code: branch.code },
      newValues: { name: updated.name, code: updated.code },
    });

    return updated;
  }
}
