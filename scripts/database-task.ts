import { requireDatabaseUrl } from '../src/config.js';
import { connectDatabase } from '../src/db/client.js';
import type { Database } from '../src/db/client.js';

export async function runDatabaseTask(run: (db: Database) => Promise<void>) {
  const connection = connectDatabase(requireDatabaseUrl(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL), 1);
  try {
    await run(connection.db);
  } finally {
    await connection.close();
  }
}
