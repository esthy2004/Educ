import { Router } from 'express';
import {
  databaseEngine,
  dataFilePath,
  exportDatabaseJson,
  getDb,
  importDatabaseJson,
  resetDb,
} from '../db/store';
import { requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/http';

export const databaseRouter = Router();

databaseRouter.use(requireAuth);

databaseRouter.get(
  '/',
  requirePermission('settings.view'),
  asyncHandler(async (_req, res) => {
    res.json({
      engine: databaseEngine(),
      version: getDb().version,
      file: dataFilePath(),
      counts: {
        students: getDb().students.length,
        staff: getDb().staff.length,
        classes: getDb().classes.length,
        grades: getDb().grades.length,
        invoices: getDb().invoices.length,
        payments: getDb().payments.length,
      },
    });
  }),
);

databaseRouter.get(
  '/export',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const json = exportDatabaseJson();
    if (req.query.format === 'text') {
      res.type('application/json').send(json);
      return;
    }
    res.json(JSON.parse(json));
  }),
);

databaseRouter.post(
  '/import',
  requirePermission('users.manage'),
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as {
      database?: Record<string, unknown>;
      json?: string;
      students?: unknown;
      classes?: unknown;
    };
    const payload = body.database ?? body.json ?? body;
    try {
      const db = await importDatabaseJson(payload as string | Record<string, unknown>);
      res.json({ success: true, version: db.version });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : 'Fichier de sauvegarde EDUFLOW invalide.',
      );
    }
  }),
);

databaseRouter.post(
  '/reset',
  requirePermission('users.manage'),
  asyncHandler(async (_req, res) => {
    await resetDb();
    res.json({ success: true, version: getDb().version });
  }),
);
