import type { FastifyInstance } from 'fastify';
import type { Catalog } from '../catalog.js';
import {
  categoryModel, editCategory, editProduct, idParams, movementModel, newCategory, newMovement, newProduct,
  noContent, productModel, responses, successResponse,
} from '../schemas.js';

const security = [{ adminBearer: [] }];
const tags = ['Administración'];
const errors = [400, 401, 403, 429, 500];
const writeErrors = [...errors, 409, 413, 415, 422];
type Body<K extends keyof Catalog> = Parameters<Catalog[K]>[0];
type Edit<K extends keyof Catalog> = Parameters<Catalog[K]>[1];
type Id = { id: string };

export function adminRoutes(app: FastifyInstance, catalog: Catalog) {
  app.post<{ Body: Body<'createProduct'> }>('/products', {
    schema: {
      tags, security, summary: 'Crear un producto',
      description: 'El producto comienza con stock cero. Registra una entrada para añadir existencias.',
      body: newProduct, response: responses({ 201: successResponse(productModel) }, ...writeErrors),
    },
  }, async ({ body }, reply) => {
    const data = await catalog.createProduct(body);
    reply.code(201).send({ success: true, data });
  });

  app.patch<{ Params: Id; Body: Edit<'editProduct'> }>('/products/:id', {
    schema: {
      tags, security, summary: 'Editar un producto',
      params: idParams, body: editProduct, response: responses({ 200: successResponse(productModel) }, ...writeErrors, 404),
    },
  }, async ({ params, body }) => ({ success: true, data: await catalog.editProduct(params.id, body) }));

  app.delete<{ Params: Id }>('/products/:id', {
    schema: {
      tags, security, summary: 'Desactivar un producto',
      description: 'Oculta el producto del catálogo público y conserva su historial de inventario.',
      params: idParams, response: responses({ 204: noContent }, ...errors, 404),
    },
  }, async ({ params }, reply) => {
    await catalog.deactivateProduct(params.id);
    reply.code(204).send();
  });

  app.post<{ Body: Body<'createCategory'> }>('/categories', {
    schema: {
      tags, security, summary: 'Crear una categoría',
      body: newCategory, response: responses({ 201: successResponse(categoryModel) }, ...writeErrors),
    },
  }, async ({ body }, reply) => {
    reply.code(201).send({ success: true, data: await catalog.createCategory(body) });
  });

  app.patch<{ Params: Id; Body: Edit<'editCategory'> }>('/categories/:id', {
    schema: {
      tags, security, summary: 'Editar una categoría',
      params: idParams, body: editCategory, response: responses({ 200: successResponse(categoryModel) }, ...writeErrors, 404),
    },
  }, async ({ params, body }) => ({ success: true, data: await catalog.editCategory(params.id, body) }));

  app.post<{ Body: Body<'movement'> }>('/inventory/movements', {
    schema: {
      tags, security, summary: 'Registrar un movimiento de inventario',
      description: 'Usa in para entradas y out para salidas. Una salida superior al stock disponible devuelve 409.',
      body: newMovement, response: responses({ 201: successResponse(movementModel) }, ...writeErrors, 404),
    },
  }, async ({ body }, reply) => {
    reply.code(201).send({ success: true, data: await catalog.movement(body) });
  });
}
