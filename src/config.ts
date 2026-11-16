import { fileURLToPath } from 'node:url';

function databaseUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? '');
    if (['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname) return url;
  } catch {
    // Keep credentials out of startup errors.
  }
  throw new Error('Configura DATABASE_URL con una conexión PostgreSQL válida.');
}

export function requireDatabaseUrl(value = process.env.DATABASE_URL) {
  const url = databaseUrl(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local) {
    url.searchParams.delete('uselibpqcompat');
    url.searchParams.set('sslmode', 'verify-full');
    const supabaseHost = /^(?:aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com|db\.[a-z0-9]+\.supabase\.co)$/;
    if (supabaseHost.test(url.hostname) && !url.searchParams.has('sslrootcert')) {
      const certificate = new URL('../certificates/supabase-prod-ca-2021.crt', import.meta.url);
      url.searchParams.set('sslrootcert', fileURLToPath(certificate));
    }
  }
  return url.href;
}

export function readConfig() {
  const vercel = process.env.VERCEL === '1';
  const adminKey = process.env.ADMIN_API_KEY || undefined;
  const rateSalt = process.env.RATE_LIMIT_SECRET || undefined;
  if ((vercel || rateSalt) && !/^[a-fA-F0-9]{64}$/.test(rateSalt ?? '')) {
    throw new Error('RATE_LIMIT_SECRET debe contener 64 caracteres hexadecimales aleatorios.');
  }
  if (adminKey && !/^[a-fA-F0-9]{64}$/.test(adminKey)) {
    throw new Error('ADMIN_API_KEY debe contener 64 caracteres hexadecimales aleatorios.');
  }
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT no es válido.');
  const github = process.env.GITHUB_REPO_URL || undefined;
  if (github && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(github)) {
    throw new Error('GITHUB_REPO_URL debe apuntar a un repositorio de GitHub.');
  }
  const adminOrigins = (process.env.ADMIN_CORS_ORIGINS ?? '')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  if (adminOrigins.some((origin) => {
    try {
      const url = new URL(origin);
      return !['https:', 'http:'].includes(url.protocol) || url.origin !== origin;
    } catch {
      return true;
    }
  })) throw new Error('ADMIN_CORS_ORIGINS debe contener orígenes HTTP válidos.');
  return {
    vercel, adminKey, port, github, adminOrigins, rateSalt,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    databaseUrl: requireDatabaseUrl(),
  };
}
