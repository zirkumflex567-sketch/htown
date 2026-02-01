import { expect, test } from '@playwright/test';
import { quickPlay, registerUser, uniqueEmail } from './helpers';

test('register, quick play, and overlays are usable', async ({ page }) => {
  const creds = { email: uniqueEmail('e2e'), password: 'Test123!@#' };
  await registerUser(page, creds);
  await quickPlay(page);

  await expect(page.locator('#seat-label')).toContainText('You are:');
  await expect(page.locator('#seat-indicator')).toBeVisible();
  await expect(page.locator('#weapon-select button')).toHaveCount(3);

  await page.evaluate(() => (document.getElementById('settings-fab') as HTMLButtonElement)?.click());
  await expect(page.locator('#settings-overlay')).not.toHaveClass(/hidden/);
  await page.check('#set-invert-y');
  await page.check('#set-left-handed');
  await expect(page.locator('body')).toHaveAttribute('data-hand', 'left');
  await expect(page.locator('#keybinds button')).toHaveCount(10);
  await page.locator('#set-mark-outline').fill('120');
  await page.click('#settings-close');
  await expect(page.locator('#settings-overlay')).toHaveClass(/hidden/);

  await page.evaluate(() => (document.getElementById('stats-fab') as HTMLButtonElement)?.click());
  await expect(page.locator('#stats-overlay')).not.toHaveClass(/hidden/);
  await page.click('#stats-close');
  await expect(page.locator('#stats-overlay')).toHaveClass(/hidden/);
});
