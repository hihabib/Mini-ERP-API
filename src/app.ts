import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { globalErrorHandler } from './middlewares/error.middleware.js';
import { sendSuccess } from './shared/apiResponse.js';
import authRouter from './modules/auth/auth.routes.js';
import productRouter from './modules/product/product.routes.js';
import saleRouter from './modules/sale/sale.routes.js';
import dashboardRouter from './modules/dashboard/dashboard.routes.js';
import { swaggerSpec } from './docs/swagger.js';
import { env } from './config/env.js';

// Side-effect imports: register all Mongoose models before any route runs,
// so populate() resolves regardless of which endpoint handles the first request.
import './modules/user/user.model.js';
import './modules/role/role.model.js';
import './modules/role/permission.model.js';
import './modules/product/product.model.js';
import './modules/sale/sale.model.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded images as static files
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

app.get('/health', (_req, res) => {
  sendSuccess(res, {
    message: 'Server is healthy',
    data: { status: 'ok', timestamp: new Date().toISOString() },
  });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/sales', saleRouter);
app.use('/api/dashboard', dashboardRouter);

app.use(globalErrorHandler);

export default app;
