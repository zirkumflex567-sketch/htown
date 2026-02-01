import { expect, test } from '@playwright/test';

test('boss telegraph and radar snapshot', async ({ page }) => {
  await page.goto('/?e2e=1&e2eScene=telegraph');
  await page.waitForFunction(() => (window as any).__htownE2E?.ready === true);
  const canvas = page.locator('#arena canvas[data-engine]');
  await expect(canvas).toHaveScreenshot('e2e-telegraph.png', { animations: 'disabled' });
});
