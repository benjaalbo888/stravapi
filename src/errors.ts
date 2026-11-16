import type { FastifyError, FastifyInstance } from 'fastify';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export const missingProduct = () => new ApiError(404, 'PRODUCT_NOT_FOUND', 'El producto solicitado no existe.');
export const missingCategory = () => new ApiError(404, 'CATEGORY_NOT_FOUND', 'La categoría solicitada no existe.');

function sqlState(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth++) {
    if ('code' in current && typeof current.code === 'string' && /^\d{2}[0-9A-Z]{3}$/.test(current.code)) {
      return current.code;
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}

export function setupErrors(app: FastifyInstance) {
  app.setNotFoundHandler(() => {
    throw new ApiError(404, 'ROUTE_NOT_FOUND', 'La ruta solicitada no existe.');
  });
  app.setErrorHandler((error, request, reply) => {
    let failure = new ApiError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno.');
    const state = sqlState(error);
    const httpError = error instanceof Error ? error as Partial<FastifyError> : {};
    if (error instanceof ApiError) failure = error;
    else if (httpError.validation) failure = new ApiError(400, 'VALIDATION_ERROR', httpError.message ?? 'Valida la solicitud.');
    else if (httpError.statusCode === 400) failure = new ApiError(400, 'BAD_REQUEST', 'La solicitud no tiene un formato válido.');
    else if (httpError.statusCode === 413) failure = new ApiError(413, 'BODY_TOO_LARGE', 'El cuerpo excede 16 KiB.');
    else if (httpError.statusCode === 415) failure = new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Usa Content-Type: application/json.');
    else if (state === '23505') failure = new ApiError(409, 'DUPLICATE_RESOURCE', 'El SKU, nombre o slug ya está en uso.');
    else if (state === '23503') failure = new ApiError(422, 'INVALID_REFERENCE', 'La categoría o el producto referenciado no existe.');
    else if (state === '23514') failure = new ApiError(422, 'INVALID_VALUE', 'El valor infringe una restricción del catálogo.');
    if (failure.status >= 500) {
      request.log.error({ event: failure.code, route: request.routeOptions.url, statusCode: failure.status }, 'Solicitud fallida');
    }
    reply.code(failure.status).send({ success: false, error: { code: failure.code, message: failure.message } });
  });
}
