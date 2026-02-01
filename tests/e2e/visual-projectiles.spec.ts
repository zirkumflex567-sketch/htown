import { expect, test } from '@playwright/test';

test('projectile visuals snapshot', async ({ page }) => {
  await page.goto('/?e2e=1&e2eScene=projectiles');
  await page.waitForFunction(() => (window as any).__htownE2E?.ready === true);
  const canvas = page.locator('#arena canvas');
  await expect(canvas).toHaveScreenshot('e2e-projectiles.png', { animations: 'disabled' });
});
