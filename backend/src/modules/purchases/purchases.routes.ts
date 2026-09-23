import { Router } from 'express';
import { PurchasesController } from './purchases.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['purchases:view']), PurchasesController.getPurchases);
router.get('/:id', authorize(['purchases:view']), PurchasesController.getPurchaseById);
router.post('/', authorize(['purchases:create']), PurchasesController.createPurchase);
router.post('/:id/receive', authorize(['purchases:receive']), PurchasesController.receivePurchase);

export default router;
