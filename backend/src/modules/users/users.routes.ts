import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['users:view']), UsersController.getUsers);
router.get('/:id', authorize(['users:view']), UsersController.getUserById);
router.post('/', authorize(['users:create']), UsersController.createUser);
router.put('/:id', authorize(['users:edit']), UsersController.updateUser);

export default router;
