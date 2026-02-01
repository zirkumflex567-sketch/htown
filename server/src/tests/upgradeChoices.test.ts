import { describe, expect, it, vi } from 'vitest';
import { mulberry32 } from '@htown/shared';
import { GameState } from '../rooms/schema/GameState';
import { UpgradeSystem } from '../systems/UpgradeSystem';

describe('Upgrade choices', () => {
  it('rolls three unique upgrade options', () => {
    const rng = mulberry32(1234);
    const room = {
      state: new GameState(),
      rng,
      clock: { setTimeout: () => ({ clear: vi.fn() }) },
      applyUpgrade: vi.fn()
    };
    const system = new UpgradeSystem(room as never);
    system.rollUpgrades();
    expect(room.state.upgradeChoices.length).toBe(3);
    const ids = room.state.upgradeChoices.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(3);
    room.state.upgradeChoices.forEach((choice) => {
      expect(choice.name.length).toBeGreaterThan(0);
      expect(choice.description.length).toBeGreaterThan(0);
      expect(choice.seat.length).toBeGreaterThan(0);
    });
  });
});
