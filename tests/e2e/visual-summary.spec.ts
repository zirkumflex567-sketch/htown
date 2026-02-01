import { expect, test } from '@playwright/test';

test('run summary snapshot', async ({ page }) => {
  await page.goto('/?e2e=1&e2eScene=summary');
  await page.waitForFunction(() => (window as any).__htownE2E?.ready === true);
  const hud = page.locator('.hud');
  await expect(hud).toHaveScreenshot('e2e-summary.png', { animations: 'disabled' });
});
