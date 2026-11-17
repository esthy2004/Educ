import type { ActivityLog, Database } from '../types';
import { uid } from '../utils/format';

export function logActivity(
  db: Database,
  activity: Omit<ActivityLog, 'id' | 'date'> & { date?: string },
): void {
  db.activities.unshift({
    ...activity,
    id: uid('act'),
    date: activity.date ?? new Date().toISOString(),
  });
  db.activities = db.activities.slice(0, 80);
}
