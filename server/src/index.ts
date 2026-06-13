import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './utils/prisma';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { workspaceRouter } from './routes/workspace';
import { documentRouter } from './routes/document';
import { syncRouter } from './routes/sync';
import { errorHandler, notFoundHandler } from './middleware/error';

const app = express();

// ── Security ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: config.isDev ? false : undefined,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: [config.server.clientUrl, /tauri:\/\//, /capacitor:\/\//, /localhost/],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID'],
}));

// ── Middleware ────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.cookie.secret));
app.use(morgan(config.isDev ? 'dev' : 'combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Health check ──────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// ── Routes ────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/workspaces', workspaceRouter);
app.use('/api/documents', documentRouter);
app.use('/api/sync', syncRouter);

// ── Error handling ────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info(`🚀 启文服务启动 → http://${config.server.host}:${config.server.port}`);
  logger.info(`环境: ${config.env}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

export { app };
