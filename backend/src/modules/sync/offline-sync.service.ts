import { prisma } from '../../db/prisma.js';
import { OfflineQueueStatus, SyncStatus } from '@prisma/client';
import { SalesService } from '../sales/sales.service.js';
import { SalesReturnsService } from '../sales/sales-returns.service.js';

export class OfflineSyncService {
  /**
   * Queue an offline operation for later sync
   */
  static async queueOperation(deviceId: string, operationType: string, payload: any) {
    return prisma.offlineQueue.create({
      data: {
        device_id: deviceId,
        operation_type: operationType,
        payload: payload as any,
        status: OfflineQueueStatus.PENDING,
      },
    });
  }

  /**
   * Sync pending operations for a device
   */
  static async syncDevice(deviceId: string) {
    const pendingOps = await prisma.offlineQueue.findMany({
      where: {
        device_id: deviceId,
        status: OfflineQueueStatus.PENDING,
      },
      orderBy: { created_at: 'asc' },
    });

    if (pendingOps.length === 0) {
      return { synced: 0, failed: 0, conflicts: 0 };
    }

    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    for (const op of pendingOps) {
      try {
        await this.processOperation(op);
        await prisma.offlineQueue.update({
          where: { id: op.id },
          data: {
            status: OfflineQueueStatus.SYNCED,
            synced_at: new Date(),
          },
        });
        synced++;
      } catch (error: any) {
        if (error.message.includes('conflict') || error.message.includes('duplicate')) {
          await prisma.offlineQueue.update({
            where: { id: op.id },
            data: {
              status: OfflineQueueStatus.CONFLICT,
              error_message: error.message,
              retry_count: { increment: 1 },
            },
          });
          conflicts++;
        } else {
          await prisma.offlineQueue.update({
            where: { id: op.id },
            data: {
              status: OfflineQueueStatus.FAILED,
              error_message: error.message,
              retry_count: { increment: 1 },
            },
          });
          failed++;
        }
      }
    }

    // Update device sync status
    const deviceSync = await prisma.deviceSync.upsert({
      where: { device_id: deviceId },
      update: {
        last_sync_at: new Date(),
        sync_status: SyncStatus.SYNCED,
        pending_count: { decrement: synced + conflicts + failed },
        failed_count: { increment: failed },
      },
      create: {
        device_id: deviceId,
        last_sync_at: new Date(),
        sync_status: SyncStatus.SYNCED,
        pending_count: 0,
        failed_count: failed,
      },
    });

    return { synced, failed, conflicts, deviceSync };
  }

  /**
   * Process a single offline operation
   */
  private static async processOperation(op: any) {
    const payload = op.payload as any;

    switch (op.operation_type) {
      case 'SALE':
        // Process offline sale
        await SalesService.createSaleTransaction(payload, payload.cashierId || 'system');
        break;
      case 'RETURN':
        // Process offline return
        await SalesReturnsService.createReturn(payload, payload.userId || 'system');
        break;
      case 'ADJUSTMENT':
        // Process inventory adjustment (would need inventory service)
        // await InventoryService.recordMovementTx(...)
        break;
      default:
        throw new Error(`Unknown operation type: ${op.operation_type}`);
    }
  }

  /**
   * Get pending operations for a device
   */
  static async getPendingOperations(deviceId: string) {
    return prisma.offlineQueue.findMany({
      where: {
        device_id: deviceId,
        status: OfflineQueueStatus.PENDING,
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Get failed operations for retry
   */
  static async getFailedOperations(deviceId: string) {
    return prisma.offlineQueue.findMany({
      where: {
        device_id: deviceId,
        status: { in: [OfflineQueueStatus.FAILED, OfflineQueueStatus.CONFLICT] },
        retry_count: { lt: 3 }, // Max 3 retries
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Resolve a conflict by accepting the server version
   */
  static async resolveConflict(queueId: string, resolution: string, userId: string) {
    const op = await prisma.offlineQueue.findUnique({ where: { id: queueId } });
    if (!op) throw new Error('Operation not found.');
    if (op.status !== OfflineQueueStatus.CONFLICT) {
      throw new Error('Only conflicts can be resolved.');
    }

    if (resolution === 'RETRY') {
      await prisma.offlineQueue.update({
        where: { id: queueId },
        data: {
          status: OfflineQueueStatus.PENDING,
          error_message: null,
          conflict_resolution: `Retried by ${userId} at ${new Date().toISOString()}`,
        },
      });
    } else if (resolution === 'DISCARD') {
      await prisma.offlineQueue.update({
        where: { id: queueId },
        data: {
          status: OfflineQueueStatus.FAILED,
          conflict_resolution: `Discarded by ${userId} at ${new Date().toISOString()}`,
        },
      });
    } else {
      throw new Error(`Unknown resolution: ${resolution}`);
    }

    return prisma.offlineQueue.findUnique({ where: { id: queueId } });
  }

  /**
   * Get sync status for all devices
   */
  static async getAllDeviceSyncStatus() {
    return prisma.deviceSync.findMany({
      orderBy: { last_sync_at: 'desc' },
    });
  }

  /**
   * Get device sync status
   */
  static async getDeviceSyncStatus(deviceId: string) {
    return prisma.deviceSync.findUnique({
      where: { device_id: deviceId },
    });
  }

  /**
   * Mark device as going offline
   */
  static async markDeviceOffline(deviceId: string) {
    return prisma.deviceSync.upsert({
      where: { device_id: deviceId },
      update: {
        sync_status: SyncStatus.PENDING,
      },
      create: {
        device_id: deviceId,
        sync_status: SyncStatus.PENDING,
      },
    });
  }

  /**
   * Get sync summary
   */
  static async getSyncSummary() {
    const pending = await prisma.offlineQueue.count({
      where: { status: OfflineQueueStatus.PENDING },
    });
    const failed = await prisma.offlineQueue.count({
      where: { status: OfflineQueueStatus.FAILED },
    });
    const conflicts = await prisma.offlineQueue.count({
      where: { status: OfflineQueueStatus.CONFLICT },
    });
    const synced = await prisma.offlineQueue.count({
      where: { status: OfflineQueueStatus.SYNCED },
    });

    return {
      pending,
      failed,
      conflicts,
      synced,
      total: pending + failed + conflicts + synced,
    };
  }
}
