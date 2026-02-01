import { describe, expect, it } from 'vitest';
import { makeTestRoom } from './testUtils';
import { GameState } from '../rooms/schema/GameState';
import type { PlayerInput } from '@htown/shared';

describe('Seat stats', () => {
  it('tracks support actions', () => {
    const room = makeTestRoom();
    room.state = new GameState();
    room.inputs.set('support', { seat: 'support', support: { action: 'scan' } } as PlayerInput);
    room.updateSupportActions(0.1);
    expect(room.seatStats.support.scans).toBe(1);
  });

  it('tracks systems abilities', () => {
    const room = makeTestRoom();
    room.state = new GameState();
    room.inputs.set('systems', { seat: 'systems', systems: { abilityIndex: 0 } } as PlayerInput);
    room.updateSystemsAbilities(0.1);
    expect(room.seatStats.systems.uses).toBe(1);
  });
});
