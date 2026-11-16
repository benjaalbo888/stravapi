import { sql } from 'drizzle-orm';
import { check, index, integer, pgSchema, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

const catalog = pgSchema('stravapi');
const dates = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
};

export const categories = catalog.table('categories', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 100 }).notNull().unique(),
  slug: varchar({ length: 80 }).notNull().unique(),
  description: varchar({ length: 500 }).notNull(),
}, (table) => [
  check('category_slug_format', sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
]);

export const products = catalog.table('products', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 160 }).notNull(),
  description: varchar({ length: 1500 }).notNull(),
  price: integer().notNull(),
  currency: varchar({ length: 3 }).notNull().default('CLP'),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  stock: integer().notNull().default(0),
  sku: varchar({ length: 48 }).notNull().unique(),
  imageUrl: varchar('image_url', { length: 2048 }),
  status: varchar({ length: 8, enum: ['active', 'inactive'] }).notNull().default('active'),
  ...dates,
}, (table) => [
  check('product_price_range', sql`${table.price} BETWEEN 0 AND 1000000000`),
  check('product_stock_range', sql`${table.stock} BETWEEN 0 AND 1000000000`),
  check('product_currency_clp', sql`${table.currency} = 'CLP'`),
  check('product_status_valid', sql`${table.status} IN ('active', 'inactive')`),
  index('products_category_idx').on(table.categoryId),
  index('products_active_price_idx').on(table.price, table.id).where(sql`${table.status} = 'active'`),
  index('products_active_date_idx').on(table.createdAt, table.id).where(sql`${table.status} = 'active'`),
  index('products_active_stock_idx').on(table.stock, table.id).where(sql`${table.status} = 'active'`),
]);

export const movements = catalog.table('inventory_movements', {
  id: uuid().primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id),
  type: varchar({ length: 3, enum: ['in', 'out'] }).notNull(),
  quantity: integer().notNull(),
  reference: varchar({ length: 200 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
  check('movement_quantity_range', sql`${table.quantity} BETWEEN 1 AND 1000000000`),
  check('movement_type_valid', sql`${table.type} IN ('in', 'out')`),
  index('movement_product_date_idx').on(table.productId, table.createdAt),
]);

export const rateLimits = catalog.table('rate_limits', {
  key: text().primaryKey(),
  window: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
  hits: integer().notNull(),
}, (table) => [index('rate_limits_window_idx').on(table.window)]);
