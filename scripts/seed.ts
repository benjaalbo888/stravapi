import { runDatabaseTask } from './database-task.js';
import { seed } from './seed-data.js';

try {
  await runDatabaseTask(async (db) => {
    console.log(JSON.stringify(await seed(db)));
  });
} catch {
  console.error('Falló la carga de datos. Comprueba la conexión, las migraciones y los permisos del rol.');
  process.exitCode = 1;
}
