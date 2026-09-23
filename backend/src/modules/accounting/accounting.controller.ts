import { Response } from 'express';
import { AccountingService } from './accounting.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class AccountingController {
  static async getAccounts(req: AuthenticatedRequest, res: Response) {
    try {
      const accounts = await AccountingService.getAccounts();
      return sendSuccess(res, accounts, 'Chart of Accounts retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve accounts', 500);
    }
  }

  static async getGeneralLedger(req: AuthenticatedRequest, res: Response) {
    try {
      const accountId = req.query.accountId as string;
      const ledger = await AccountingService.getGeneralLedger(accountId);
      return sendSuccess(res, ledger, 'General Ledger entries retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve ledger', 500);
    }
  }

  static async getProfitAndLoss(req: AuthenticatedRequest, res: Response) {
    try {
      const pnl = await AccountingService.getProfitAndLoss();
      return sendSuccess(res, pnl, 'Profit and Loss statement');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to generate P&L statement', 500);
    }
  }

  static async getTrialBalance(req: AuthenticatedRequest, res: Response) {
    try {
      const tb = await AccountingService.getTrialBalance();
      return sendSuccess(res, tb, 'Trial Balance statement');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to generate Trial Balance', 500);
    }
  }
}
