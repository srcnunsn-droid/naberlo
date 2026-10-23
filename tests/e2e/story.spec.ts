import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
test('film recipe persists, real reference upload yields twelve frames, and mobile editor fits', async ({
  page,
  request,
}) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'naberlo-story-ui-')),
    file = path.join(dir, 'reference.mp4');
  try {
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:s=180x320:r=30:d=1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-y',
      file,
    ]);
    const catalog = await (await request.get('/api/clubs?q=Galatasaray')).json();
    const p = await (
      await request.post('/api/projects', { data: { clubId: catalog.items[0].id } })
    ).json();
    await page.goto('/');
    await page.locator('.project-link').first().click();
    await page.getByRole('combobox', { name: 'Film akışı', exact: true }).selectOption('road');
    await page.getByLabel('Açılış yazısı', { exact: true }).fill('İstanbul: yeni bir gece');
    await page.getByLabel('Aynı sahnenin devamında önceki klibin son karesini kullan').check();
    await page
      .getByLabel('Video üretiminden önce hareketli taslağı hazırla ve onayımı bekle')
      .check();
    await page.getByRole('button', { name: 'Film akışını kaydet', exact: true }).click();
    await expect(page.locator('.story-timeline li')).toHaveCount(3);
    await expect(
      page.getByRole('button', { name: 'Film akışını kaydet', exact: true }),
    ).toBeDisabled();
    const saved = await (await request.get(`/api/projects/${p.id}`)).json();
    expect(saved.story.recipeId).toBe('road');
    expect(saved.story.continuity).toBe(true);
    expect(saved.story.previewFirst).toBe(true);
    expect(saved.story.autoQuality).toBe(false);
    await expect(
      page.getByRole('button', { name: 'Hareketli taslak oluştur', exact: true }),
    ).toBeDisabled();
    expect(saved.story.title).toBe('İstanbul: yeni bir gece');
    await page.locator('.story-panel summary').filter({ hasText: 'Referans videolarım' }).click();
    await page
      .locator('.story-panel input[accept="video/mp4,video/quicktime"]')
      .setInputFiles(file);
    await expect(page.locator('.reference-frames figure')).toHaveCount(12, { timeout: 20000 });
    await expect(
      page.getByRole('button', { name: 'Kareleri AI ile analiz et · API', exact: true }),
    ).toBeDisabled();
    await page.screenshot({ path: '/tmp/naberlo-story-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.screenshot({ path: '/tmp/naberlo-story-mobile.png', fullPage: true });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
