import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('desktop production workflow, truthful generation state, persistence and export', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bir kulüp. Sonsuz olasılık.' })).toBeVisible();
  await page.screenshot({ path: '/tmp/naberlo-home.png', fullPage: true });
  await page.getByRole('button', { name: 'Yeni proje', exact: true }).last().click();
  await page.getByRole('textbox', { name: 'Kulüp ara', exact: true }).fill('Galatasaray');
  await page
    .getByRole('button', { name: /Galatasaray İstanbul/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Galatasaray.', exact: true })).toBeVisible();
  await expect(page.locator('.design-card')).toHaveCount(10);
  await page.screenshot({ path: '/tmp/naberlo-studio.png', fullPage: true });
  await page.getByRole('button', { name: 'Kolajı üret', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('STADIUM_OPENAI_API_KEY');
  await expect(page.getByRole('button', { name: '1 görsel üret', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();
  await page.getByRole('button', { name: 'Promptu aç', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Üretim promptu' })).toHaveValue(
    /exactly 2 columns by 5 rows/,
  );
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();
  await page.getByRole('button', { name: 'Yeni seri', exact: true }).click();
  await expect(page.getByText('B2-C1-01', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kimliği doğrula', exact: true }).click();
  await page.getByLabel('Resmi kulüp adı', { exact: true }).fill('Galatasaray Test');
  await page.getByRole('button', { name: 'Kimliği kaydet', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .locator('.reference-item input[type=file]')
    .first()
    .setInputFiles({
      name: 'site.png',
      mimeType: 'image/png',
      buffer: await sharp({
        create: { width: 500, height: 400, channels: 3, background: '#33452c' },
      })
        .png()
        .toBuffer(),
    });
  await expect(page.getByRole('dialog')).toContainText('Görsel kalite kontrolü');
  for (const box of await page.getByRole('dialog').getByRole('checkbox').all()) await box.check();
  await page.getByRole('button', { name: 'Kontrol ettim, kabul et', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Kabul edildi · değiştir', { exact: true })).toBeVisible();
  await page.reload();
  await page.locator('.project-link').first().click();
  await expect(page.getByText('B2-C1-01', { exact: true })).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Paketi indir', exact: true }).click();
  expect((await dl).suggestedFilename()).toMatch(/naberlo-.*\.zip/);
  await page.getByRole('button', { name: /Varyasyon motoru/ }).click();
  await page.locator('.variation-tabs button').nth(2).click();
  await expect(page.getByRole('heading', { name: 'Varyasyon kütüphanesi' })).toBeVisible();
  await page.getByRole('button', { name: 'Rastgele keşfet', exact: true }).click();
  await page.getByRole('button', { name: 'Projeye uygula', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Proje kaydedildi');
  expect(errors).toEqual([]);
});

test('mobile atlas search and layout without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bir kulüp. Sonsuz olasılık.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Menüyü aç' }).click();
  await page.getByRole('button', { name: 'Kulüp atlası', exact: true }).click();
  await page.getByRole('textbox', { name: 'Atlas kulüp araması' }).fill('Fenerbahce');
  await expect(
    page.getByRole('heading', { name: 'Fenerbahçe İstanbul', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Proje başlat', exact: true }).first().click();
  await expect(page.locator('.design-card')).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/naberlo-mobile.png', fullPage: true });
});
