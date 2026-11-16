import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';

export type Database = PgDatabase<PgQueryResultHKT>;

export function connectDatabase(connectionString: string, max = 3) {
  const pool = new pg.Pool({
    connectionString,
    max,
    connectionTimeoutMillis: 3500,
    idleTimeoutMillis: 8000,
    statement_timeout: 4500,
    query_timeout: 5000,
  });
  // Idle pooled connections can fail after a network outage. The next checkout opens a replacement.
  pool.on('error', () => {
    console.error(JSON.stringify({ level: 'warn', event: 'idle_database_connection_failed' }));
  });
  return { db: drizzle(pool), close: () => pool.end() };
}
