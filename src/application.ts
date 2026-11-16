import helmet from '@fastify/helmet';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Ajv } from 'ajv';
import * as formats from 'ajv-formats';
import Fastify, { LogController } from 'fastify';
import { catalogService } from './catalog.js';
import type { Database } from './db/client.js';
import { ApiError, setupErrors } from './errors.js';
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';
import { healthModel, responses, successResponse } from './schemas.js';
import { adminGuard, rateGuard } from './security.js';
import { brandIcon, documentationCss, home, homeCss, homeJs } from './views.js';

interface Options {
  db: Database;
  vercel?: boolean;
  adminKey?: string | undefined;
  github?: string | undefined;
  adminOrigins?: string[];
  logLevel?: string;
  rateSalt?: string | undefined;
  publicLimit?: number;
}

const emptyQuery = { type: 'object', properties: {}, additionalProperties: false };
const health = { success: true, data: { status: 'ok' } };
const require = createRequire(import.meta.url);
const instrumentSans = readFileSync(require.resolve('@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2'));

export function buildApp(options: Options) {
  const app = Fastify({
    logger: options.logLevel ? {
      level: options.logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    } : false,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 16 * 1024,
    ajv: { customOptions: { removeAdditional: false } },
    onProtoPoisoning: 'error',
    onConstructorPoisoning: 'error',
  });
  const catalog = catalogService(options.db);
  setupErrors(app);

  const bodyValidator = new Ajv({ strict: false, useDefaults: true });
  formats.default.default(bodyValidator);
  const paramsValidator = new Ajv({ strict: false });
  formats.default.default(paramsValidator);
  app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });
  app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'StravAPI',
        version: '1.0.0',
        description: [
          'Catálogo ficticio de productos, categorías y existencias para proyectos de desarrollo.',
          '',
          '### Primeros pasos',
          'Las consultas GET son públicas. Selecciona **Try it out** en una operación para ejecutarla.',
          '',
          '`GET /api/v1/products?category=tecnologia&inStock=true&limit=2`',
          '',
          'Los precios son pesos chilenos enteros. Las fechas usan ISO 8601 en UTC.',
          'El catálogo admite 120 solicitudes por IP por minuto. Al alcanzar el límite, espera 60 segundos.',
          '',
          '### Administración',
          'Las escrituras requieren una clave privada en `Authorization: Bearer <clave>`.',
          'Puedes consultar sus esquemas aquí y ejecutar las solicitudes desde tu entorno local.',
        ].join('\n'),
      },
      tags: [
        { name: 'Productos' }, { name: 'Categorías' }, { name: 'Catálogo' },
        { name: 'Servicio' }, { name: 'Administración' },
      ],
      servers: [{ url: '/', description: 'Este servidor' }],
      components: { securitySchemes: { adminBearer: { type: 'http', scheme: 'bearer' } } },
    },
    hideUntagged: true,
  });
  app.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: true,
    // Swagger's SVG sprite includes a fixed inline style. Keep the CSP scoped to that style.
    transformStaticCSP: (header) => header.replace(' upgrade-insecure-requests;', '')
      .replace("style-src 'self' https:", "style-src 'self' 'unsafe-hashes' 'sha256-RL3ie0nH+Lzz2YNqQN83mnU0J1ot4QL7b99vMdIX99w='"),
    uiConfig: {
      docExpansion: 'list', displayRequestDuration: true, supportedSubmitMethods: ['get'],
      persistAuthorization: false, validatorUrl: null, defaultModelsExpandDepth: 0,
    },
    theme: {
      title: 'StravAPI · Referencia de la API',
      css: [{ filename: 'stravapi.css', content: documentationCss }],
      favicon: [{ filename: 'brand.svg', type: 'image/svg+xml', rel: 'icon', sizes: 'any', content: brandIcon }],
    },
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (typeof payload !== 'string' || !['/docs', '/docs/'].includes(request.routeOptions.url ?? '')
      || !String(reply.getHeader('Content-Type')).startsWith('text/html')) return payload;
    return payload.replace('<html lang="en">', '<html lang="es">')
      .replace('<meta charset="UTF-8">', '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">')
      .replace('<div id="swagger-ui"></div>', '<header class="docs-header"><nav aria-label="Navegación principal"><a href="/">StravAPI</a><a href="/openapi.json">OpenAPI JSON</a></nav></header><main id="swagger-ui"></main>');
  });
  app.addHook('onResponse', async (request, reply) => {
    request.log.info({
      method: request.method, route: request.routeOptions.url ?? 'unmatched',
      statusCode: reply.statusCode, durationMs: Math.round(reply.elapsedTime),
    }, 'Solicitud completada');
  });
  app.get('/', { schema: { hide: true } }, async (_request, reply) => {
    return reply.type('text/html; charset=utf-8')
      .header('Content-Security-Policy', "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'")
      .send(home(options.github));
  });
  app.get('/assets/stravapi.css', async (_request, reply) => reply.type('text/css; charset=utf-8').send(homeCss));
  app.get('/assets/stravapi.js', async (_request, reply) => reply.type('text/javascript; charset=utf-8').send(homeJs));
  app.get('/assets/brand.svg', async (_request, reply) => reply.type('image/svg+xml').send(brandIcon));
  app.get('/assets/instrument-sans.woff2', async (_request, reply) => reply
    .type('font/woff2').header('Cache-Control', 'public, max-age=86400').send(instrumentSans));
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  app.register(async (service) => {
    service.get('/health', {
      schema: { tags: ['Servicio'], summary: 'Comprobar el proceso', querystring: emptyQuery, response: responses({ 200: successResponse(healthModel) }, 400) },
    }, async () => health);
    service.get('/ready', {
      schema: { tags: ['Servicio'], summary: 'Comprobar acceso al catálogo y al control de tráfico', querystring: emptyQuery, response: responses({ 200: successResponse(healthModel) }, 400, 503) },
    }, async () => {
      try {
        await catalog.ready();
        return health;
      } catch {
        throw new ApiError(503, 'NOT_READY', 'El servicio aún no está listo.');
      }
    });
  });

  const rates = { vercel: options.vercel ?? false, salt: options.rateSalt ?? 'stravapi-local-only' };
  app.register(async (api) => {
    api.addHook('onRequest', async (_request, reply) => {
      reply.header('Access-Control-Allow-Origin', '*').header('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After');
    });
    api.addHook('onRoute', (route) => {
      route.schema = { querystring: emptyQuery, ...route.schema };
    });
    api.addHook('preHandler', rateGuard(catalog, { ...rates, scope: 'public', limit: options.publicLimit ?? 120 }));
    publicRoutes(api, catalog);
  }, { prefix: '/api/v1' });

  app.register(async (admin) => {
    admin.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store').header('Vary', 'Origin');
      const origin = request.headers.origin;
      if (origin && options.adminOrigins?.includes(origin)) reply.header('Access-Control-Allow-Origin', origin);
    });
    admin.addHook('onRequest', adminGuard(options.adminKey));
    admin.addHook('preHandler', rateGuard(catalog, { ...rates, scope: 'admin', limit: 60 }));
    admin.setValidatorCompiler(({ schema, httpPart }) => {
      return (httpPart === 'body' ? bodyValidator : paramsValidator).compile(schema as object);
    });
    admin.addHook('onRoute', (route) => {
      route.schema = { querystring: emptyQuery, ...route.schema };
    });
    adminRoutes(admin, catalog);
  }, { prefix: '/api/v1/admin' });

  app.options('/api/v1/admin/*', { schema: { hide: true } }, async (request, reply) => {
    const origin = request.headers.origin;
    reply.header('Vary', 'Origin');
    if (!origin || !options.adminOrigins?.includes(origin)) {
      throw new ApiError(403, 'ORIGIN_DENIED', 'El origen no está autorizado.');
    }
    return reply.header('Access-Control-Allow-Origin', origin)
      .header('Access-Control-Allow-Methods', 'POST, PATCH, DELETE')
      .header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      .header('Access-Control-Max-Age', 600).code(204).send();
  });
  return app;
}
