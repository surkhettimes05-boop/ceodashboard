import { Router } from 'express';
import { SalesController } from './sales.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/summary/payment-methods', authorize(['sales:view']), SalesController.getPaymentSummary);
router.get('/returns', authorize(['sales:view']), SalesController.getReturns);
router.post('/returns', authorize(['sales:refund']), SalesController.createReturn);
router.get('/', authorize(['sales:view']), SalesController.getSales);
router.get('/:id', authorize(['sales:view']), SalesController.getSaleById);
router.post('/', authorize(['sales:create']), SalesController.createSale);
router.post('/:id/void', authorize(['sales:void']), SalesController.voidSale);

export default router;
