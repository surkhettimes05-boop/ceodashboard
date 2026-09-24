import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { correlationMiddleware } from './middleware/correlation.middleware.js';
import { applyRateLimit, authRateLimit, strictRateLimit } from './middleware/rate-limit.middleware.js';

import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import rolesRoutes from './modules/roles/roles.routes.js';
import branchesRoutes from './modules/branches/branches.routes.js';
import warehousesRoutes from './modules/warehouses/warehouses.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import unitsRoutes from './modules/units/units.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import suppliersRoutes from './modules/suppliers/suppliers.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import purchasesRoutes from './modules/purchases/purchases.routes.js';
import salesRoutes from './modules/sales/sales.routes.js';
import accountingRoutes from './modules/accounting/accounting.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import reportingRoutes from './modules/reporting/reporting.routes.js';
import loyaltyRoutes from './modules/loyalty/loyalty.routes.js';
import feedbackRoutes from './modules/feedback/feedback.routes.js';
import complaintsRoutes from './modules/complaints/complaints.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import syncRoutes from './modules/sync/sync.routes.js';

const app = express();
const allowedOrigins = config.corsAllowedOrigins;

app.set('trust proxy', 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 600,
  })
);
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: config.nodeEnv === 'production',
}));

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  skipSuccessfulRequests: true,
});

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Apply rate limiting
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/refresh', authRateLimit);
app.use('/api', applyRateLimit);
app.use(correlationMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/api/health', async (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/ready', async (req, res) => {
  const checks = {
    database: 'ok',
    redis: 'ok',
    external_apis: 'ok',
  };
  
  let allReady = true;
  
  // Check database
  try {
    const { prisma } = await import('./db/prisma.js');
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    checks.database = 'error';
    allReady = false;
  }
  
  // Check Redis (if configured)
  try {
    // Redis check would go here if Redis is configured
  } catch (error) {
    checks.redis = 'error';
    allReady = false;
  }
  
  // Check external APIs (if any)
  try {
    // External API checks would go here
  } catch (error) {
    checks.external_apis = 'error';
    allReady = false;
  }
  
  const statusCode = allReady ? 200 : 503;
  res.status(statusCode).json({ ready: allReady });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
// Machine-to-machine PASALO webhook authenticates with its dedicated shared secret.
// Mount before the general /api roles router, whose router-level auth middleware is broad.
app.use('/api/sync', syncRoutes);
app.use('/api', rolesRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api', accountingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

export default app;
