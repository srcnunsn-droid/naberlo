import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { fixture, asset } from '../fixtures';
import { referenceSignature } from '../../shared/automation';

test('actual sheet previews, selection, production controls and secure key form', async ({
  page,
}) => {
  const p = fixture();
  p.assets = ['SITE', 'CREST', 'R0', 'E0'].map(asset);
  p.assets.push({
    ...asset('C1'),
    status: 'review',
    origin: 'openai',
    configuration: referenceSignature(p, 'C1'),
  });
  const png = await sharp({
    create: { width: 1024, height: 1536, channels: 3, background: '#55a88c' },
  })
    .png()
    .toBuffer();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let selected = '',
    sentKey = '';
  await page.route('**/media/*.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: png }),
  );
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/projects')
      return route.fulfill({ json: [{ ...p, assetCount: p.assets.length, acceptedCount: 4 }] });
    if (pathname === '/api/projects/test') {
      if (p.research?.status === 'running')
        p.research = {
          ...p.research,
          status: 'done',
          message: 'Güncel kaynak araştırması tamamlandı.',
        };
      return route.fulfill({ json: p });
    }
    if (pathname === '/api/projects/test/research') {
      p.research = {
        id: 'research-test',
        status: 'running',
        startedAt: new Date().toISOString(),
        message: 'Kaynaklar araştırılıyor.',
        warnings: [],
      };
      return route.fulfill({ status: 202, json: p });
    }
    if (pathname === '/api/projects/test/automation' || pathname === '/api/jobs')
      return route.fulfill({ json: [] });
    if (pathname.endsWith('/select-preview')) {
      selected = route.request().postDataJSON().candidateId;
      p.selectedId = selected;
      return route.fulfill({ json: p });
    }
    if (pathname === '/api/provider/key') {
      sentKey = route.request().postDataJSON().key;
      return route.fulfill({ json: { configured: true } });
    }
    if (pathname === '/api/provider/check')
      return route.fulfill({
        json: {
          message: 'Test bağlantısı doğrulandı.',
          imageModelListed: true,
          videoModelListed: true,
        },
      });
    if (pathname === '/api/status') {
      const response = await route.fetch();
      const json = await response.json();
      json.provider.configured = true;
      return route.fulfill({ json });
    }
    await route.continue();
  });
  await page.goto('/');
  await page.locator('.project-link').first().click();
  await expect(page.locator('.design-card .sheet-cell img')).toHaveCount(10);
  await page.locator('.design-card').nth(1).click();
  await expect(page.getByRole('dialog')).toContainText('Gerçek kolaj önizlemesi · hücre 2');
  await expect(page.getByRole('dialog').locator('.sheet-cell')).toHaveCSS('--cell-column', '1');
  await page.getByRole('button', { name: 'Bu tasarımı seç', exact: true }).click();
  expect(selected).toBe('C1-02');
  expect(p.assets.find((a) => a.code === 'C1')?.status).toBe('review');
  await page.getByRole('button', { name: 'İnternetten otomatik tamamla', exact: true }).click();
  await expect(page.locator('.research-panel')).toContainText(
    'Güncel kaynak araştırması tamamlandı.',
  );
  await page.getByRole('combobox', { name: 'Aşama', exact: true }).selectOption('production');
  await expect(page.getByLabel('Videoları da üret')).toBeChecked();
  await expect(page.locator('.automation-panel')).toContainText('18 görsel');
  await expect(page.locator('.automation-panel')).toContainText('11 adet 12 saniyelik video');
  await page.screenshot({ path: '/tmp/naberlo-automation-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/naberlo-automation-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Stüdyo ayarları', exact: true }).click();
  const key = page.getByLabel('OpenAI API anahtarı', { exact: true });
  await expect(key).toHaveAttribute('type', 'password');
  await key.fill('sk-ui-test-placeholder-no-real-key');
  await page.getByRole('button', { name: 'Anahtarı bağla ve kontrol et', exact: true }).click();
  await expect(page.getByText(/Test bağlantısı doğrulandı/)).toBeVisible();
  await expect(key).toHaveValue('');
  expect(sentKey).toBe('sk-ui-test-placeholder-no-real-key');
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(sentKey);
  expect(errors).toEqual([]);
});
