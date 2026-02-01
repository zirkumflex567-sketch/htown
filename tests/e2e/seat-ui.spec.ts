import { expect, test } from '@playwright/test';

const seats = ['pilot', 'gunner', 'power', 'systems', 'support'] as const;

test('seat ui snapshots (desktop)', async ({ page }) => {
  await page.goto('/?e2e=1&e2eScene=projectiles&e2eSeat=pilot');
  await page.waitForFunction(() => (window as any).__htownE2E?.ready === true);
  const arena = page.locator('#arena');

  await expect(arena).toHaveScreenshot('seat-swap-before.png', { animations: 'disabled' });
  await page.evaluate(() => (window as any).__htownSetSeat?.('power'));
  await page.waitForTimeout(200);
  await expect(arena).toHaveScreenshot('seat-swap-after.png', { animations: 'disabled' });

  for (const seat of seats) {
    await page.evaluate((nextSeat) => (window as any).__htownSetSeat?.(nextSeat), seat);
    await page.waitForTimeout(150);
    await expect(arena).toHaveScreenshot(`seat-${seat}-desktop.png`, { animations: 'disabled' });
  }
});

test('seat ui snapshots (mobile)', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 860 });
  await page.goto('/?e2e=1&e2eScene=projectiles&e2eSeat=pilot');
  await page.waitForFunction(() => (window as any).__htownE2E?.ready === true);
  const arena = page.locator('#arena');
  for (const seat of seats) {
    await page.evaluate((nextSeat) => (window as any).__htownSetSeat?.(nextSeat), seat);
    await page.waitForTimeout(150);
    await expect(arena).toHaveScreenshot(`seat-${seat}-mobile.png`, { animations: 'disabled' });
  }
});
