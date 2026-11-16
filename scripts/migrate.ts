import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { requireDatabaseUrl } from '../src/config.js';

const pool = new pg.Pool({
  connectionString: requireDatabaseUrl(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL),
  max: 1, connectionTimeoutMillis: 5000,
});
try {
  await migrate(drizzle(pool), { migrationsFolder: 'drizzle', migrationsSchema: 'stravapi_migrations' });
  console.log('Migraciones aplicadas.');
} catch {
  console.error('Fallaron las migraciones. Comprueba la conexión y los permisos del rol.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
