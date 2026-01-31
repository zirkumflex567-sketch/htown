import { Room, Client } from "colyseus";
import { RoomState, SeatState, PlayerState, SeatType } from "@htown/shared";
import { createDefaultInputs, createRuntime, updateSimulation, applyUpgrade } from "../game/sim";
import { updateBots } from "../game/bots";
import { verifyToken } from "../auth/tokens";
import type { Database } from "../db/types";

const seatOrder: SeatType[] = ["pilot", "gunner", "power", "systems", "support"];

export type ClientSession = {
  accountId: string;
  name: string;
};

export class GameRoom extends Room<RoomState> {
  static database: Database | null = null;

  private inputs = createDefaultInputs();
  private runtime = createRuntime(Math.floor(Math.random() * 100000));
  private seatAssignments = new Map<SeatType, string>();
  private sessionAccounts = new Map<string, string>();
  private recorded = false;

  onCreate(options: { code?: string }): void {
    const code = options?.code ?? this.roomId.slice(0, 6);
    this.setMetadata({ code });

    const state = new RoomState();
    state.phase = "running";
    state.nextSwapIn = this.randomSwapTime();
    state.ship.x = 0;
    state.ship.y = 0;
    state.ship.hp = 100;
    state.ship.shield = 50;
    for (const seatId of seatOrder) {
      const seat = new SeatState();
      seat.seatId = seatId;
      seat.controller = "bot";
      state.seats.push(seat);
    }
    this.setState(state);

    this.onMessage("input", (client, message) => {
      const seat = this.state.players.get(client.sessionId)?.seat;
      if (!seat) return;
      if (seat === "pilot") {
        this.inputs.pilot = { ...this.inputs.pilot, ...message };
      }
      if (seat === "gunner") {
        this.inputs.gunner = { ...this.inputs.gunner, ...message };
      }
      if (seat === "power") {
        this.inputs.power = { ...this.inputs.power, ...message };
      }
      if (seat === "systems") {
        this.inputs.systems = { ...this.inputs.systems, ...message };
      }
      if (seat === "support") {
        this.inputs.support = { ...this.inputs.support, ...message };
      }
    });

    this.onMessage("upgrade", (_client, message) => {
      if (!message?.id) return;
      applyUpgrade(this.state, this.runtime, message.id);
    });

    this.setSimulationInterval((dt) => this.update(dt / 1000));
  }

  async onAuth(client: Client, options: { accessToken?: string; name?: string }) {
    const token = options.accessToken;
    if (!token) {
      throw new Error("missing token");
    }
    const payload = verifyToken(token);
    if (!payload) {
      throw new Error("invalid token");
    }
    return {
      accountId: payload.sub,
      name: options.name ?? "Pilot",
    } satisfies ClientSession;
  }

  onJoin(client: Client, _options: unknown, auth: ClientSession): void {
    const seatId = this.assignSeat(client.sessionId, auth.name);
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = auth.name;
    player.seat = seatId;
    this.state.players.set(client.sessionId, player);
    this.sessionAccounts.set(client.sessionId, auth.accountId);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    if (consented) {
      this.removePlayer(client.sessionId);
      return;
    }
    try {
      await this.allowReconnection(client, 30);
    } catch {
      this.removePlayer(client.sessionId);
    }
  }

  private removePlayer(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    if (player) {
      this.state.players.delete(sessionId);
      this.releaseSeat(player.seat);
    }
    this.sessionAccounts.delete(sessionId);
  }

  private assignSeat(sessionId: string, name: string): SeatType {
    const open = seatOrder.find((seat) => !this.seatAssignments.has(seat));
    if (!open) {
      throw new Error("Room full");
    }
    this.seatAssignments.set(open, sessionId);
    const seatState = this.state.seats.find((seat) => seat.seatId === open);
    if (seatState) {
      seatState.occupantId = sessionId;
      seatState.occupantName = name;
      seatState.controller = "player";
    }
    return open;
  }

  private releaseSeat(seatId: SeatType): void {
    this.seatAssignments.delete(seatId);
    const seatState = this.state.seats.find((seat) => seat.seatId === seatId);
    if (seatState) {
      seatState.occupantId = "";
      seatState.occupantName = "";
      seatState.controller = "bot";
    }
  }

  private randomSwapTime(): number {
    return 45 + Math.random() * 45;
  }

  private update(dt: number): void {
    if (this.state.phase !== "running") return;

    this.state.nextSwapIn -= dt;
    if (this.state.nextSwapIn <= 3 && this.state.swapCountdown <= 0) {
      this.state.swapCountdown = 3;
      this.state.announcer = "Seat swap incoming";
    }
    if (this.state.swapCountdown > 0) {
      this.state.swapCountdown = Math.max(0, this.state.swapCountdown - dt);
      if (this.state.swapCountdown === 0) {
        this.swapSeats();
        this.state.swapGrace = 2;
        this.state.nextSwapIn = this.randomSwapTime();
      }
    }
    if (this.state.swapGrace > 0) {
      this.state.swapGrace = Math.max(0, this.state.swapGrace - dt);
    }

    updateBots(this.state, this.inputs);
    updateSimulation(this.state, this.runtime, this.inputs, dt);

    if (this.state.phase === "ended" && !this.recorded) {
      void this.recordRun();
      this.recorded = true;
    }
  }

  private swapSeats(): void {
    const players = [...this.state.players.values()];
    const seats = players.map((player) => player.seat);
    for (let i = seats.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [seats[i], seats[j]] = [seats[j], seats[i]];
    }
    players.forEach((player, idx) => {
      const newSeat = seats[idx];
      this.releaseSeat(player.seat);
      player.seat = newSeat;
      this.seatAssignments.set(newSeat, player.id);
      const seatState = this.state.seats.find((seat) => seat.seatId === newSeat);
      if (seatState) {
        seatState.occupantId = player.id;
        seatState.occupantName = player.name;
        seatState.controller = "player";
      }
    });
  }

  private async recordRun(): Promise<void> {
    if (!GameRoom.database) return;
    const stats = {
      score: this.state.score,
      time: this.state.timeElapsed,
      wave: this.state.wave,
    };
    const uniqueAccounts = new Set(this.sessionAccounts.values());
    for (const accountId of uniqueAccounts) {
      await GameRoom.database.recordRun(accountId, this.state.score, stats);
    }
  }
}
