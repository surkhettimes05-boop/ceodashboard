import { Response } from 'express';
import { SalesService } from './sales.service.js';
import { createSaleSchema } from './sales.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { SalesReturnsService } from './sales-returns.service.js';
import { createReturnSchema } from './sales.schema.js';

export class SalesController {
  static async getPaymentSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const now = new Date();
      const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
        return sendError(res, 'Invalid date range', 400);
      }

      const requestedBranchId = req.query.branchId ? String(req.query.branchId) : undefined;
      if (req.user?.role === 'CASHIER' && !req.user.branchId) {
        return sendError(res, 'Cashier is not assigned to a branch', 403);
      }
      const branchId = req.user?.role === 'CASHIER' ? req.user.branchId || undefined : requestedBranchId;
      const summary = await SalesService.getPaymentSummary(startDate, endDate, branchId);
      return sendSuccess(res, summary, 'Sales payment summary retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve sales payment summary', 500);
    }
  }

  static async getSales(req: AuthenticatedRequest, res: Response) {
    try {
      // Cashiers can only view their own sales; Admins/CEOs can view all
      const cashierId = req.user?.role === 'CASHIER' ? req.user.id : undefined;
      const sales = await SalesService.getSales(cashierId);
      return sendSuccess(res, sales, 'Sales history retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve sales', 500);
    }
  }

  static async getSaleById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const sale = await SalesService.getSaleById(id);
      return sendSuccess(res, sale, 'Sale transaction details');
    } catch (err: any) {
      return sendError(res, err.message || 'Sale transaction not found', 404);
    }
  }

  static async createSale(req: AuthenticatedRequest, res: Response) {
    try {
      const idempotencyKey = req.get('Idempotency-Key');
      if (!idempotencyKey) {
        return sendError(res, 'Idempotency-Key header is required for sales', 400);
      }
      const input = createSaleSchema.parse(req.body);
      const cashierId = req.user?.id || 'system';
      const sale = await IdempotencyService.withIdempotency(
        idempotencyKey,
        'POST /sales',
        () => SalesService.createSaleTransaction(input, cashierId, {
          role: req.user?.role,
          branchId: req.user?.branchId,
        })
      );
      return sendSuccess(res, sale, 'Sale completed successfully', 201);
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        const details = err.issues.map((issue: any) => `${issue.path.join('.') || 'payload'}: ${issue.message}`).join('; ');
        return sendError(res, `Invalid sale request: ${details}`, 400);
      }
      const statusCode = err.message?.includes('already in progress') ? 409 : 400;
      return sendError(res, err.message || 'Sale transaction failed and rolled back', statusCode);
    }
  }

  static async voidSale(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { reason } = req.body;
      const userId = req.user?.id || 'system';
      
      if (!reason || reason.trim().length === 0) {
        return sendError(res, 'Reason is required for voiding a sale', 400);
      }

      const voidedSale = await SalesService.voidSale(id, userId, reason);
      return sendSuccess(res, voidedSale, 'Sale voided successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to void sale', 400);
    }
  }

  static async getReturns(req: AuthenticatedRequest, res: Response) {
    try {
      const returns = await SalesReturnsService.getReturns();
      return sendSuccess(res, returns, 'Sales returns retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve returns', 500);
    }
  }

  static async createReturn(req: AuthenticatedRequest, res: Response) {
    try {
      const input = createReturnSchema.parse(req.body);
      const returnRecord = await SalesReturnsService.createReturn(input, req.user?.id || 'system');
      return sendSuccess(res, returnRecord, 'Sales return processed successfully', 201);
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        const details = err.issues.map((issue: any) => `${issue.path.join('.') || 'payload'}: ${issue.message}`).join('; ');
        return sendError(res, `Invalid return request: ${details}`, 400);
      }
      return sendError(res, err.message || 'Failed to process return', 400);
    }
  }
}
