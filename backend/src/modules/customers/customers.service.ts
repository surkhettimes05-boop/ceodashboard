import { prisma } from '../../db/prisma.js';
import { CreateCustomerInput, UpdateCustomerInput } from './customers.schema.js';
import { AuditService } from '../audit/audit.service.js';

export class CustomersService {
  static async getCustomers(isB2b?: boolean, search?: string) {
    const where: any = {};
    if (isB2b !== undefined) {
      where.is_b2b = isB2b;
    }
    if (search?.trim()) {
      const query = search.trim();
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
        { phone: { contains: this.normalizePhone(query) } },
      ];
    }
    return prisma.customer.findMany({
      where,
      include: { _count: { select: { sales: true } } },
      orderBy: { created_at: 'desc' },
      take: 25,
    });
  }

  static async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { sales: true },
    });
    if (!customer) throw new Error('Customer not found.');
    return customer;
  }

  /**
   * Normalize Nepal phone number to 98XXXXXXXX format
   */
  static normalizePhone(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Nepal phone numbers are 10 digits starting with 9
    // If starts with +977, remove country code
    if (cleaned.startsWith('977')) {
      return cleaned.substring(2);
    }
    
    // If starts with 0, remove leading zero
    if (cleaned.startsWith('0')) {
      return cleaned.substring(1);
    }
    
    return cleaned;
  }

  /**
   * Lookup customer by phone number
   */
  static async lookupCustomerByPhone(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);
    
    const customer = await prisma.customer.findFirst({
      where: { phone: { contains: normalizedPhone } },
    });
    
    return customer;
  }

  /**
   * Get customer loyalty summary for POS display
   */
  static async getCustomerLoyaltySummary(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        loyalty_points_balance: true,
        lifetime_spend: true,
        total_orders: true,
        last_purchase_at: true,
      },
    });

    if (!customer) throw new Error('Customer not found.');

    return customer;
  }

  /**
   * Fast customer creation for POS
   */
  static async createCustomerFromPOS(phone: string, name: string, actorUserId?: string) {
    const normalizedPhone = this.normalizePhone(phone);
    
    // Check if customer already exists
    const existing = await prisma.customer.findFirst({
      where: { phone: normalizedPhone },
    });
    
    if (existing) {
      throw new Error('Customer with this phone number already exists.');
    }

    // Generate customer code
    const customerCode = `CUST-${Date.now().toString().slice(-6)}`;

    const newCustomer = await prisma.customer.create({
      data: {
        code: customerCode,
        name: name.trim(),
        phone: normalizedPhone,
        status: 'ACTIVE',
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'CUSTOMER_CREATED_POS',
      entity: 'Customer',
      entityId: newCustomer.id,
      newValues: { code: newCustomer.code, name: newCustomer.name, phone: normalizedPhone },
    });

    return newCustomer;
  }

  static async createCustomer(input: CreateCustomerInput, actorUserId?: string) {
    const existing = await prisma.customer.findUnique({ where: { code: input.code } });
    if (existing) throw new Error(`Customer code '${input.code}' already exists.`);

    const newCustomer = await prisma.customer.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        phone: input.phone ? this.normalizePhone(input.phone) : null,
        email: input.email || null,
        is_b2b: input.isB2b ?? false,
        credit_limit: input.creditLimit ?? 0,
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'CUSTOMER_CREATED',
      entity: 'Customer',
      entityId: newCustomer.id,
      newValues: { code: newCustomer.code, name: newCustomer.name, isB2b: input.isB2b },
    });

    return newCustomer;
  }

  static async updateCustomer(id: string, input: UpdateCustomerInput, actorUserId?: string) {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new Error('Customer not found.');

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        code: input.code ? input.code.toUpperCase() : customer.code,
        name: input.name ?? customer.name,
        phone: input.phone !== undefined ? (input.phone ? this.normalizePhone(input.phone) : null) : customer.phone,
        email: input.email !== undefined ? input.email : customer.email,
        is_b2b: input.isB2b !== undefined ? input.isB2b : customer.is_b2b,
        credit_limit: input.creditLimit !== undefined ? input.creditLimit : customer.credit_limit,
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'CUSTOMER_UPDATED',
      entity: 'Customer',
      entityId: id,
      newValues: { name: updated.name, creditLimit: updated.credit_limit },
    });

    return updated;
  }
}
