import { env } from '../env';
import { GameAdapter } from '../adapters/gameAdapter';
import { StubGameAdapter, seedStubData } from '../adapters/stubGameAdapter';
import { logger } from '../logging/logger';

let adapter: GameAdapter;
let logTimer: NodeJS.Timeout | null = null;

export async function initGameAdapter() {
  if (env.gameAdapter === 'stub') {
    adapter = new StubGameAdapter();
    await seedStubData();
    if (!logTimer) {
      logTimer = setInterval(() => {
        const sample = [
          { level: 'info', message: 'match.spawned', context: { mode: 'solo' } },
          { level: 'warn', message: 'room.high_latency', context: { roomId: 'room-2', ms: 180 } },
          { level: 'info', message: 'player.connected', context: { playerId: 'player-7' } },
          { level: 'error', message: 'db.slow_query', context: { ms: 420 } }
        ];
        const entry = sample[Math.floor(Math.random() * sample.length)];
        logger.log(entry.level as any, entry.message, entry.context);
      }, 8000);
    }
  } else {
    adapter = new StubGameAdapter();
  }
  return adapter;
}

export function getGameAdapter() {
  if (!adapter) {
    throw new Error('Game adapter not initialized');
  }
  return adapter;
}
