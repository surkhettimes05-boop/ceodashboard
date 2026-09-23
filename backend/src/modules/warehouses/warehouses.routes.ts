import { Router } from 'express';
import { WarehousesController } from './warehouses.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['warehouses:view']), WarehousesController.getWarehouses);
router.post('/', authorize(['warehouses:manage']), WarehousesController.createWarehouse);

export default router;
