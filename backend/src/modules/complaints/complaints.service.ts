import { prisma } from '../../db/prisma.js';
import { AuditService } from '../audit/audit.service.js';

const COMPLAINT_CATEGORIES = [
  'Product Quality',
  'Service Quality',
  'Staff Behavior',
  'Pricing',
  'Delivery',
  'Store Environment',
  'Payment Issues',
  'Other',
] as const;

export class ComplaintsService {
  /**
   * Generate ticket number
   */
  static generateTicketNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `TKT-${timestamp}-${random}`;
  }

  /**
   * Create a new complaint
   */
  static async createComplaint(
    customerId: string | null,
    transactionId: string | null,
    storeId: string,
    category: string,
    description: string,
    priority: string = 'MEDIUM',
    actorUserId?: string
  ) {
    const ticketNumber = this.generateTicketNumber();

    const complaint = await (prisma as any).complaint.create({
      data: {
        ticket_number: ticketNumber,
        customer_id: customerId,
        transaction_id: transactionId,
        store_id: storeId,
        category,
        description,
        priority,
        status: 'OPEN',
      },
    });

    // Audit log
    await AuditService.log({
      userId: actorUserId,
      action: 'COMPLAINT_CREATED',
      entity: 'Complaint',
      entityId: complaint.id,
      newValues: { ticketNumber, category, priority },
    });

    return complaint;
  }

  /**
   * Assign complaint to a user
   */
  static async assignComplaint(complaintId: string, assignedTo: string, actorUserId?: string) {
    const complaint = await (prisma as any).complaint.update({
      where: { id: complaintId },
      data: {
        assigned_to: assignedTo,
        status: 'ASSIGNED',
      },
    });

    // Audit log
    await AuditService.log({
      userId: actorUserId,
      action: 'COMPLAINT_ASSIGNED',
      entity: 'Complaint',
      entityId: complaintId,
      newValues: { assignedTo, status: 'ASSIGNED' },
    });

    return complaint;
  }

  /**
   * Update complaint status
   */
  static async updateStatus(complaintId: string, status: string, actorUserId?: string) {
    const complaint = await (prisma as any).complaint.update({
      where: { id: complaintId },
      data: { status },
    });

    // Audit log
    await AuditService.log({
      userId: actorUserId,
      action: 'COMPLAINT_STATUS_UPDATED',
      entity: 'Complaint',
      entityId: complaintId,
      newValues: { status },
    });

    return complaint;
  }

  /**
   * Add resolution to complaint
   */
  static async addResolution(complaintId: string, resolution: string, actorUserId?: string) {
    const complaint = await (prisma as any).complaint.update({
      where: { id: complaintId },
      data: {
        resolution,
        status: 'RESOLVED',
        resolved_at: new Date(),
      },
    });

    // Audit log
    await AuditService.log({
      userId: actorUserId,
      action: 'COMPLAINT_RESOLVED',
      entity: 'Complaint',
      entityId: complaintId,
      newValues: { resolution, status: 'RESOLVED' },
    });

    return complaint;
  }

  /**
   * Close complaint
   */
  static async closeComplaint(complaintId: string, actorUserId?: string) {
    const complaint = await (prisma as any).complaint.update({
      where: { id: complaintId },
      data: {
        status: 'CLOSED',
        closed_at: new Date(),
      },
    });

    // Audit log
    await AuditService.log({
      userId: actorUserId,
      action: 'COMPLAINT_CLOSED',
      entity: 'Complaint',
      entityId: complaintId,
      newValues: { status: 'CLOSED' },
    });

    return complaint;
  }

  /**
   * Get complaints for a store (filtered by role)
   */
  static async getComplaints(storeId?: string, status?: string, userId?: string) {
    const where: any = {};

    if (storeId) where.store_id = storeId;
    if (status) where.status = status;
    
    // If user is not admin/CEO, only show assigned or unassigned complaints for their store
    if (userId) {
      // This would be enhanced with role checking
      // For now, return all for the store
    }

    const complaints = await (prisma as any).complaint.findMany({
      where,
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
        store: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return complaints;
  }

  /**
   * Get single complaint
   */
  static async getComplaint(complaintId: string) {
    const complaint = await (prisma as any).complaint.findUnique({
      where: { id: complaintId },
      include: {
        customer: true,
        transaction: {
          select: {
            sale_number: true,
            created_at: true,
            total_amount: true,
          },
        },
        store: true,
      },
    });

    if (!complaint) {
      throw new Error('Complaint not found');
    }

    return complaint;
  }

  /**
   * Get complaint statistics for a store
   */
  static async getComplaintStats(storeId?: string, startDate?: Date, endDate?: Date) {
    const where: any = {};
    
    if (storeId) where.store_id = storeId;
    
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = startDate;
      if (endDate) where.created_at.lte = endDate;
    }

    const complaints = await (prisma as any).complaint.findMany({ where });

    const total = complaints.length;
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const c of complaints) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byPriority[c.priority] = (byPriority[c.priority] || 0) + 1;
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    }

    const open = byStatus.OPEN || 0;
    const resolved = byStatus.RESOLVED || 0;
    const closed = byStatus.CLOSED || 0;

    return {
      total,
      open,
      resolved,
      closed,
      byStatus,
      byPriority,
      byCategory,
    };
  }
}
