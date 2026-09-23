import { prisma } from '../../db/prisma.js';
import { CreateSupplierInput, UpdateSupplierInput } from './suppliers.schema.js';
import { AuditService } from '../audit/audit.service.js';

export class SuppliersService {
  static async getSuppliers() {
    return prisma.supplier.findMany({
      include: { _count: { select: { purchases: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  static async getSupplierById(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { purchases: true },
    });
    if (!supplier) throw new Error('Supplier not found.');
    return supplier;
  }

  static async createSupplier(input: CreateSupplierInput, actorUserId?: string) {
    const newSupplier = await prisma.supplier.create({
      data: {
        name: input.name,
        contact_person: input.contactPerson || null,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'SUPPLIER_CREATED',
      entity: 'Supplier',
      entityId: newSupplier.id,
      newValues: { name: newSupplier.name },
    });

    return newSupplier;
  }

  static async updateSupplier(id: string, input: UpdateSupplierInput, actorUserId?: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new Error('Supplier not found.');

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: input.name ?? supplier.name,
        contact_person: input.contactPerson !== undefined ? input.contactPerson : supplier.contact_person,
        phone: input.phone !== undefined ? input.phone : supplier.phone,
        email: input.email !== undefined ? input.email : supplier.email,
        address: input.address !== undefined ? input.address : supplier.address,
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'SUPPLIER_UPDATED',
      entity: 'Supplier',
      entityId: id,
      newValues: { name: updated.name },
    });

    return updated;
  }
}
