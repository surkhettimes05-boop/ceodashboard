import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import mfaRoutes from './mfa.routes.js';

const router = Router();

router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.get('/me', authenticate, AuthController.me);
router.post('/logout', authenticate, AuthController.logout);

// MFA routes
router.use('/mfa', mfaRoutes);

export default router;
