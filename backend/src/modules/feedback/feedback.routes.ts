import { Router } from 'express';
import { FeedbackController } from './feedback.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// Public endpoint for feedback submission (no authentication required)
router.post('/submit', FeedbackController.submitFeedback);

// Token validation (public)
router.get('/validate/:token', FeedbackController.validateToken);

// Admin endpoints (require authentication)
router.use(authenticate);
router.get('/transaction/:id', authorize(['FEEDBACK_VIEW']), FeedbackController.getFeedbackByTransaction);
router.get('/summary/:storeId', authorize(['FEEDBACK_VIEW']), FeedbackController.getStoreFeedbackSummary);

export default router;
