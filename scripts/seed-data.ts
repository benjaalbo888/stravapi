import { createHash } from 'node:crypto';
import { inArray, or } from 'drizzle-orm';
import type { Database } from '../src/db/client.js';
import { categories, movements, products } from '../src/db/schema.js';
import { fixtures } from './fixtures.js';

function fixtureId(key: string) {
  const hex = createHash('sha256').update('stravapi/v1/' + key).digest('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), '8' + hex.slice(13, 16),
    'a' + hex.slice(17, 20), hex.slice(20, 32)].join('-');
}

export async function seed(db: Database) {
  return db.transaction(async (tx) => {
    const expected = fixtures.map(({ slug, name, description }) => ({
      id: fixtureId('category/' + slug), slug, name, description,
    }));
    await tx.insert(categories).values(expected).onConflictDoNothing();
    const categoryRows = await tx.select().from(categories).where(or(
      inArray(categories.id, expected.map(({ id }) => id)),
      inArray(categories.slug, expected.map(({ slug }) => slug)),
    ));

    const demoProducts = fixtures.flatMap((category, categoryIndex) => {
      const existing = categoryRows.find(({ id }) => id === fixtureId('category/' + category.slug))
        ?? categoryRows.find(({ slug }) => slug === category.slug);
      if (!existing) throw new Error('No se encontró la categoría ficticia ' + category.slug);
      return category.items.map(([name, price, description], index) => {
        const sku = 'STR-' + category.slug.slice(0, 3).toUpperCase() + '-' + String(index + 1).padStart(3, '0');
        const createdAt = new Date(Date.UTC(2025, 0, 1 + categoryIndex * 14 + index)).toISOString();
        return {
          id: fixtureId('product/' + sku), categoryId: existing.id, name, price, description, sku,
          stock: index === 0 && categoryIndex === 0 ? 36 : (index * 17 + categoryIndex * 11) % 61,
          createdAt, updatedAt: createdAt,
        };
      });
    });

    const inserted = await tx.insert(products).values(demoProducts).onConflictDoNothing().returning();
    const initialMovements = inserted.filter(({ stock }) => stock > 0)
      .map(({ id, stock, createdAt }) => ({
        id: fixtureId('opening/' + id), productId: id, quantity: stock, createdAt,
        type: 'in' as const, reference: 'Carga inicial del catálogo ficticio',
      }));
    if (initialMovements.length) await tx.insert(movements).values(initialMovements);
    return { fixtures: demoProducts.length, inserted: inserted.length, categories: expected.length };
  });
}
