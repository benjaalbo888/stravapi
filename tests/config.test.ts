import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { requireDatabaseUrl } from '../src/config.js';

describe('TLS de PostgreSQL', () => {
  it.each([
    'aws-1-sa-east-1.pooler.supabase.com',
    'db.sampleproject.supabase.co',
  ])('incluye la CA pública de Supabase para %s', (host) => {
    const url = new URL(requireDatabaseUrl(`postgresql://user@${host}/postgres?sslmode=require`));
    expect(url.searchParams.get('sslmode')).toBe('verify-full');
    const certificate = new X509Certificate(readFileSync(url.searchParams.get('sslrootcert')!));
    expect(certificate.ca).toBe(true);
    expect(certificate.subject).toContain('Supabase Root 2021 CA');
  });

  it('respeta una CA explícita y usa la confianza del sistema para otros proveedores', () => {
    const custom = new URL(requireDatabaseUrl('postgresql://user@db.sample.supabase.co/postgres?sslrootcert=/custom.crt'));
    expect(custom.searchParams.get('sslrootcert')).toBe('/custom.crt');
    const external = new URL(requireDatabaseUrl('postgresql://user@pg.example.com/postgres?sslmode=no-verify'));
    expect(external.searchParams.get('sslmode')).toBe('verify-full');
    expect(external.searchParams.has('sslrootcert')).toBe(false);
  });
});
