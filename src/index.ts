import type { IncomingMessage, ServerResponse } from 'node:http';
import Fastify from 'fastify';
import { configureApp, serverOptions } from './application.js';
import { readConfig } from './config.js';
import { connectDatabase } from './db/client.js';

const config = readConfig();
const { db, close } = connectDatabase(config.databaseUrl);
const app = Fastify(serverOptions(config.logLevel));
configureApp(app, { ...config, db });
app.addHook('onClose', close);

if (!config.vercel) {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void app.close().catch(() => { process.exitCode = 1; });
    });
  }
  app.listen({ port: config.port, host: '0.0.0.0' }).catch(() => {
    app.log.fatal({ event: 'listen_failed' }, 'No se pudo iniciar StravAPI');
    process.exitCode = 1;
  });
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await app.ready();
  app.server.emit('request', request, response);
}
