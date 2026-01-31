import { Room, Client } from '@colyseus/core';
import { SeatType } from '@htown/shared';
import { GameSim, SeatInput } from '../sim/game.js';
import { verifyToken } from '../auth.js';

const SEATS: SeatType[] = ['pilot', 'gunner', 'power', 'systems', 'support'];

type ClientData = {
  seat: SeatType;
  userId: string;
  email: string;
};

export class GameRoom extends Room {
  maxClients = 5;
  private sim = new GameSim(Date.now());
  private seatAssignments = new Map<string, SeatType>();
  private botSeats = new Set<SeatType>();
  private inputCache = new Map<SeatType, SeatInput>();
  private swapCountdown = 0;
  private nextSwapAt = 0;
  private swapGrace = 0;

  onCreate() {
    this.botSeats = new Set(SEATS);
    this.setSimulationInterval((deltaMs) => this.update(deltaMs / 1000), 50);
    this.resetSwapTimer();

    this.onMessage('input', (client, input: Partial<SeatInput>) => {
      const seat = this.seatAssignments.get(client.sessionId);
      if (!seat) {
        return;
      }
      const existing = this.inputCache.get(seat) ?? this.defaultInput();
      this.inputCache.set(seat, { ...existing, ...input });
    });

    this.onMessage('upgrade:apply', (client, upgradeId: string) => {
      const seat = this.seatAssignments.get(client.sessionId);
      if (!seat) {
        return;
      }
      this.sim.applyUpgrade(upgradeId);
      this.broadcast('upgrade:applied', { seat, upgradeId });
    });

    this.onMessage('upgrade:roll', () => {
      const options = this.sim.rollUpgrades();
      this.broadcast('upgrade:options', options);
    });
  }

  onAuth(_client: Client, options: { token?: string }) {
    if (!options.token) {
      return false;
    }
    try {
      return verifyToken(options.token);
    } catch (error) {
      return false;
    }
  }

  onJoin(client: Client, options: { userId?: string; email?: string }) {
    const seat = this.assignSeat(client);
    const auth = client.auth as { sub: string; email: string } | undefined;
    const payload: ClientData = {\n      seat,\n      userId: options.userId ?? auth?.sub ?? 'unknown',\n      email: options.email ?? auth?.email ?? 'unknown',\n    };
    this.setMetadata({ roomCode: this.roomId.slice(0, 6) });
    this.broadcast('player:join', payload);
  }

  async onLeave(client: Client) {
    const seat = this.seatAssignments.get(client.sessionId);
    if (!seat) {
      return;
    }
    try {
      await this.allowReconnection(client, 30);
    } catch (error) {
      this.seatAssignments.delete(client.sessionId);
      this.botSeats.add(seat);
      this.broadcast('player:leave', { seat });
    }
  }

  private update(delta: number) {
    this.updateSwap(delta);
    const reduction = this.swapCountdown > 0 || this.swapGrace > 0 ? 0.5 : 1;
    this.sim.setDamageMultiplier(reduction);
    const inputs = this.collectInputs();
    this.sim.tick(delta, inputs);
    const snapshot = this.sim.getSnapshot(this.currentAssignments(), {
      inCountdown: this.swapCountdown > 0,
      timeRemaining: Math.max(this.swapCountdown, 0),
    });
    this.broadcast('snapshot', snapshot);
  }

  private assignSeat(client: Client) {
    const used = new Set(this.seatAssignments.values());
    const available = SEATS.filter((seat) => !used.has(seat));
    const seat = available[0] ?? SEATS[0];
    this.seatAssignments.set(client.sessionId, seat);
    this.botSeats.delete(seat);
    return seat;
  }

  private collectInputs(): Partial<Record<SeatType, SeatInput>> {
    const inputs: Partial<Record<SeatType, SeatInput>> = {};
    for (const seat of SEATS) {
      if (this.botSeats.has(seat)) {
        inputs[seat] = this.botInput(seat);
      } else {
        inputs[seat] = this.inputCache.get(seat) ?? this.defaultInput();
      }
    }
    return inputs;
  }

  private defaultInput(): SeatInput {
    return {
      axisX: 0,
      axisY: 0,
      boost: false,
      fire: false,
      aim: { x: 1, y: 0 },
      weaponIndex: 0,
      powerDistribution: { engines: 0.34, weapons: 0.33, shields: 0.33 },
      abilities: {},
      support: { repair: false, ping: false, lootPulse: false },
    };
  }

  private botInput(seat: SeatType): SeatInput {
    const base = this.defaultInput();
    if (seat === 'pilot') {
      base.axisX = Math.sin(this.sim.time * 0.5) * 0.6;
      base.axisY = Math.cos(this.sim.time * 0.4) * 0.6;
      base.boost = Math.random() > 0.95;
    }
    if (seat === 'gunner') {
      base.fire = Math.random() > 0.2;
      base.aim = { x: Math.cos(this.sim.time), y: Math.sin(this.sim.time) };
    }
    if (seat === 'power') {
      base.powerDistribution = { engines: 0.3, weapons: 0.4, shields: 0.3 };
    }
    if (seat === 'systems') {
      base.abilities = { overdrive: Math.random() > 0.97 };
    }
    if (seat === 'support') {
      base.support.repair = this.sim.ship.hp < 70;
      base.support.ping = Math.random() > 0.98;
    }
    return base;
  }

  private updateSwap(delta: number) {
    if (this.swapGrace > 0) {
      this.swapGrace -= delta;
      return;
    }
    if (this.swapCountdown > 0) {
      this.swapCountdown -= delta;
      if (this.swapCountdown <= 0) {
        this.performSeatSwap();
        this.swapGrace = 2;
        this.resetSwapTimer();
      }
      return;
    }
    this.nextSwapAt -= delta;
    if (this.nextSwapAt <= 0) {
      this.swapCountdown = 3;
      this.broadcast('swap:warning', { countdown: 3 });
    }
  }

  private performSeatSwap() {
    const clients = Array.from(this.seatAssignments.keys());
    const shuffledSeats = shuffle([...SEATS]);
    clients.forEach((sessionId, index) => {
      const seat = shuffledSeats[index] ?? SEATS[index % SEATS.length];
      this.seatAssignments.set(sessionId, seat);
    });
    this.botSeats = new Set(SEATS.filter((seat) => !this.seatAssignmentsHasSeat(seat)));
    this.broadcast('swap:complete', this.currentAssignments());
  }

  private seatAssignmentsHasSeat(seat: SeatType) {
    for (const assignedSeat of this.seatAssignments.values()) {
      if (assignedSeat === seat) {
        return true;
      }
    }
    return false;
  }

  private resetSwapTimer() {
    this.nextSwapAt = 45 + Math.random() * 45;
  }

  private currentAssignments(): Record<string, SeatType> {
    const assignments: Record<string, SeatType> = {};
    for (const [sessionId, seat] of this.seatAssignments.entries()) {
      assignments[sessionId] = seat;
    }
    return assignments;
  }
}

function shuffle<T>(list: T[]): T[] {
  return list
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((entry) => entry.item);
}
