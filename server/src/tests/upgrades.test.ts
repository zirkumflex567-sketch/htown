import { describe, expect, it } from 'vitest';
import { makeTestRoom } from './testUtils';

describe('Upgrades', () => {
  it('applies seat bonus upgrades correctly', () => {
    const room = makeTestRoom();
    room.applyUpgrade('pilot_turn');
    room.applyUpgrade('gunner_damage');
    room.applyUpgrade('power_shields');
    room.applyUpgrade('systems_cooldown');
    room.applyUpgrade('support_vision');

    expect(room.seatBonuses.pilot.speed).toBeGreaterThan(0);
    expect(room.seatBonuses.gunner.damage).toBeGreaterThan(0);
    expect(room.seatBonuses.power.shield).toBeGreaterThan(0);
    expect(room.seatBonuses.systems.cooldown).toBeGreaterThan(0);
    expect(room.seatBonuses.support.vision).toBeGreaterThan(0);
  });

  it('applies swap surge duration', () => {
    const room = makeTestRoom();
    room.applyUpgrade('swap_surge');
    expect(room.swapOverdriveSeconds).toBeGreaterThan(0);
  });
});
