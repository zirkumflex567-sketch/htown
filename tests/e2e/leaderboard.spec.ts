import { expect, test } from '@playwright/test';

test('leaderboard overlay renders data', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'test-token');
  });
  await page.route('**/leaderboard/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        me: {
          bestScore: 4200,
          totalRuns: 7,
          totalKills: 88,
          bestWave: 6,
          bestBossKills: 1
        }
      })
    });
  });
  await page.route('**/leaderboard/top', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        leaderboard: [
          { email: 'ace@crew.dev', bestScore: 9000, totalRuns: 12 },
          { email: 'pilot@crew.dev', bestScore: 7400, totalRuns: 9 }
        ]
      })
    });
  });

  await page.goto('/');
  await page.waitForSelector('#stats-fab');
  await page.evaluate(() => {
    const button = document.getElementById('stats-fab') as HTMLButtonElement | null;
    button?.click();
  });
  await expect(page.locator('#stats-overlay')).toBeVisible();
  await expect(page.locator('#stats-me')).toContainText('Best 4200');
  await expect(page.locator('#stats-leaderboard')).toContainText('ace@crew.dev');
});
