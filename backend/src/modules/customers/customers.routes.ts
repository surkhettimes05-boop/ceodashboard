import { Router } from 'express';
import { CustomersController } from './customers.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['CUSTOMER_LOOKUP']), CustomersController.getCustomers);
router.get('/:id', authorize(['CUSTOMER_VIEW']), CustomersController.getCustomerById);
router.get('/:id/loyalty', authorize(['LOYALTY_VIEW']), CustomersController.getLoyaltySummary);
router.get('/lookup/phone', authorize(['CUSTOMER_LOOKUP']), CustomersController.lookupByPhone);
router.post('/', authorize(['CUSTOMER_VIEW']), CustomersController.createCustomer);
router.post('/pos-create', authorize(['CUSTOMER_CREATE_POS']), CustomersController.createFromPOS);
router.put('/:id', authorize(['CUSTOMER_VIEW']), CustomersController.updateCustomer);

export default router;
