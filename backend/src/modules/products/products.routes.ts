import { Router } from 'express';
import { ProductsController } from './products.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['catalog:view']), ProductsController.getProducts);
router.get('/:id', authorize(['catalog:view']), ProductsController.getProductById);
router.post('/', authorize(['catalog:manage']), ProductsController.createProduct);
router.put('/:id', authorize(['catalog:manage']), ProductsController.updateProduct);

export default router;
