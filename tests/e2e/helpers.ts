import { expect, type Page } from '@playwright/test';

type Credentials = {
  email: string;
  password: string;
};

export function uniqueEmail(prefix = 'user') {
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e6).toString(36);
  return `${prefix}-${stamp}-${rand}@example.com`;
}

export async function registerUser(page: Page, creds: Credentials, seat?: string) {
  const seatQuery = seat ? `&e2eSeat=${encodeURIComponent(seat)}` : '';
  await page.goto(`/?e2e=1${seatQuery}`);
  await page.fill('#email', creds.email);
  await page.fill('#password', creds.password);
  await page.click('#register');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('accessToken')))
    .toBeTruthy();
}

export async function quickPlay(page: Page) {
  await page.click('#quick-play');
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
}

export async function createRoom(page: Page) {
  await page.click('#create-room');
  const status = page.locator('#room-status');
  await expect(status).toContainText('Room code:');
  const text = (await status.textContent()) ?? '';
  const match = /Room code:\s*([A-Za-z0-9]+)/.exec(text);
  if (!match) {
    throw new Error(`Room code not found in status: ${text}`);
  }
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  return match[1];
}

export async function joinRoom(page: Page, code: string) {
  await page.fill('#room-code', code);
  await page.click('#join-room');
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
}
