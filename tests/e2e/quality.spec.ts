import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fixture, asset } from '../fixtures';
import { videoConfiguration, animaticSignature } from '../../shared/video-state';

test('preview approval is explicit and a quality finding seeks to its second without granting human approval', async ({
  page,
}) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'naberlo-quality-ui-'));
  try {
    const file = path.join(dir, 'clip.mp4');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:s=180x320:r=30:d=4',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-y',
      file,
    ]);
    const bytes = await fs.readFile(file),
      p = fixture();
    p.story = {
      recipeId: 'rebirth',
      autoAssemble: true,
      audio: 'mute',
      title: '',
      closing: '',
      continuity: true,
      previewFirst: true,
      autoQuality: true,
    };
    p.assets = ['SITE', 'CREST', 'R0', 'E0', 'C1', 'D0', 'NB0', 'FW0', 'FWF'].map(asset);
    p.selectedId = 'C1-01';
    p.animatic = {
      id: 'preview',
      status: 'done',
      configuration: animaticSignature(p),
      url: '/media/clip.mp4',
      seconds: 20,
    };
    p.videos = [
      {
        id: 'v1',
        code: 'V1',
        filename: 'clip.mp4',
        url: '/media/clip.mp4',
        providerId: 'mock',
        model: 'mock',
        seconds: 4,
        status: 'review',
        references: ['asset-R0', 'asset-E0'],
        configuration: videoConfiguration(p),
        createdAt: '2026-10-23',
        quality: {
          id: 'quality',
          startedAt: '2026-10-23',
          status: 'done',
          summary: 'Kumaş sınırını inceleyin.',
          findings: [
            {
              time: 1.25,
              category: 'physics',
              severity: 'warning',
              observation: 'Örnek bulgu.',
              repair: 'Teması kontrol edin.',
            },
          ],
        },
      },
    ];
    p.research = {
      id: 'old-research',
      status: 'failed',
      startedAt: '2026-10-23',
      warnings: [],
      message:
        '[{"validation":"url","code":"invalid_string","message":"Invalid url","path":["facts",0,"sources",0]}]',
    };
    let approved = 0;
    await page.route('**/media/clip.mp4', (route) =>
      route.fulfill({ contentType: 'video/mp4', body: bytes }),
    );
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url()).pathname;
      if (url === '/api/projects')
        return route.fulfill({
          json: [{ ...p, assetCount: p.assets.length, acceptedCount: p.assets.length }],
        });
      if (url === '/api/projects/test') return route.fulfill({ json: p });
      if (url === '/api/projects/test/automation' || url === '/api/jobs')
        return route.fulfill({ json: [] });
      if (url === '/api/projects/test/animatic/preview/approve') {
        approved++;
        p.animatic!.approvedAt = new Date().toISOString();
        return route.fulfill({ json: p });
      }
      await route.continue();
    });
    await page.goto('/');
    await page.locator('.project-link').first().click();
    await expect(page.locator('.research-panel')).not.toContainText('invalid_string');
    await expect(page.locator('.research-panel')).toContainText('kaynak bağlantıları okunamadı');
    expect(approved).toBe(0);
    await page
      .getByRole('button', { name: 'Taslağı onayla · video aşamasına geç', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Taslak onaylandı', exact: true }),
    ).toBeDisabled();
    expect(approved).toBe(1);
    await page
      .getByText('Klipleri kontrol et ve kesme aralıklarını düzenle', { exact: true })
      .click();
    await page.getByRole('button', { name: '1.25 sn · İncelenmeli', exact: true }).click();
    const video = page.getByLabel('V1 klibini izle', { exact: true });
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeCloseTo(1.25, 1);
    await expect(page.getByLabel('Şehir ve kamera sabit', { exact: true })).not.toBeChecked();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: '/tmp/naberlo-quality-mobile.png', fullPage: true });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
