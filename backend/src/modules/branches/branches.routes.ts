import { Router } from 'express';
import { BranchesController } from './branches.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['branches:view']), BranchesController.getBranches);
router.get('/:id', authorize(['branches:view']), BranchesController.getBranchById);
router.post('/', authorize(['branches:manage']), BranchesController.createBranch);
router.put('/:id', authorize(['branches:manage']), BranchesController.updateBranch);

export default router;
