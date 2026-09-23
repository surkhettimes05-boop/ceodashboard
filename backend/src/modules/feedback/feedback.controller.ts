import { Response } from 'express';
import { FeedbackService } from './feedback.service.js';
import { submitFeedbackSchema } from './feedback.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class FeedbackController {
  static async validateToken(req: AuthenticatedRequest, res: Response) {
    try {
      const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
      const payload = FeedbackService.validateFeedbackToken(token);
      
      if (!payload) {
        return sendError(res, 'Invalid or expired token', 400);
      }

      return sendSuccess(res, { valid: true, transactionId: payload.transactionId, storeId: payload.storeId }, 'Token is valid');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to validate token', 500);
    }
  }

  static async submitFeedback(req: AuthenticatedRequest, res: Response) {
    try {
      const input = submitFeedbackSchema.parse(req.body);
      const feedback = await FeedbackService.submitFeedback(
        input.token,
        input.rating,
        input.category,
        input.comment,
        input.photoUrl
      );
      return sendSuccess(res, feedback, 'Feedback submitted successfully', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to submit feedback', 400);
    }
  }

  static async getFeedbackByTransaction(req: AuthenticatedRequest, res: Response) {
    try {
      const transactionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const feedback = await FeedbackService.getFeedbackByTransaction(transactionId);
      
      if (!feedback) {
        return sendSuccess(res, null, 'No feedback found');
      }

      return sendSuccess(res, feedback, 'Feedback retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve feedback', 500);
    }
  }

  static async getStoreFeedbackSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const storeId = Array.isArray(req.params.storeId) ? req.params.storeId[0] : req.params.storeId;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const summary = await FeedbackService.getStoreFeedbackSummary(storeId, startDate, endDate);
      return sendSuccess(res, summary, 'Feedback summary retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve feedback summary', 500);
    }
  }
}
