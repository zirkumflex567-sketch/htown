import { expect, test } from '@playwright/test';

test('enemy wave snapshot', async ({ page }) => {
  await page.goto('/?e2e=1&e2eScene=wave');
  await page.waitForFunction(() => (window as any).__htownE2E?.ready === true);
  const canvas = page.locator('#arena canvas[data-engine]');
  await expect(canvas).toHaveScreenshot('e2e-wave.png', { animations: 'disabled' });
});
