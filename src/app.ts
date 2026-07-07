import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { globalErrorHandler } from './middlewares/error.middleware.js';
import { sendSuccess } from './shared/apiResponse.js';
import authRouter from './modules/auth/auth.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  sendSuccess(res, 200, 'Server is healthy', { status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);

app.use(globalErrorHandler);

export default app;
