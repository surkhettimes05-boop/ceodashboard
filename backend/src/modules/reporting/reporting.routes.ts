import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { ReportingController } from './reporting.controller.js';

const router = Router();
router.use(authenticate);
router.get('/daily-summary', authorize(['dashboard:view']), ReportingController.getDailySummary);

export default router;