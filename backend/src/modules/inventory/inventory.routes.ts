import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/balances', authorize(['inventory:view']), InventoryController.getBalances);
router.get('/transactions', authorize(['inventory:view']), InventoryController.getTransactions);
router.get('/low-stock', authorize(['inventory:view']), InventoryController.getLowStockAlerts);
router.get('/transfers', authorize(['inventory:view']), InventoryController.getTransfers);
router.post('/adjustments', authorize(['inventory:adjust']), InventoryController.createAdjustment);
router.post('/transfers', authorize(['inventory:transfer']), InventoryController.createTransfer);
router.post('/transfers/:id/receive', authorize(['inventory:transfer']), InventoryController.receiveTransfer);

export default router;
