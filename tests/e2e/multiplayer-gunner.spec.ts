import { expect, test } from '@playwright/test';
import { createRoom, joinRoom, registerUser, uniqueEmail } from './helpers';

test('second player joins as gunner, reticle moves, and fire toggles', async ({ browser }) => {
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await registerUser(page1, { email: uniqueEmail('host'), password: 'Test123!@#' }, 'pilot');
  const code = await createRoom(page1);

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await registerUser(page2, { email: uniqueEmail('gunner'), password: 'Test123!@#' }, 'gunner');
  await joinRoom(page2, code);

  await expect(page1.locator('#seat-label')).toContainText('PILOT');
  await expect(page2.locator('#seat-label')).toContainText('GUNNER');

  const reticle = page2.locator('.reticle');
  const before = await reticle.evaluate((el) => (el as HTMLElement).style.transform);
  const canvas = page2.locator('#arena canvas[data-engine]');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Arena canvas not found');

  await page2.click('#arena');
  await page2.waitForTimeout(200);
  const targetX = canvasBox.x + canvasBox.width * 0.8;
  const targetY = canvasBox.y + canvasBox.height * 0.25;
  await canvas.dispatchEvent('mousemove', { clientX: targetX, clientY: targetY });
  await page2.waitForTimeout(200);
  const after = await reticle.evaluate((el) => (el as HTMLElement).style.transform);
  expect(after).not.toBe(before);

  await page2.mouse.down();
  await expect(page2.locator('#gunner-fire')).toHaveAttribute('data-active', 'true');
  await page2.mouse.up();
  await expect(page2.locator('#gunner-fire')).toHaveAttribute('data-active', 'false');

  await context2.close();
  await context1.close();
});
