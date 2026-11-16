import type { FastifyInstance } from 'fastify';
import type { Catalog, ProductQuery } from '../catalog.js';
import {
  arrayOf, categoryModel, categoryQuery, idParams, lowStockQuery, productModel, productQuery,
  productsResponse, responses, slugParams, statsModel, successResponse,
} from '../schemas.js';

const ok = <T>(data: T) => ({ success: true, data });

export function publicRoutes(app: FastifyInstance, catalog: Catalog) {
  app.get<{ Querystring: ProductQuery }>('/products', {
    schema: {
      tags: ['Productos'], summary: 'Listar productos activos',
      description: 'Combina búsqueda, categoría, precio y disponibilidad. El ID resuelve empates en el orden.',
      querystring: productQuery, response: responses({ 200: productsResponse }, 400, 422, 429, 500),
    },
  }, async ({ query }) => ({ success: true, ...await catalog.list(query) }));

  app.get<{ Querystring: ProductQuery & { threshold: number } }>('/products/low-stock', {
    schema: {
      tags: ['Productos'], summary: 'Listar productos con stock bajo',
      description: 'El umbral es exclusivo. Un umbral de 10 devuelve existencias de 0 a 9.',
      querystring: lowStockQuery, response: responses({ 200: productsResponse }, 400, 422, 429, 500),
    },
  }, async ({ query }) => ({ success: true, ...await catalog.list(query, query.threshold) }));

  app.get<{ Params: { id: string } }>('/products/:id', {
    schema: {
      tags: ['Productos'], summary: 'Consultar un producto por UUID',
      params: idParams, response: responses({ 200: successResponse(productModel) }, 400, 404, 429, 500),
    },
  }, async ({ params }) => ok(await catalog.product(params.id)));

  app.get('/categories', {
    schema: {
      tags: ['Categorías'], summary: 'Listar categorías',
      response: responses({ 200: successResponse(arrayOf(categoryModel)) }, 400, 429, 500),
    },
  }, async () => ok(await catalog.categories()));

  app.get<{ Params: { slug: string } }>('/categories/:slug', {
    schema: {
      tags: ['Categorías'], summary: 'Consultar una categoría por slug',
      params: slugParams, response: responses({ 200: successResponse(categoryModel) }, 400, 404, 429, 500),
    },
  }, async ({ params }) => ok(await catalog.categoryBySlug(params.slug)));

  app.get<{ Params: { slug: string }; Querystring: Omit<ProductQuery, 'category'> }>('/categories/:slug/products', {
    schema: {
      tags: ['Categorías'], summary: 'Listar productos de una categoría',
      params: slugParams, querystring: categoryQuery,
      response: responses({ 200: productsResponse }, 400, 404, 422, 429, 500),
    },
  }, async ({ params, query }) => ({
    success: true, ...await catalog.list({ ...query, category: params.slug }, undefined, true),
  }));

  app.get('/stats', {
    schema: {
      tags: ['Catálogo'], summary: 'Consultar estadísticas del catálogo',
      description: 'Cuenta productos activos, todas las categorías y productos con menos de 10 unidades.',
      response: responses({ 200: successResponse(statsModel) }, 400, 429, 500),
    },
  }, async () => ok(await catalog.stats()));
}
