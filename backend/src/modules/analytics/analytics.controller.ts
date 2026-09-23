import { Response } from 'express';
import { AnalyticsService } from './analytics.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class AnalyticsController {
  static async getExecutiveDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const range = (req.query.range as string) || 'this_month';
      const branchId = req.query.branchId as string;
      const resolvedRange = AnalyticsService.resolveDateRange(range);

      const metrics = await AnalyticsService.getExecutiveDashboard({
        startDate: resolvedRange.startDate,
        endDate: resolvedRange.endDate,
        branchId,
      });

      return sendSuccess(res, {
        ...metrics,
        dateRange: {
          label: resolvedRange.label,
          startDate: resolvedRange.startDate,
          endDate: resolvedRange.endDate,
        },
      }, 'CEO Executive Dashboard metrics');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to generate dashboard metrics', 500);
    }
  }

  static async getCustomerExperienceMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const storeId = Array.isArray(req.params.storeId) ? req.params.storeId[0] : req.params.storeId;
      const dateRange = (req.query.range as string) || 'this_month';
      
      const metrics = await AnalyticsService.getCustomerExperienceMetrics(storeId, dateRange);
      return sendSuccess(res, metrics, 'Customer experience metrics retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve customer experience metrics', 500);
    }
  }

  static async getCustomerLoyaltyMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const dateRange = (req.query.range as string) || 'this_month';
      
      const metrics = await AnalyticsService.getCustomerLoyaltyMetrics(dateRange);
      return sendSuccess(res, metrics, 'Customer loyalty metrics retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve customer loyalty metrics', 500);
    }
  }
}
