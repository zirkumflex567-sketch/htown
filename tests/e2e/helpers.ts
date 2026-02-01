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
  await page.goto(`/?e2e=1${seatQuery}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#email', { timeout: 30000 });
  await page.evaluate(({ email, password }) => {
    const emailInput = document.querySelector('#email') as HTMLInputElement | null;
    const passwordInput = document.querySelector('#password') as HTMLInputElement | null;
    if (!emailInput || !passwordInput) {
      throw new Error('Auth inputs not found');
    }
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
  }, creds);
  await page.click('#register', { force: true, noWaitAfter: true });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('accessToken')))
    .toBeTruthy();
}

export async function quickPlay(page: Page) {
  await page.click('#quick-play');
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  await ensureRunStarted(page);
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
  await ensureRunStarted(page);
  return match[1];
}

export async function joinRoom(page: Page, code: string) {
  await page.fill('#room-code', code);
  await page.click('#join-room');
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  await ensureRunStarted(page);
}

export async function ensureRunStarted(page: Page) {
  const roomOverlay = page.locator('#room-overlay');
  try {
    if (await roomOverlay.isVisible({ timeout: 2000 })) {
      await page.click('#room-ready', { force: true });
      await expect(roomOverlay).toHaveClass(/hidden/);
    }
  } catch {
    // If the overlay never appears, assume the run already started.
  }
}
