import { and, asc, count, desc, eq, gt, gte, lt, lte, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Database } from './db/client.js';
import { categories, movements, products, rateLimits } from './db/schema.js';
import { ApiError, missingCategory, missingProduct } from './errors.js';

export interface ProductQuery {
  page: number;
  limit: number;
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort: 'name' | 'price' | 'createdAt';
  order: 'asc' | 'desc';
}

type NewProduct = Omit<typeof products.$inferInsert, 'id' | 'stock' | 'createdAt' | 'updatedAt'>;
type NewCategory = Omit<typeof categories.$inferInsert, 'id'>;
type NewMovement = Pick<typeof movements.$inferInsert, 'productId' | 'type' | 'quantity' | 'reference'>;
const columns = { name: products.name, price: products.price, createdAt: products.createdAt };
const utc = (value: string) => new Date(value).toISOString();
const formatProduct = (row: typeof products.$inferSelect) => ({
  ...row, createdAt: utc(row.createdAt), updatedAt: utc(row.updatedAt),
});
const one = <T>(rows: T[], error?: () => ApiError): T => {
  const row = rows[0];
  if (!row) throw error?.() ?? new Error('La consulta no devolvió ninguna fila.');
  return row;
};

export function catalogService(db: Database) {
  async function categoryBySlug(slug: string) {
    return one(await db.select().from(categories).where(eq(categories.slug, slug)).limit(1), missingCategory);
  }

  return {
    async ready() {
      await db.select({ id: products.id }).from(products).limit(1);
      await db.select({ key: rateLimits.key }).from(rateLimits).limit(1);
    },
    async list(query: ProductQuery, threshold?: number, requireCategory = false) {
      const { page, limit, q, category, minPrice, maxPrice, inStock, order, sort } = query;
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        throw new ApiError(422, 'INVALID_PRICE_RANGE', 'minPrice debe ser menor o igual que maxPrice.');
      }
      const conditions: SQL[] = [eq(products.status, 'active')];
      if (q) {
        const literal = q.trim().replace(/[!%_]/g, '!$&');
        conditions.push(sql`${products.name} ilike ${'%' + literal + '%'} escape '!'`);
      }
      if (category && requireCategory) {
        conditions.push(eq(products.categoryId, (await categoryBySlug(category)).id));
      } else if (category) {
        conditions.push(eq(products.categoryId, db.select({ id: categories.id }).from(categories)
          .where(eq(categories.slug, category))));
      }
      if (minPrice !== undefined) conditions.push(gte(products.price, minPrice));
      if (maxPrice !== undefined) conditions.push(lte(products.price, maxPrice));
      if (inStock !== undefined) conditions.push(inStock ? gt(products.stock, 0) : eq(products.stock, 0));
      if (threshold !== undefined) conditions.push(lt(products.stock, threshold));
      const filter = and(...conditions);
      const direction = order === 'desc' ? desc : asc;
      return db.transaction(async (tx) => {
        const totals = await tx.select({ total: count() }).from(products).where(filter);
        const rows = await tx.select().from(products).where(filter)
          .orderBy(direction(columns[sort]), direction(products.id)).limit(limit).offset((page - 1) * limit);
        const { total } = one(totals);
        return {
          data: rows.map(formatProduct),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    async product(id: string) {
      const rows = await db.select().from(products)
        .where(and(eq(products.id, id), eq(products.status, 'active'))).limit(1);
      return formatProduct(one(rows, missingProduct));
    },
    categories: () => db.select().from(categories).orderBy(asc(categories.name)),
    categoryBySlug,
    async stats() {
      const [row] = await db.select({
        products: count(),
        categories: db.$count(categories),
        lowStock: sql<number>`count(*) filter (where ${products.stock} < 10)`.mapWith(Number),
      }).from(products).where(eq(products.status, 'active'));
      if (!row) throw new Error('No se pudieron leer las estadísticas.');
      return row;
    },
    async createProduct(input: NewProduct) {
      return formatProduct(one(await db.insert(products).values(input).returning()));
    },
    async editProduct(id: string, patch: Partial<NewProduct>) {
      const rows = await db.update(products).set({ ...patch, updatedAt: sql`clock_timestamp()` })
        .where(eq(products.id, id)).returning();
      return formatProduct(one(rows, missingProduct));
    },
    async deactivateProduct(id: string) {
      const rows = await db.update(products).set({ status: 'inactive', updatedAt: sql`clock_timestamp()` })
        .where(eq(products.id, id)).returning({ id: products.id });
      one(rows, missingProduct);
    },
    async createCategory(input: NewCategory) {
      return one(await db.insert(categories).values(input).returning());
    },
    async editCategory(id: string, input: Partial<NewCategory>) {
      return one(await db.update(categories).set(input).where(eq(categories.id, id)).returning(), missingCategory);
    },
    async movement(input: NewMovement) {
      return db.transaction(async (tx) => {
        const rows = await tx.select({ id: products.id, stock: products.stock, status: products.status })
          .from(products).where(eq(products.id, input.productId)).for('update');
        const product = one(rows, missingProduct);
        if (product.status !== 'active') {
          throw new ApiError(409, 'PRODUCT_INACTIVE', 'El producto está desactivado.');
        }
        const stock = product.stock + (input.type === 'in' ? input.quantity : -input.quantity);
        if (stock < 0) throw new ApiError(409, 'INSUFFICIENT_STOCK', 'Las existencias son insuficientes.');
        if (stock > 1_000_000_000) throw new ApiError(422, 'STOCK_LIMIT', 'Las existencias excederían el máximo permitido.');
        await tx.update(products).set({ stock, updatedAt: sql`clock_timestamp()` }).where(eq(products.id, product.id));
        const movement = one(await tx.insert(movements).values(input).returning());
        return { ...movement, createdAt: utc(movement.createdAt), stock };
      });
    },
    async consumeRateLimit(key: string, limit: number) {
      const window = sql`date_trunc('minute', statement_timestamp())`;
      const row = one(await db.insert(rateLimits).values({ key, window, hits: 1 })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            window: sql`greatest(${rateLimits.window}, excluded.window)`,
            hits: sql`case when ${rateLimits.window} >= excluded.window
              then least(${rateLimits.hits} + 1, ${limit + 1}) else 1 end`,
          },
        }).returning({ hits: rateLimits.hits }));
      return row.hits;
    },
    async pruneRateLimits() {
      await db.delete(rateLimits).where(sql`${rateLimits.key} in (
        select key from stravapi.rate_limits where window < now() - interval '1 hour'
        order by window limit 250 for update skip locked
      ) and ${rateLimits.window} < now() - interval '1 hour'`);
    },
  };
}

export type Catalog = ReturnType<typeof catalogService>;
