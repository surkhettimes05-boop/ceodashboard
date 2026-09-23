import { Router } from 'express';
import { LoyaltyController } from './loyalty.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

// Settings (Admin only)
router.get('/settings', authorize(['LOYALTY_SETTINGS']), LoyaltyController.getSettings);
router.put('/settings', authorize(['LOYALTY_SETTINGS']), LoyaltyController.updateSettings);
router.get('/preview', authorize(['LOYALTY_VIEW']), LoyaltyController.previewPoints);

// Customer loyalty operations
router.get('/ledger/:id', authorize(['LOYALTY_VIEW']), LoyaltyController.getLoyaltyLedger);
router.get('/balance/:id', authorize(['LOYALTY_VIEW']), LoyaltyController.getLoyaltyBalance);

// Point operations
router.post('/redeem', authorize(['LOYALTY_REDEEM']), LoyaltyController.redeemPoints);
router.post('/adjust', authorize(['LOYALTY_ADJUSTMENT']), LoyaltyController.adjustPoints);

export default router;
