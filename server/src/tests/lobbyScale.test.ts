import { describe, expect, it } from 'vitest';
import { makeTestRoom } from './testUtils';
import { GameState, PlayerState } from '../rooms/schema/GameState';
import { SeatSystem } from '../systems/SeatSystem';

const seatList = ['pilot', 'gunner', 'power', 'systems', 'support'] as const;

function createRoomWithHumans(count: number, seed = 0.5) {
  const room = makeTestRoom();
  room.state = new GameState();
  room.rng = () => seed;
  const seatSystem = new SeatSystem(room as never);
  for (let i = 0; i < count; i += 1) {
    const player = new PlayerState();
    player.id = `human-${i}`;
    player.isBot = false;
    player.connected = true;
    player.seat = seatSystem.assignSeat(player.id);
    room.state.players.set(player.id, player);
  }
  room.refreshBots();
  return room;
}

describe('Lobby scale', () => {
  it('handles 1-5 players with bots filling remaining seats', () => {
    for (let count = 1; count <= 5; count += 1) {
      const room = createRoomWithHumans(count);
      const humans = Array.from(room.state.players.values()).filter((p) => !p.isBot);
      const bots = Array.from(room.state.players.values()).filter((p) => p.isBot);
      expect(humans.length).toBe(count);
      expect(bots.length).toBe(5 - count);
      const seats = humans.map((p) => p.seat);
      expect(new Set(seats).size).toBe(seats.length);
      bots.forEach((bot) => expect(seatList.includes(bot.seat as any)).toBe(true));
    }
  });

  it('spins up multiple lobbies totaling 100 humans with mixed seat fills', () => {
    const roomSizes = [
      ...Array(10).fill(5),
      ...Array(8).fill(4),
      ...Array(3).fill(3),
      ...Array(3).fill(2),
      ...Array(3).fill(1)
    ];
    const total = roomSizes.reduce((sum, value) => sum + value, 0);
    expect(total).toBe(100);

    const rooms = roomSizes.map((count, idx) => createRoomWithHumans(count, 0.2 + idx * 0.01));
    rooms.forEach((room, idx) => {
      const humans = Array.from(room.state.players.values()).filter((p) => !p.isBot);
      const bots = Array.from(room.state.players.values()).filter((p) => p.isBot);
      expect(humans.length + bots.length).toBe(5);
      const seats = humans.map((p) => p.seat);
      expect(new Set(seats).size).toBe(seats.length);
      const seatCoverage = new Set(Array.from(room.state.players.values()).map((p) => p.seat));
      seatList.forEach((seat) => {
        expect(seatCoverage.has(seat)).toBe(true);
      });
      expect(idx).toBeGreaterThanOrEqual(0);
    });
  });
});
