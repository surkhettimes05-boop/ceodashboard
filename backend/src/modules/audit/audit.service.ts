import { prisma } from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';

export interface AuditLogOptions {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
}

export class AuditService {
  static async log(options: AuditLogOptions, database: any = prisma) {
    try {
      await database.auditLog.create({
        data: {
          user_id: options.userId,
          action: options.action,
          entity: options.entity,
          entity_id: options.entityId,
          old_values: options.oldValues ? JSON.stringify(options.oldValues) : null,
          new_values: options.newValues ? JSON.stringify(options.newValues) : null,
          ip_address: options.ipAddress || null,
        },
      });
    } catch (err) {
      logger.error('Failed to write audit record', err as Error, { action: options.action, entity: options.entity });
    }
  }
}
