import { Router } from 'express';
import { AccountingController } from './accounting.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/accounts', authorize(['accounting:view']), AccountingController.getAccounts);
router.get('/ledger', authorize(['accounting:view']), AccountingController.getGeneralLedger);
router.get('/reports/profit-loss', authorize(['accounting:view']), AccountingController.getProfitAndLoss);
router.get('/reports/trial-balance', authorize(['accounting:view']), AccountingController.getTrialBalance);

export default router;
