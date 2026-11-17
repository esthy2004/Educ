import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authRouter } from './routes/auth.routes';
import { studentsRouter } from './routes/students.routes';
import { staffRouter } from './routes/staff.routes';
import { academicsRouter } from './routes/academics.routes';
import { attendanceRouter } from './routes/attendance.routes';
import {
  cashRouter,
  expensesRouter,
  feesRouter,
  invoicesRouter,
  paymentsRouter,
} from './routes/finance.routes';
import { timetableRouter } from './routes/timetable.routes';
import { disciplineRouter } from './routes/discipline.routes';
import { settingsRouter, usersRouter } from './routes/settings.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { activitiesRouter } from './routes/activities.routes';
import { databaseRouter } from './routes/database.routes';
import { schoolsRouter } from './routes/schools.routes';
import { HttpError } from './middleware/http';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowedOrigins.includes('*') && process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGIN ne peut pas valoir * en production.');
  }
  app.use(
    cors({
      origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      maxAge: 600,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      name: 'eduflow-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/', (_req, res) => {
    res.json({
      name: 'EDUFLOW API',
      version: '1.0.0',
      health: '/api/health',
      documentation: '/api/health',
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/schools', schoolsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/academics', academicsRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/fees', feesRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/finance', cashRouter);
  app.use('/api/timetable', timetableRouter);
  app.use('/api/discipline', disciplineRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/database', databaseRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Ressource introuvable.' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ message: 'Corps de requête JSON invalide.' });
      return;
    }
    console.error('[EDUFLOW] Erreur inattendue :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  });

  return app;
}
