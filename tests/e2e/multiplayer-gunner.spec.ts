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
  const arenaBox = await page2.locator('#arena').boundingBox();
  if (!arenaBox) throw new Error('Arena not found');

  await page2.click('#arena');
  await page2.waitForTimeout(200);
  await page2.mouse.move(arenaBox.x + arenaBox.width * 0.8, arenaBox.y + arenaBox.height * 0.25);
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
