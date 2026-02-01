import { describe, expect, it } from 'vitest';
import { makeTestRoom } from './testUtils';
import { GameState } from '../rooms/schema/GameState';

describe('Crew combos', () => {
  it('triggers execution combo on marked kill + scan + weapons surge', () => {
    const room = makeTestRoom();
    room.state = new GameState();
    room.simulationTime = 10000;
    room.state.ship.energyWeapons = 0.7;
    room.lastMarkedKillAt = 9.6;
    room.lastSupportScanAt = 9.2;
    (room as any).checkCombos();
    expect(room.state.comboName).toBe('Execution Combo');
    expect(room.state.ship.comboDamageUntil).toBeGreaterThan(9.6);
  });

  it('triggers momentum combo on overdrive + boost + engines shift', () => {
    const room = makeTestRoom();
    room.state = new GameState();
    room.simulationTime = 8000;
    room.lastSystemsOverdriveAt = 7.7;
    room.lastPilotBoostAt = 7.9;
    room.lastPowerShiftEnginesAt = 7.85;
    (room as any).checkCombos();
    expect(room.state.comboName).toBe('Momentum Surge');
    expect(room.state.ship.comboTrailUntil).toBeGreaterThan(7.8);
  });

  it('triggers stabilization combo on perfect repair during shield burst', () => {
    const room = makeTestRoom();
    room.state = new GameState();
    room.simulationTime = 6000;
    room.lastSupportRepairPerfectAt = 5.7;
    room.lastSystemsShieldAt = 5.75;
    (room as any).checkCombos();
    expect(room.state.comboName).toBe('Perfect Stabilization');
    expect(room.state.ship.hullRegenUntil).toBeGreaterThan(5.7);
  });
});
