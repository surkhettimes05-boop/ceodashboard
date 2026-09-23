import { Router } from 'express';
import { RolesController } from './roles.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/roles', RolesController.getRoles);
router.get('/permissions', RolesController.getPermissions);

export default router;
