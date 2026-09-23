import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export interface IdempotencyResult {
  isDuplicate: boolean;
  cachedResponse?: any;
  key?: string;
}

export class IdempotencyService {
  static async claimKey(key: string, endpoint: string, ttlHours: number = 24): Promise<IdempotencyResult> {
    await this.cleanupExpiredKeys();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    try {
      await prisma.idempotencyKey.create({
        data: { key, endpoint, status: 'PROCESSING', expires_at: expiresAt },
      });
      return { isDuplicate: false, key };
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;

      const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
      if (!existing || existing.endpoint !== endpoint) {
        throw new Error('Idempotency key is already used for another endpoint.');
      }
      if (existing.status === 'PROCESSED') {
        return { isDuplicate: true, cachedResponse: existing.response_body, key: existing.key };
      }
      if (existing.status === 'PROCESSING') {
        throw new Error('A request with this idempotency key is already in progress.');
      }

      await prisma.idempotencyKey.update({
        where: { id: existing.id },
        data: { status: 'PROCESSING', response_body: Prisma.JsonNull, expires_at: expiresAt },
      });
      return { isDuplicate: false, key };
    }
  }

  /**
   * Check if an idempotency key exists and return cached response if it does
   * Keys expire after 24 hours by default
   */
  static async checkKey(key: string, endpoint: string): Promise<IdempotencyResult> {
    // Clean up expired keys first
    await this.cleanupExpiredKeys();

    const existing = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      if (existing.expires_at < new Date()) {
        // Key expired, delete it
        await prisma.idempotencyKey.delete({ where: { id: existing.id } });
        return { isDuplicate: false };
      }

      if (existing.endpoint === endpoint && existing.status === 'PROCESSED') {
        return {
          isDuplicate: true,
          cachedResponse: existing.response_body,
          key: existing.key,
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Store a response for an idempotency key
   */
  static async storeKey(key: string, endpoint: string, response: any, ttlHours: number = 24) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    return prisma.idempotencyKey.create({
      data: {
        key,
        endpoint,
        response_body: response as any,
        status: 'PROCESSED',
        expires_at: expiresAt,
      },
    });
  }

  /**
   * Mark a key as failed (for retry scenarios)
   */
  static async markFailed(key: string, endpoint: string) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Failed keys expire in 1 hour

    return prisma.idempotencyKey.create({
      data: {
        key,
        endpoint,
        status: 'FAILED',
        expires_at: expiresAt,
      },
    });
  }

  /**
   * Clean up expired idempotency keys
   */
  static async cleanupExpiredKeys() {
    const result = await prisma.idempotencyKey.deleteMany({
      where: {
        expires_at: { lt: new Date() },
      },
    });
    return result.count;
  }

  /**
   * Generate a unique idempotency key from request parameters
   */
  static generateKey(userId: string, endpoint: string, params: any): string {
    const paramsStr = JSON.stringify(params);
    const timestamp = Date.now();
    const base = `${userId}:${endpoint}:${paramsStr}:${timestamp}`;
    // Simple hash - in production use crypto.createHash
    return Buffer.from(base).toString('base64').substring(0, 64);
  }

  /**
   * Middleware wrapper for idempotent operations
   */
  static async withIdempotency<T>(
    key: string,
    endpoint: string,
    operation: () => Promise<T>,
    ttlHours?: number
  ): Promise<T> {
    const checkResult = await this.claimKey(key, endpoint, ttlHours);

    if (checkResult.isDuplicate && checkResult.cachedResponse) {
      return checkResult.cachedResponse as T;
    }

    try {
      const result = await operation();
      await prisma.idempotencyKey.update({
        where: { key },
        data: { status: 'PROCESSED', response_body: result as any },
      });
      return result;
    } catch (error) {
      await prisma.idempotencyKey.updateMany({
        where: { key, endpoint },
        data: { status: 'FAILED', response_body: Prisma.JsonNull },
      });
      throw error;
    }
  }

  /**
   * Get statistics on idempotency key usage
   */
  static async getStats() {
    const total = await prisma.idempotencyKey.count();
    const processed = await prisma.idempotencyKey.count({
      where: { status: 'PROCESSED' },
    });
    const failed = await prisma.idempotencyKey.count({
      where: { status: 'FAILED' },
    });
    const expired = await prisma.idempotencyKey.count({
      where: { expires_at: { lt: new Date() } },
    });

    return {
      total,
      processed,
      failed,
      expired,
      hitRate: total > 0 ? (processed / total) * 100 : 0,
    };
  }
}
