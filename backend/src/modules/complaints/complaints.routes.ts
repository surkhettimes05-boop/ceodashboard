import { Router } from 'express';
import { ComplaintsController } from './complaints.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

// Complaint CRUD operations
router.post('/', authorize(['COMPLAINT_MANAGE']), ComplaintsController.createComplaint);
router.get('/', authorize(['COMPLAINT_VIEW']), ComplaintsController.getComplaints);
router.get('/stats', authorize(['COMPLAINT_VIEW']), ComplaintsController.getComplaintStats);
router.get('/:id', authorize(['COMPLAINT_VIEW']), ComplaintsController.getComplaint);

// Complaint workflow operations
router.put('/:id/assign', authorize(['COMPLAINT_MANAGE']), ComplaintsController.assignComplaint);
router.put('/:id/status', authorize(['COMPLAINT_MANAGE']), ComplaintsController.updateStatus);
router.put('/:id/resolve', authorize(['COMPLAINT_MANAGE']), ComplaintsController.addResolution);
router.put('/:id/close', authorize(['COMPLAINT_MANAGE']), ComplaintsController.closeComplaint);

export default router;
