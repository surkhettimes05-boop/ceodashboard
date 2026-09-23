import { Router } from 'express';
import { SuppliersController } from './suppliers.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['suppliers:view']), SuppliersController.getSuppliers);
router.get('/:id', authorize(['suppliers:view']), SuppliersController.getSupplierById);
router.post('/', authorize(['suppliers:manage']), SuppliersController.createSupplier);
router.put('/:id', authorize(['suppliers:manage']), SuppliersController.updateSupplier);

export default router;
