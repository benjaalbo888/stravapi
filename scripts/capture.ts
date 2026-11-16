import { mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { chromium, expect } from '@playwright/test';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { buildApp } from '../src/application.js';
import { seed } from './seed-data.js';

const instance = new PGlite();
const db = drizzle(instance);
const app = buildApp({ db });
try {
  await migrate(db, { migrationsFolder: 'drizzle', migrationsSchema: 'stravapi_migrations' });
  await seed(db);
  const baseURL = await app.listen({ host: '127.0.0.1', port: 0 });
  const channel = process.env.BROWSER_CHANNEL;
  const browser = await chromium.launch(channel ? { channel } : {});
  try {
    await mkdir('docs/images', { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', baseURL });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.location().url + ' ' + message.text());
    });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('heading', { name: 'Datos listos para construir.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver en GitHub' })).toHaveAttribute('href', 'https://github.com/benjaalbo888/stravapi');
    await page.screenshot({ path: 'docs/images/portada.png' });

    await page.getByRole('link', { name: 'Explorar documentación' }).click();
    await expect(page.getByRole('heading', { name: /StravAPI/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'docs/images/documentacion.png' });
    const list = page.locator('.opblock-get').filter({ hasText: 'Listar productos activos' });
    await list.getByRole('button', { name: /Listar productos activos/ }).click();
    await list.getByRole('button', { name: 'Try it out' }).click();
    await list.locator('tr[data-param-name="limit"] input').fill('2');
    const response = page.waitForResponse((res) => res.url().includes('/api/v1/products?') && res.request().method() === 'GET');
    await list.getByRole('button', { name: 'Execute' }).click();
    const result = await response;
    expect(result.status()).toBe(200);
    expect((await result.json()).data).toHaveLength(2);
    await list.locator('.live-responses-table').getByText('200', { exact: true }).waitFor();
    await list.locator('.live-responses-table').screenshot({ path: 'docs/images/respuesta.png' });
    const write = page.locator('.opblock-post').filter({ hasText: 'Crear un producto' });
    await write.getByRole('button', { name: /Crear un producto/ }).click();
    await expect(write.getByRole('button', { name: 'Try it out' })).toHaveCount(0);

    for (const path of ['/', '/docs']) {
      for (const width of [1440, 1024, 820, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.getByRole('heading', { name: path === '/' ? /Datos listos/ : /StravAPI/ }).waitFor();
        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(documentWidth, path + ' a ' + width + ' px').toBeLessThanOrEqual(width);
      }
    }
    expect(errors).toEqual([]);
    console.log('Portada y documentación comprobadas en seis anchos. GET ejecutado desde Swagger UI.');
  } finally {
    await browser.close();
  }
} finally {
  await app.close();
  await instance.close();
}
