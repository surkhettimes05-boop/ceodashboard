import { Router } from 'express';
import { AnalyticsController } from './analytics.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/dashboard', authorize(['dashboard:view']), AnalyticsController.getExecutiveDashboard);
router.get('/customer-experience/:storeId', authorize(['FEEDBACK_VIEW', 'COMPLAINT_VIEW']), AnalyticsController.getCustomerExperienceMetrics);
router.get('/customer-loyalty', authorize(['LOYALTY_VIEW', 'dashboard:view']), AnalyticsController.getCustomerLoyaltyMetrics);

export default router;
