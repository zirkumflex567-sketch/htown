import { expect, test } from '@playwright/test';
import { quickPlay, registerUser, uniqueEmail } from './helpers';

test('pilot input updates HUD and boost toggle', async ({ page }) => {
  const creds = { email: uniqueEmail('pilot'), password: 'Test123!@#' };
  await registerUser(page, creds, 'pilot');
  await quickPlay(page);

  await expect(page.locator('#seat-label')).toContainText('PILOT');
  await page.click('#arena');

  const inputState = page.locator('#input-state');
  const before = (await inputState.textContent()) ?? '';

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(250);
  await page.keyboard.up('KeyW');

  const after = (await inputState.textContent()) ?? '';
  expect(after).not.toBe(before);

  const boostButton = page.locator('#pilot-boost');
  await page.keyboard.down('ShiftLeft');
  await expect(boostButton).toHaveAttribute('data-active', 'true');
  await page.keyboard.up('ShiftLeft');
  await expect(boostButton).toHaveAttribute('data-active', 'false');
});
