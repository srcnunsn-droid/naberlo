import { test, expect } from '@playwright/test';
import { fixture } from '../fixtures';

test('short desktop and phone menus scroll to settings and keep API key entry reachable', async ({
  page,
}) => {
  const project = fixture();
  await page.route('**/api/projects', (route) =>
    route.fulfill({
      json: Array.from({ length: 5 }, (_, i) => ({
        ...project,
        id: `nav-${i}`,
        assetCount: 0,
        acceptedCount: 0,
      })),
    }),
  );
  await page.setViewportSize({ width: 1280, height: 540 });
  await page.goto('/');
  const sidebar = page.locator('.sidebar');
  const settings = sidebar.getByRole('button', { name: 'Stüdyo ayarları', exact: true });
  await expect(sidebar.locator('.project-link')).toHaveCount(5);
  await expect(settings).not.toBeInViewport();
  await sidebar.hover({ position: { x: 80, y: 240 } });
  await page.mouse.wheel(0, 1800);
  await expect.poll(() => sidebar.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(settings).toBeInViewport();
  await settings.click();
  const input = page.getByLabel('OpenAI API anahtarı', { exact: true });
  await input.fill('sk-navigation-test-placeholder');
  await expect(input).toHaveValue('sk-navigation-test-placeholder');
  await expect(input).toHaveAttribute('type', 'password');
  await page.screenshot({ path: '/tmp/naberlo-sidebar-desktop.png', fullPage: false });

  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Ayarlar', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Menüyü aç', exact: true }).click();
  await expect(sidebar).toHaveClass(/mobile-open/);
  await sidebar.hover({ position: { x: 80, y: 200 } });
  await page.mouse.wheel(0, 1800);
  await expect.poll(() => sidebar.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(settings).toBeInViewport();
  await settings.click();
  await expect(sidebar).not.toHaveClass(/mobile-open/);
  await input.fill('sk-phone-test-placeholder');
  await expect(input).toHaveValue('sk-phone-test-placeholder');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: '/tmp/naberlo-sidebar-mobile.png', fullPage: false });
  // The top shortcut also reaches settings without opening or scrolling the menu.
  await page.goto('/');
  await page.getByRole('button', { name: 'Ayarlar', exact: true }).click();
  await expect(input).toBeVisible();
});
