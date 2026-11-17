import 'dotenv/config';
import { createApp } from './app';
import { closeDb, dataFilePath, getDb, initializeDb } from './db/store';

const port = Number(process.env.PORT || 3000);

async function main(): Promise<void> {
  await initializeDb();
  getDb();

  const app = createApp();
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[EDUFLOW] API disponible sur http://localhost:${port}/api`);
    console.log(`[EDUFLOW] Données persistées dans ${dataFilePath()}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      server.close(() => {
        void closeDb().finally(() => process.exit(0));
      });
    });
  }
}

main().catch((error) => {
  console.error('[EDUFLOW] Démarrage impossible :', error);
  process.exit(1);
});
