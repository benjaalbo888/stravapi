import type { FastifySchema } from 'fastify';

const string = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength, pattern: '^(?=[\\s\\S]*\\S)[^\\u0000]+$' });
const integer = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });
const object = (properties: Record<string, object>, required: string[] = Object.keys(properties)) => ({
  type: 'object', additionalProperties: false, properties, required,
});
const uuid = { type: 'string', format: 'uuid' };
const slug = { type: 'string', maxLength: 80, pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' };
const price = { ...integer(0, 1_000_000_000), description: 'Precio entero en pesos chilenos (CLP).' };
const stock = integer(0, 1_000_000_000);
const date = { type: 'string', format: 'date-time', description: 'ISO 8601 en UTC.' };
const currency = { type: 'string', enum: ['CLP'], default: 'CLP' };
const sku = { type: 'string', minLength: 3, maxLength: 48, pattern: '^[A-Z0-9][A-Z0-9_-]+$' };
const image = { type: 'string', format: 'uri', pattern: '^https://', maxLength: 2048, nullable: true };
const status = { type: 'string', enum: ['active', 'inactive'], default: 'active' };
const movementType = { type: 'string', enum: ['in', 'out'] };
export const idParams = object({ id: uuid });
export const slugParams = object({ slug });

const filters = {
  page: { ...integer(1, 10_000), default: 1, description: 'Página, comenzando en 1.' },
  limit: { ...integer(1, 100), default: 20, description: 'Máximo de resultados por página.' },
  q: { ...string(100), description: 'Nombre del producto, sin distinguir mayúsculas.', examples: ['teclado'] },
  minPrice: price,
  maxPrice: price,
  inStock: { type: 'boolean', description: 'true para existencias positivas, false para stock cero.' },
  sort: { type: 'string', enum: ['name', 'price', 'createdAt'], default: 'createdAt' },
  order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
};
const categoryFilter = { ...slug, description: 'Slug de la categoría.', examples: ['tecnologia'] };
export const productQuery = object({ ...filters, category: categoryFilter }, []);
export const categoryQuery = object(filters, []);
export const lowStockQuery = object({
  ...filters, category: categoryFilter,
  threshold: { ...integer(1, 1000), default: 10, description: 'Incluye stock estrictamente menor a este valor.' },
}, []);

const categoryFields = { name: string(100), slug, description: string(500) };
const productFields = {
  name: string(160), description: string(1500), categoryId: uuid,
  price, currency, sku, imageUrl: image, status,
};
const movementFields = { productId: uuid, type: movementType, quantity: integer(1, 1_000_000_000), reference: string(200) };
const patch = (fields: Record<string, object>) => ({ ...object(fields, []), minProperties: 1 });
export const newCategory = object(categoryFields);
export const editCategory = patch(categoryFields);
export const newProduct = object(productFields, ['name', 'description', 'categoryId', 'price', 'sku']);
export const editProduct = patch({
  ...productFields, currency: { type: 'string', enum: ['CLP'] },
  status: { type: 'string', enum: ['active', 'inactive'] },
});
export const newMovement = object(movementFields);
export const categoryModel = object({ id: uuid, ...categoryFields });
export const productModel = object({ id: uuid, ...productFields, stock, createdAt: date, updatedAt: date });
export const movementModel = object({ id: uuid, ...movementFields, stock, createdAt: date });
export const statsModel = object({
  products: { type: 'integer' }, categories: { type: 'integer' }, lowStock: { type: 'integer' },
});
export const healthModel = object({ status: { type: 'string', enum: ['ok'] } });
const pagination = object({
  page: integer(1, 10_000), limit: integer(1, 100), total: { type: 'integer' }, totalPages: { type: 'integer' },
});
const success = { type: 'boolean', enum: [true] };

export const successResponse = (data: object) => object({ success, data });
export const arrayOf = (items: object) => ({ type: 'array', items });
export const productsResponse = object({ success, data: arrayOf(productModel), pagination });
export const noContent = { type: 'null', description: 'Producto desactivado.' };
const errorExamples: Record<number, [string, string, string]> = {
  400: ['Solicitud inválida', 'VALIDATION_ERROR', 'La solicitud contiene parámetros o valores inválidos.'],
  401: ['Bearer requerido', 'AUTH_REQUIRED', 'Envía una credencial administrativa Bearer válida.'],
  403: ['Acceso denegado', 'ACCESS_DENIED', 'La credencial administrativa no tiene acceso.'],
  404: ['Recurso inexistente', 'PRODUCT_NOT_FOUND', 'El producto solicitado no existe.'],
  409: ['Conflicto con el estado del catálogo', 'DUPLICATE_RESOURCE', 'El SKU, nombre o slug ya está en uso.'],
  413: ['Cuerpo demasiado grande', 'BODY_TOO_LARGE', 'El cuerpo excede 16 KiB.'],
  415: ['Formato de contenido no admitido', 'UNSUPPORTED_MEDIA_TYPE', 'Usa Content-Type: application/json.'],
  422: ['Regla del catálogo incumplida', 'INVALID_VALUE', 'El valor infringe una restricción del catálogo.'],
  429: ['Límite de solicitudes alcanzado', 'RATE_LIMIT_EXCEEDED', 'Límite de solicitudes alcanzado. Intenta en un minuto.'],
  500: ['Error interno', 'INTERNAL_ERROR', 'Ocurrió un error interno.'],
  503: ['Servicio no disponible', 'NOT_READY', 'El servicio aún no está listo.'],
};

export function responses(ok: Record<number, object>, ...codes: number[]): FastifySchema['response'] {
  return {
    ...ok,
    ...Object.fromEntries(codes.map((statusCode) => {
      const [description, code, message] = errorExamples[statusCode]!;
      return [statusCode, {
        ...object({ success: { type: 'boolean', enum: [false] }, error: object({ code: string(80), message: string(500) }) }),
        description, example: { success: false, error: { code, message } },
      }];
    })),
  };
}
