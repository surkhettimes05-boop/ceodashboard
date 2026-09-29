import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { sendError, sendSuccess } from '../../utils/response.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { ReportingService } from './reporting.service.js';

export class ReportingController {
  static async getDailySummary(req: AuthenticatedRequest, res: Response) {
    try {
      const range = (req.query.range as string) || 'today';
      const resolvedRange = AnalyticsService.resolveDateRange(range);
      const requestedBranchId = req.query.branchId as string | undefined;
      const scoped = req.user?.role !== 'CEO' && req.user?.role !== 'ADMIN';
      if (scoped && (!req.user?.branchId || (requestedBranchId && requestedBranchId !== req.user.branchId))) return sendError(res, 'Access to another store is forbidden.', 403);
      const summary = await ReportingService.getDailySummary(
        resolvedRange.startDate,
        resolvedRange.endDate,
        resolvedRange.label,
        scoped ? req.user!.branchId! : requestedBranchId
      );
      return sendSuccess(res, summary, 'CEO daily reporting summary');
    } catch (error) {
      return sendError(res, error instanceof Error ? error.message : 'Failed to generate daily reporting summary', 502);
    }
  }
}
