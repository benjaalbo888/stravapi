import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Catalog } from './catalog.js';
import { ApiError } from './errors.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function adminGuard(key: string | undefined) {
  const expected = key ? digest(key) : undefined;
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = /^Bearer ([a-fA-F0-9]{64})$/i.exec(request.headers.authorization ?? '')?.[1];
    if (!token) {
      reply.header('WWW-Authenticate', 'Bearer realm="StravAPI"');
      throw new ApiError(401, 'AUTH_REQUIRED', 'Envía una credencial administrativa Bearer válida.');
    }
    if (!expected || !timingSafeEqual(digest(token), expected)) {
      throw new ApiError(403, 'ACCESS_DENIED', 'La credencial administrativa no tiene acceso.');
    }
  };
}

export function rateGuard(catalog: Catalog, options: {
  vercel: boolean; salt: string; limit: number; scope: 'public' | 'admin';
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const forwarded = request.headers['x-forwarded-for'];
    const ip = options.vercel && typeof forwarded === 'string' && isIP(forwarded)
      ? forwarded : request.ip;
    const key = createHmac('sha256', options.salt).update(options.scope + ':' + ip).digest('hex');
    const hits = await catalog.consumeRateLimit(key, options.limit);
    reply.header('X-RateLimit-Limit', options.limit);
    reply.header('X-RateLimit-Remaining', Math.max(0, options.limit - hits));
    if (hits > options.limit) {
      reply.header('Retry-After', 60);
      throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Límite de solicitudes alcanzado. Intenta en un minuto.');
    }
    if (Math.random() < 0.01) await catalog.pruneRateLimits().catch(() => {
      request.log.warn({ event: 'rate_limit_cleanup_failed' });
    });
  };
}
