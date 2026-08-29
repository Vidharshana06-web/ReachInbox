import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './queues/email.queue.js';

dotenv.config();

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Setup Bull Board Queue Visualizer
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter: serverAdapter,
});

// Security & Utility Middleware
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow Bull Board dashboard CSS/JS assets to render without policy blocks
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Queue visualizer dashboard with automatic trailing slash redirection
app.use('/admin/queues', (req, res, next) => {
  if (req.path === '' || req.path === '/') {
    if (!req.originalUrl.endsWith('/')) {
      return res.redirect(301, req.originalUrl + '/');
    }
  }
  next();
}, serverAdapter.getRouter());

// REST APIs mount
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

export default app;
