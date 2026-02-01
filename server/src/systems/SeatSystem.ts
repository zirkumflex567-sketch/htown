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

  assignSeat(clientId: string, preferred?: SeatType) {
    const taken = new Set(
      Array.from(this.room.state.players.values())
        .filter((player) => !player.isBot)
        .map((player) => player.seat)
    );
    if (preferred && !taken.has(preferred)) {
      return preferred;
    }
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
    if (this.room.mode !== 'crew') return;
    const now = this.room.simulationTime;
    if (now >= this.warningAt && now < this.nextSwapAt) {
      const countdown = Math.ceil((this.nextSwapAt - now) / 1000);
      this.room.state.swapCountdown = countdown;
      this.room.state.swapLabel = 'Swap incoming!';
      this.room.damageReduction = 0.5;
    }

    if (now >= this.nextSwapAt) {
      const ship = this.room.state.ship;
      const speed = Math.hypot(ship.velocity.x, ship.velocity.y);
      const bossTelegraph = this.room.state.enemies.some(
        (enemy) => isBossKind(enemy.kind) && enemy.telegraphUntil > now / 1000
      );
      if (speed > 140 || bossTelegraph) {
        this.nextSwapAt = now + 3000;
        this.warningAt = this.nextSwapAt - this.warningDuration;
        this.room.state.swapLabel = 'Swap delayed';
        return;
      }
      this.performSwap();
      this.room.state.swapCountdown = 0;
      this.room.state.swapGrace = Math.ceil(this.graceDuration / 1000);
      this.room.state.swapLabel = 'Seats swapped!';
      this.room.damageReduction = 0.3;
      this.room.swapGraceUntil = now + this.graceDuration;
      this.room.enableSeatStabilizer(this.graceDuration);
      if (this.room.swapOverdriveSeconds > 0) {
        this.room.state.systems.overdriveUntil = now / 1000 + this.room.swapOverdriveSeconds;
      }
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
    const lockedPlayers = this.room.lockedPlayers ?? new Set<string>();
    const humans = Array.from(this.room.state.players.values()).filter(
      (player) => !player.isBot && !lockedPlayers.has(player.id)
    );
    if (humans.length === 0) return;
    if (humans.length === 1) {
      const current = humans[0].seat;
      const options = seats.filter((seat) => seat !== current);
      const next = options[Math.floor(this.room.rng() * options.length)];
      humans[0].seat = next;
      this.room.refreshBots();
      return;
    }

    let shuffledSeats = seats.slice();
    let attempts = 0;
    while (attempts < 12) {
      shuffledSeats = seats.slice().sort(() => this.room.rng() - 0.5);
      const collision = humans.some((player, index) => shuffledSeats[index % seats.length] === player.seat);
      if (!collision) break;
      attempts += 1;
    }

    humans.forEach((player, index) => {
      player.seat = shuffledSeats[index % seats.length];
    });

    this.room.refreshBots();
  }
}

function isBossKind(kind: string) {
  return kind.startsWith('boss-');
}
