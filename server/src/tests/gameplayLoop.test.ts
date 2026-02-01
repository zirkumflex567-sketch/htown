import { describe, expect, it } from 'vitest';
import { makeTestRoom } from './testUtils';
import { GameState, PlayerState } from '../rooms/schema/GameState';
import { SeatSystem } from '../systems/SeatSystem';

describe('Gameplay loop smoke tests', () => {
  it('progresses score and waves with bots running', () => {
    const room = makeTestRoom();
    room.state = new GameState();
    room.state.phase = 'running';
    const seatSystem = new SeatSystem(room as never);
    const pilot = new PlayerState();
    pilot.id = 'pilot';
    pilot.seat = seatSystem.assignSeat(pilot.id, 'pilot');
    pilot.isBot = false;
    pilot.connected = true;
    room.state.players.set(pilot.id, pilot);
    room.refreshBots();
    room.invulUntil = Number.POSITIVE_INFINITY;
    room.clock.setTimeout = (() => ({ clear: () => {} })) as any;
    (room as any).upgradeSystem.update = () => {};
    room.inputs.set('pilot', { seat: 'pilot', move: { x: 1, y: 0 }, boost: true } as any);

    const initialScore = room.state.score;
    const initialWave = room.state.wave;
    for (let i = 0; i < 25; i += 1) {
      room.update(1000);
    }
    expect(room.state.score).toBeGreaterThan(initialScore);
    expect(room.state.wave).toBeGreaterThanOrEqual(initialWave);
    expect(room.state.enemies.length).toBeGreaterThan(0);
    expect(room.seatStats.pilot.distance).toBeGreaterThan(0);
  });

  it('resets run state after gameover', () => {
    const room = makeTestRoom();
    room.state = new GameState();
    room.state.phase = 'running';
    room.state.score = 420;
    room.state.wave = 6;
    room.state.ship.health = 0;
    room.saveScores = () => {};
    room.clock.setTimeout = (() => ({ clear: () => {} })) as any;
    (room as any).upgradeSystem.update = () => {};
    room.update(50);
    expect(room.state.score).toBe(0);
    expect(room.state.wave).toBe(1);
    expect(room.state.timeSurvived).toBe(0);
    expect(room.state.enemies.length).toBe(0);
  });
});
