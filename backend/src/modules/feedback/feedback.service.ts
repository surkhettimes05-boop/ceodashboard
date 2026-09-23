import { sign, verify } from 'jsonwebtoken';
import { prisma } from '../../db/prisma.js';
import { config } from '../../config/index.js';

const FEEDBACK_TOKEN_SECRET = config.feedbackTokenSecret;
const FEEDBACK_TOKEN_EXPIRY = '7d'; // Feedback valid for 7 days

export interface FeedbackTokenPayload {
  transactionId: string;
  storeId: string;
  timestamp: number;
}

export class FeedbackService {
  /**
   * Generate feedback token for a transaction
   */
  static generateFeedbackToken(transactionId: string, storeId: string): string {
    const payload: FeedbackTokenPayload = {
      transactionId,
      storeId,
      timestamp: Date.now(),
    };

    return sign(payload, FEEDBACK_TOKEN_SECRET, { expiresIn: FEEDBACK_TOKEN_EXPIRY });
  }

  /**
   * Validate and decode feedback token
   */
  static validateFeedbackToken(token: string): FeedbackTokenPayload | null {
    try {
      const decoded = verify(token, FEEDBACK_TOKEN_SECRET) as FeedbackTokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Submit feedback for a transaction
   */
  static async submitFeedback(
    token: string,
    rating: number,
    category: string,
    comment?: string,
    photoUrl?: string
  ) {
    const payload = this.validateFeedbackToken(token);
    if (!payload) {
      throw new Error('Invalid or expired feedback token');
    }

    // Verify transaction exists
    const sale = await prisma.sale.findUnique({
      where: { id: payload.transactionId },
      include: { customer: true },
    });

    if (!sale) {
      throw new Error('Transaction not found');
    }

    // Check if feedback already exists for this transaction
    const existing = await (prisma as any).feedback.findFirst({
      where: { transaction_id: payload.transactionId },
    });

    if (existing) {
      throw new Error('Feedback already submitted for this transaction');
    }

    // Create feedback record
    const feedback = await (prisma as any).feedback.create({
      data: {
        transaction_id: payload.transactionId,
        customer_id: sale.customer_id,
        store_id: payload.storeId,
        rating,
        category,
        comment: comment || null,
        photo_url: photoUrl || null,
      },
    });

    return feedback;
  }

  /**
   * Get feedback for a transaction (admin)
   */
  static async getFeedbackByTransaction(transactionId: string) {
    const feedback = await (prisma as any).feedback.findFirst({
      where: { transaction_id: transactionId },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
        transaction: {
          select: {
            sale_number: true,
            created_at: true,
          },
        },
      },
    });

    return feedback;
  }

  /**
   * Get feedback summary for a store
   */
  static async getStoreFeedbackSummary(storeId: string, startDate?: Date, endDate?: Date) {
    const where: any = { store_id: storeId };
    
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = startDate;
      if (endDate) where.created_at.lte = endDate;
    }

    const feedbacks = await (prisma as any).feedback.findMany({
      where,
    });

    const total = feedbacks.length;
    if (total === 0) {
      return {
        total,
        averageRating: 0,
        byRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        byCategory: {},
      };
    }

    const sum = feedbacks.reduce((acc: number, f: any) => acc + f.rating, 0);
    const averageRating = sum / total;

    const byRating = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const byCategory: Record<string, number> = {};

    for (const f of feedbacks) {
      byRating[f.rating as keyof typeof byRating]++;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    }

    return {
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      byRating,
      byCategory,
    };
  }
}
