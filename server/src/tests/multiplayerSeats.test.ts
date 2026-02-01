import { describe, expect, it } from 'vitest';
import { SeatSystem } from '../systems/SeatSystem';
import { GameState, PlayerState } from '../rooms/schema/GameState';

describe('Multiplayer seat assignment', () => {
  it('assigns unique seats for multiple players', () => {
    const room = {
      state: new GameState(),
      rng: () => 0.12,
      simulationTime: 0,
      damageReduction: 1,
      swapGraceUntil: 0,
      swapOverdriveSeconds: 0,
      enableSeatStabilizer: () => {},
      refreshBots: () => {}
    };
    const system = new SeatSystem(room as never);
    const players = ['p1', 'p2', 'p3'].map((id) => {
      const player = new PlayerState();
      player.id = id;
      player.seat = system.assignSeat(id);
      room.state.players.set(id, player);
      return player;
    });
    const seats = players.map((player) => player.seat);
    const uniqueSeats = new Set(seats);
    expect(uniqueSeats.size).toBe(seats.length);
  });
});
