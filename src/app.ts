import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { globalErrorHandler } from './middlewares/error.middleware.js';
import { sendSuccess } from './shared/apiResponse.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  sendSuccess(res, 200, 'Server is healthy', { status: 'ok', timestamp: new Date().toISOString() });
});

// Feature routes will be mounted here as modules are implemented
// app.use('/api/v1/auth', authRoutes);

app.use(globalErrorHandler);

export default app;
