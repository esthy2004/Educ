import { Router } from 'express';
import { getDb } from '../db/store';
import { requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/http';

export const activitiesRouter = Router();

activitiesRouter.use(requireAuth);

activitiesRouter.get(
  '/',
  requirePermission('dashboard.view'),
  asyncHandler(async (req, res) => {
    const requested = Number(req.query.limit ?? 80);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(1, requested), 200) : 80;
    res.json(getDb().activities.slice(0, limit));
  }),
);
