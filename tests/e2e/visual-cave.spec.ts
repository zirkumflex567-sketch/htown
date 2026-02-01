import { expect, test } from '@playwright/test';

test('cave flythrough snapshot', async ({ page }) => {
  await page.goto('/?e2e=1&e2eScene=cave');
  await page.waitForFunction(() => (window as any).__htownE2E?.ready === true, null, { timeout: 60000 });
  const canvas = page.locator('#arena canvas');
  await expect(canvas).toHaveScreenshot('e2e-cave.png', { animations: 'disabled', maxDiffPixels: 50 });
});
