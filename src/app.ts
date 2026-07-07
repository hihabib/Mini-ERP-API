import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { globalErrorHandler } from './middlewares/error.middleware.js';
import { sendSuccess } from './shared/apiResponse.js';
import authRouter from './modules/auth/auth.routes.js';

// Side-effect imports: register all Mongoose models before any route runs,
// so populate() resolves regardless of which endpoint handles the first request.
import './modules/user/user.model.js';
import './modules/role/role.model.js';
import './modules/role/permission.model.js';
import './modules/product/product.model.js';
import './modules/sale/sale.model.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  sendSuccess(res, 200, 'Server is healthy', { status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);

app.use(globalErrorHandler);

export default app;
