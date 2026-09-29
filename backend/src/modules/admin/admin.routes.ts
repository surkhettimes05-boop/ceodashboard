import { Router } from 'express';
import { ProductsController } from '../products/products.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.post('/products/sync-pasalo', authorize(['catalog:manage']), ProductsController.syncPasaloCatalog);
router.post('/products/:id/link-pasalo', authorize(['catalog:manage']), ProductsController.linkPasaloProduct);

export default router;
