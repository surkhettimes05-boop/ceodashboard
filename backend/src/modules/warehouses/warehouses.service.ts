import { prisma } from '../../db/prisma.js';

export class WarehousesService {
  static async getWarehouses() {
    return prisma.warehouse.findMany({
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  static async createWarehouse(data: { code: string; name: string; branchId?: string; isCentral?: boolean }) {
    const existing = await prisma.warehouse.findUnique({ where: { code: data.code } });
    if (existing) throw new Error(`Warehouse code ${data.code} already exists.`);

    return prisma.warehouse.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        branch_id: data.branchId || null,
        is_central: data.isCentral || false,
      },
    });
  }
}
