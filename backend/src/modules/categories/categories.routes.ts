import { Router } from 'express';
import { CategoriesController } from './categories.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['catalog:view']), CategoriesController.getCategories);
router.post('/', authorize(['catalog:manage']), CategoriesController.createCategory);

export default router;
