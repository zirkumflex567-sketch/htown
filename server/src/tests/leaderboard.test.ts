import { afterAll, describe, expect, it, vi } from 'vitest';

describe('Leaderboard', () => {
  afterAll(async () => {
    const db = await import('../db');
    db.closeDb();
  });

  it('records runs and orders by best score', async () => {
    vi.resetModules();
    process.env.SQLITE_PATH = ':memory:';
    const db = await import('../db');
    db.initDb();

    db.createUser({
      id: 'u1',
      email: 'u1@example.com',
      password_hash: 'hash',
      best_score: 0,
      total_runs: 0,
      total_kills: 0,
      best_wave: 0,
      best_boss_kills: 0,
      last_run_stats: null,
      last_run_summary: null,
      refresh_token: null
    });
    db.createUser({
      id: 'u2',
      email: 'u2@example.com',
      password_hash: 'hash',
      best_score: 0,
      total_runs: 0,
      total_kills: 0,
      best_wave: 0,
      best_boss_kills: 0,
      last_run_stats: null,
      last_run_summary: null,
      refresh_token: null
    });

    db.updateRunStats('u1', { score: 120, kills: 4, wave: 3, bossKills: 0, summary: '{}' });
    db.updateRunStats('u2', { score: 250, kills: 10, wave: 5, bossKills: 1, summary: '{}' });

    const leaderboard = db.getLeaderboard(10);
    expect(leaderboard[0].id).toBe('u2');
    expect(leaderboard[0].bestScore).toBe(250);
    expect(leaderboard[1].id).toBe('u1');
  });
});
