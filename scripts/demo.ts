import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { buildApp } from '../src/application.js';
import { seed } from './seed-data.js';

const pg = new PGlite();
const db = drizzle(pg);
await migrate(db, { migrationsFolder: 'drizzle', migrationsSchema: 'stravapi_migrations' });
const result = await seed(db);
const app = buildApp({ db, logLevel: 'warn', github: process.env.GITHUB_REPO_URL });
app.addHook('onClose', () => pg.close());
const address = await app.listen({ port: Number(process.env.PORT ?? 3000), host: '127.0.0.1' });
console.log(`Demo en ${address} · ${result.inserted} productos ficticios`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); });
}
