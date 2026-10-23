import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

// The cloud browser policy blocks file:// navigation. Serve only the exact HTML
// bytes through a test route; every API/resource request would still fail offline.
const fileUrl = 'https://naberlo.test/';

test('single HTML needs no backend, persists uploads, exports and restores in another browser', async ({
  page,
  browser,
  context,
}, testInfo) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && request.url() !== fileUrl) requests.push(request.url());
  });
  const html = await fs.readFile(path.resolve('NABERLO.html'), 'utf8');
  await context.route(fileUrl, (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await context.setOffline(true);
  await page.goto(fileUrl);
  await expect(page.getByRole('heading', { name: 'Bir kulüp. Sonsuz olasılık.' })).toBeVisible();
  await expect(page.getByText('Tek HTML · Kurulumsuz stüdyo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Yeni proje', exact: true }).last().click();
  await page.getByRole('textbox', { name: 'Kulüp ara', exact: true }).fill('Fenerbahce');
  await page
    .getByRole('button', { name: /Fenerbahçe İstanbul/ })
    .first()
    .click();
  await expect(page.locator('.design-card')).toHaveCount(10);
  await page.getByRole('button', { name: 'Kolajı üret', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Bu tek HTML sürümü otomatik AI görsel üretmez.',
  );
  await expect(page.getByRole('button', { name: '1 görsel üret', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();
  await page.getByRole('button', { name: 'Promptu aç', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Üretim promptu' })).toHaveValue(
    /exactly 2 columns by 5 rows/,
  );
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();
  await page.getByRole('button', { name: 'Yeni seri', exact: true }).click();
  await expect(page.getByText('B2-C1-01', { exact: true })).toBeVisible();
  await page
    .locator('.reference-item input[type=file]')
    .first()
    .setInputFiles({
      name: 'reference.png',
      mimeType: 'image/png',
      buffer: await sharp({ create: { width: 96, height: 64, channels: 3, background: '#406040' } })
        .png()
        .toBuffer(),
    });
  await expect(page.getByRole('dialog')).toContainText('Görsel kalite kontrolü');
  for (const check of await page.getByRole('dialog').getByRole('checkbox').all())
    await check.check();
  await page.getByRole('button', { name: 'Kontrol ettim, kabul et', exact: true }).click();
  await expect(page.getByText('Kabul edildi · değiştir', { exact: true })).toBeVisible();
  await page.reload();
  await page.locator('.project-link').first().click();
  await expect(page.getByText('B2-C1-01', { exact: true })).toBeVisible();
  await expect(page.getByText('Kabul edildi · değiştir', { exact: true })).toBeVisible();

  const zipPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Paketi indir', exact: true }).click();
  const zip = await zipPromise;
  await zip.saveAs('/tmp/naberlo-standalone-export.zip');
  expect((await fs.readFile('/tmp/naberlo-standalone-export.zip')).subarray(0, 2).toString()).toBe(
    'PK',
  );
  const backupPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Yedeği indir', exact: true }).click();
  const backup = await backupPromise;
  const backupPath = testInfo.outputPath('backup.json');
  await backup.saveAs(backupPath);
  const data = JSON.parse(await fs.readFile(backupPath, 'utf8'));
  expect(data.format).toBe('naberlo-html-v1');
  expect(data.projects[0].assets[0].url).toMatch(/^data:image\/png;base64,/);

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true });
  const other = await phone.newPage();
  await phone.route(fileUrl, (route) => route.fulfill({ contentType: 'text/html', body: html }));
  other.on('pageerror', (error) => errors.push(error.message));
  await other.goto(fileUrl);
  await other.locator('.standalone-bar input[type=file]').setInputFiles(backupPath);
  await expect(other.locator('.standalone-bar [role=status]')).toContainText(
    '1 proje yedekten eklendi',
  );
  await other.getByRole('button', { name: 'Menüyü aç' }).click();
  await other.locator('.project-link').first().click();
  await expect(other.getByText('B2-C1-01', { exact: true })).toBeVisible();
  await expect(other.getByText('Kabul edildi · değiştir', { exact: true })).toBeVisible();
  expect(
    await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await other.screenshot({ path: '/tmp/naberlo-html-mobile.png', fullPage: true });
  await phone.close();
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
