import { PGlite } from '@electric-sql/pglite';
import { count, eq } from 'drizzle-orm';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { migrate as pgMigrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as wasmDrizzle } from 'drizzle-orm/pglite';
import { migrate as wasmMigrate } from 'drizzle-orm/pglite/migrator';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from '../scripts/seed-data.js';
import { buildApp } from '../src/application.js';
import type { Database } from '../src/db/client.js';
import { movements, products } from '../src/db/schema.js';

const adminKey = 'a'.repeat(64);
const auth = { authorization: 'Bearer ' + adminKey };
const base = '/api/v1';
const admin = base + '/admin';
const migration = { migrationsFolder: 'drizzle', migrationsSchema: 'stravapi_migrations' };
const unknownId = '00000000-0000-4000-8000-000000000001';

let app: FastifyInstance;
let db: Database;
let closeDb: (() => Promise<void>) | undefined;
let technologyId: string;
let productId: string;

beforeAll(async () => {
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/stravapi_test') {
      throw new Error('Usa únicamente una base local desechable llamada stravapi_test.');
    }
    const pool = new pg.Pool({ connectionString: url.href });
    closeDb = () => pool.end();
    const existing = await pool.query("select to_regnamespace('stravapi') as schema");
    if (existing.rows[0]?.schema) throw new Error('stravapi_test debe comenzar vacía.');
    const connection = pgDrizzle(pool);
    await pgMigrate(connection, migration);
    db = connection;
  } else {
    const instance = new PGlite();
    closeDb = () => instance.close();
    const connection = wasmDrizzle(instance);
    await wasmMigrate(connection, migration);
    await wasmMigrate(connection, migration);
    db = connection;
  }
  expect(await seed(db)).toEqual({ fixtures: 84, inserted: 84, categories: 6 });
  expect(await seed(db)).toEqual({ fixtures: 84, inserted: 0, categories: 6 });
  app = buildApp({ db, adminKey, adminOrigins: ['https://dev.example.com'] });
  const category = await app.inject(base + '/categories/tecnologia');
  technologyId = category.json().data.id;
  const initial = await app.inject(base + '/products?q=Lenga');
  productId = initial.json().data[0].id;
}, 30_000);

afterAll(async () => {
  await app?.close();
  await closeDb?.();
});

describe('catálogo público', () => {
  it('lista 84 productos y devuelve paginación estable', async () => {
    const first = await app.inject(base + '/products?limit=5');
    const next = await app.inject(base + '/products?limit=5&page=2');
    expect(first.statusCode).toBe(200);
    expect(first.json().pagination).toEqual({ page: 1, limit: 5, total: 84, totalPages: 17 });
    const ids = (response: typeof first) => response.json().data.map((row: { id: string }) => row.id);
    expect(new Set([...ids(first), ...ids(next)]).size).toBe(10);
    expect((await app.inject(base + '/products?page=99')).json().data).toEqual([]);
  });

  it('busca sin distinguir mayúsculas y trata comodines como texto', async () => {
    const result = await app.inject({ url: base + '/products', query: { q: 'tEcLaDo' } });
    expect(result.json().pagination.total).toBe(2);
    expect((await app.inject(base + '/products?q=%25')).json().data).toEqual([]);
  });

  it('combina filtros y ordena en los tres campos permitidos', async () => {
    const result = await app.inject(base + '/products?category=tecnologia&inStock=true&minPrice=10000&maxPrice=30000&sort=price&order=asc');
    const rows = result.json().data as Array<{ price: number; stock: number; categoryId: string }>;
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.every((row) => row.price >= 10000 && row.price <= 30000 && row.stock > 0 && row.categoryId === technologyId)).toBe(true);
    expect(rows.map(({ price }) => price)).toEqual(rows.map(({ price }) => price).sort((a, b) => a - b));
    const names = await app.inject(base + '/products?q=teclado&sort=name&order=asc');
    expect(names.json().data.map((row: { name: string }) => row.name))
      .toEqual(['Teclado compacto Ciprés', 'Teclado mecánico Lenga']);
    const newest = await app.inject(base + '/products?sort=createdAt&order=desc&limit=2');
    expect(newest.json().data[0].createdAt > newest.json().data[1].createdAt).toBe(true);
  });

  it('devuelve productos de stock cero para inStock=false y aplica el umbral exclusivo', async () => {
    const zero = (await app.inject(base + '/products?inStock=false')).json().data as Array<{ stock: number }>;
    const low = (await app.inject(base + '/products/low-stock?threshold=5')).json().data as Array<{ stock: number }>;
    expect(zero.length).toBeGreaterThan(0);
    expect(zero.every(({ stock }) => stock === 0)).toBe(true);
    expect(low.length).toBeGreaterThan(0);
    expect(low.every(({ stock }) => stock < 5)).toBe(true);
  });

  it('consulta el detalle por UUID y devuelve fechas UTC, CLP y datos de inventario', async () => {
    const result = await app.inject(base + '/products/' + productId);
    expect(result.json().data).toMatchObject({
      id: productId, name: 'Teclado mecánico Lenga', stock: 36, price: 34990, currency: 'CLP',
      imageUrl: null, createdAt: '2025-01-01T00:00:00.000Z',
    });
    const missing = await app.inject(base + '/products/' + unknownId);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('devuelve las categorías y verifica que cada producto le pertenezca', async () => {
    expect((await app.inject(base + '/categories')).json().data).toHaveLength(6);
    const list = await app.inject(base + '/categories/tecnologia/products?limit=4');
    expect(list.json().pagination.total).toBe(14);
    expect(list.json().data.every((row: { categoryId: string }) => row.categoryId === technologyId)).toBe(true);
    for (const suffix of ['', '/products']) {
      const missing = await app.inject(base + '/categories/inexistente' + suffix);
      expect(missing.statusCode).toBe(404);
      expect(missing.json().error.code).toBe('CATEGORY_NOT_FOUND');
    }
  });

  it.each([
    '/products?page=0', '/products?limit=101', '/products?limit=1&limit=2',
    '/products?inStock=1', '/products?sort=sku', '/products?unexpected=true',
    '/products?q=%20', '/products/abc', '/products/low-stock?threshold=1001',
    '/categories?limit=1', '/categories/INEXISTENTE',
    '/categories/tecnologia/products?category=hogar',
  ])('rechaza parámetros inválidos en %s', async (path) => {
    const response = await app.inject(base + path);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('detecta un rango de precios incoherente', async () => {
    const response = await app.inject(base + '/products?minPrice=100&maxPrice=99');
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('INVALID_PRICE_RANGE');
  });

  it('sirve estadísticas, salud, disponibilidad y el formato de error para rutas desconocidas', async () => {
    expect((await app.inject(base + '/stats')).json().data).toEqual({ products: 84, categories: 6, lowStock: 13 });
    for (const path of ['/health', '/ready']) {
      expect((await app.inject(path)).json()).toEqual({ success: true, data: { status: 'ok' } });
    }
    const missing = await app.inject('/inexistente');
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('administración', () => {
  it.each([
    ['POST', '/products'], ['PATCH', '/products/' + unknownId], ['DELETE', '/products/' + unknownId],
    ['POST', '/categories'], ['PATCH', '/categories/' + unknownId], ['POST', '/inventory/movements'],
  ] as const)('protege %s %s', async (method, path) => {
    const missing = await app.inject({ method, url: admin + path });
    expect(missing.statusCode).toBe(401);
    expect(missing.headers['www-authenticate']).toContain('Bearer');
    const denied = await app.inject({ method, url: admin + path, headers: { authorization: 'Bearer ' + 'b'.repeat(64) } });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('ACCESS_DENIED');
  });

  it('crea, cambia y desactiva un producto sin exponerlo tras la baja', async () => {
    const payload = { name: 'Taza de prueba', description: 'Taza azul', categoryId: technologyId, price: 5990, sku: 'TEST-001' };
    const created = await app.inject({ method: 'POST', url: admin + '/products', headers: auth, payload });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({ ...payload, stock: 0, currency: 'CLP', status: 'active' });
    const id = created.json().data.id;
    const edited = await app.inject({ method: 'PATCH', url: admin + '/products/' + id, headers: auth, payload: { price: 4990 } });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().data).toMatchObject({ name: payload.name, price: 4990 });
    const duplicate = await app.inject({ method: 'POST', url: admin + '/products', headers: auth, payload });
    expect(duplicate.statusCode).toBe(409);
    const invalid = await app.inject({ method: 'POST', url: admin + '/products', headers: auth, payload: { ...payload, sku: 'TEST-002', categoryId: unknownId } });
    expect(invalid.statusCode).toBe(422);
    const deleted = await app.inject({ method: 'DELETE', url: admin + '/products/' + id, headers: auth });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe('');
    expect((await app.inject(base + '/products/' + id)).statusCode).toBe(404);
    expect((await app.inject(base + '/products?q=Taza%20de%20prueba')).json().data).toEqual([]);
  });

  it('crea y modifica categorías y controla slugs duplicados', async () => {
    const payload = { name: 'Demo', description: 'Categoría de prueba', slug: 'demo' };
    const created = await app.inject({ method: 'POST', url: admin + '/categories', headers: auth, payload });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id;
    const conflict = await app.inject({ method: 'PATCH', url: admin + '/categories/' + id, headers: auth, payload: { slug: 'tecnologia' } });
    expect(conflict.statusCode).toBe(409);
    const edited = await app.inject({ method: 'PATCH', url: admin + '/categories/' + id, headers: auth, payload: { slug: 'demo-editada' } });
    expect(edited.statusCode).toBe(200);
    expect((await app.inject(base + '/categories/demo-editada')).json().data.id).toBe(id);
  });

  it('rechaza campos de stock y coerción de tipos en JSON, cuerpos grandes y JSON inválido', async () => {
    const patch = (payload: object) => app.inject({ method: 'PATCH', url: admin + '/products/' + productId, headers: auth, payload });
    for (const payload of [{}, { stock: 5 }, { price: '500' }, { name: 42 }, { imageUrl: 'http://example.com/image' }]) {
      expect((await patch(payload)).statusCode).toBe(400);
    }
    expect((await patch({ name: 'x'.repeat(17000) })).statusCode).toBe(413);
    const badJson = await app.inject({
      method: 'POST', url: admin + '/categories', headers: { ...auth, 'content-type': 'application/json' }, payload: '{',
    });
    expect(badJson.statusCode).toBe(400);
    const wrongMedia = await app.inject({
      method: 'POST', url: admin + '/categories', headers: { ...auth, 'content-type': 'application/octet-stream' }, payload: 'texto',
    });
    expect(wrongMedia.statusCode).toBe(415);
  });

  it('registra entradas y salidas concurrentes sin stock negativo ni movimientos huérfanos', async () => {
    const url = admin + '/inventory/movements';
    const move = (type: 'in' | 'out', quantity: number) => app.inject({
      method: 'POST', url, headers: auth, payload: { productId, type, quantity, reference: 'Prueba de inventario' },
    });
    const initial = (await app.inject(base + '/products/' + productId)).json().data.stock as number;
    const entry = await move('in', 4);
    expect(entry.statusCode).toBe(201);
    expect(entry.json().data.stock).toBe(initial + 4);
    const attempts = await Promise.all([move('out', initial + 4), move('out', initial + 4)]);
    expect(attempts.map(({ statusCode }) => statusCode).sort()).toEqual([201, 409]);
    expect(attempts.find(({ statusCode }) => statusCode === 409)?.json().error.code).toBe('INSUFFICIENT_STOCK');
    expect((await db.select({ stock: products.stock }).from(products).where(eq(products.id, productId)))[0]?.stock).toBe(0);
    expect((await db.select({ total: count() }).from(movements).where(eq(movements.productId, productId)))[0]?.total).toBe(3);
  });
});

describe('control de tráfico, disponibilidad y documentación', () => {
  it('comparte el contador entre instancias y no confía en headers de IP en local', async () => {
    const first = buildApp({ db, publicLimit: 2 });
    const second = buildApp({ db, publicLimit: 2 });
    const url = base + '/stats';
    const ip = '192.0.2.30';
    try {
      expect((await first.inject({ url, remoteAddress: ip })).statusCode).toBe(200);
      expect((await second.inject({ url, remoteAddress: ip })).headers['x-ratelimit-remaining']).toBe('0');
      const limited = await first.inject({ url, remoteAddress: ip, headers: { 'x-forwarded-for': '192.0.2.31' } });
      expect(limited.statusCode).toBe(429);
      expect(limited.json().error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(limited.headers['retry-after']).toBe('60');
    } finally {
      await first.close();
      await second.close();
    }
  });

  it('permite lecturas cross-origin y restringe el preflight administrativo', async () => {
    const origin = 'https://dev.example.com';
    const read = await app.inject({ url: base + '/stats', headers: { origin } });
    expect(read.headers['access-control-allow-origin']).toBe('*');
    const url = admin + '/products';
    const allowed = await app.inject({ method: 'OPTIONS', url, headers: { origin, 'access-control-request-method': 'POST' } });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(origin);
    const denied = await app.inject({ method: 'OPTIONS', url, headers: { origin: 'https://other.example.com' } });
    expect(denied.statusCode).toBe(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('oculta errores de base de datos y conserva la salud del proceso', async () => {
    const isolated = new PGlite();
    const broken = buildApp({ db: wasmDrizzle(isolated) });
    try {
      const response = await broken.inject(base + '/stats');
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });
      expect((await broken.inject('/ready')).statusCode).toBe(503);
      expect((await broken.inject('/health')).statusCode).toBe(200);
    } finally {
      await broken.close();
      await isolated.close();
    }
  });

  it('publica OpenAPI 3 con las 15 operaciones y seguridad solo en las escrituras', async () => {
    const spec = (await app.inject('/openapi.json')).json();
    expect(spec.openapi).toBe('3.0.3');
    const operations = Object.values(spec.paths as Record<string, object>).flatMap((path) => Object.keys(path));
    expect(operations).toHaveLength(15);
    expect(spec.paths[base + '/products'].get.security).toBeUndefined();
    expect(spec.paths[admin + '/products'].post.security).toEqual([{ adminBearer: [] }]);
    const docs = await app.inject('/docs');
    expect(docs.statusCode).toBe(200);
    expect(docs.body).toContain('lang="es"');
    expect(docs.body).toContain('name="viewport"');
    expect(docs.headers['content-security-policy']).toContain("script-src 'self'");
    expect((await app.inject('/')).body).toContain('Explorar documentación');
    expect((await app.inject('/assets/instrument-sans.woff2')).statusCode).toBe(200);
  });
});
