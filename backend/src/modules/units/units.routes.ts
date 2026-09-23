import { Router } from 'express';
import { UnitsController } from './units.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['catalog:view']), UnitsController.getUnits);
router.post('/', authorize(['catalog:manage']), UnitsController.createUnit);

export default router;
