import type { SeatType } from '@htown/shared';
import { randomInt } from '@htown/shared';
import type { GameRoom } from '../rooms/GameRoom';

const seats: SeatType[] = ['pilot', 'gunner', 'power', 'systems', 'support'];

export class SeatSystem {
  private nextSwapAt = 0;
  private warningAt = 0;
  private graceDuration = 2000;
  private warningDuration = 3000;

  constructor(private room: GameRoom) {
    this.scheduleNextSwap();
  }

  assignSeat(clientId: string) {
    const taken = new Set(Array.from(this.room.state.players.values()).map((player) => player.seat));
    const available = seats.find((seat) => !taken.has(seat));
    return available ?? seats[0];
  }

  scheduleNextSwap() {
    const now = this.room.simulationTime;
    const next = now + randomInt(this.room.rng, 45000, 90000);
    this.nextSwapAt = next;
    this.warningAt = next - this.warningDuration;
  }

  tick(deltaMs: number) {
    const now = this.room.simulationTime;
    if (now >= this.warningAt && now < this.nextSwapAt) {
      const countdown = Math.ceil((this.nextSwapAt - now) / 1000);
      this.room.state.swapCountdown = countdown;
      this.room.state.swapLabel = 'Swap incoming!';
      this.room.damageReduction = 0.5;
    }

    if (now >= this.nextSwapAt) {
      this.performSwap();
      this.room.state.swapCountdown = 0;
      this.room.state.swapGrace = Math.ceil(this.graceDuration / 1000);
      this.room.state.swapLabel = 'Seats swapped!';
      this.room.damageReduction = 0.3;
      this.room.swapGraceUntil = now + this.graceDuration;
      this.scheduleNextSwap();
    }

    if (this.room.swapGraceUntil && now > this.room.swapGraceUntil) {
      this.room.state.swapGrace = 0;
      this.room.state.swapLabel = '';
      this.room.damageReduction = 1;
      this.room.swapGraceUntil = 0;
    }
  }

  performSwap() {
    const humans = Array.from(this.room.state.players.values()).filter((player) => !player.isBot);
    const shuffledSeats = seats
      .slice()
      .sort(() => this.room.rng() - 0.5);

    humans.forEach((player, index) => {
      player.seat = shuffledSeats[index % seats.length];
    });

    this.room.refreshBots();
  }
}
