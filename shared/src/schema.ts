import { ArraySchema, Schema, type, MapSchema } from "@colyseus/schema";

export type SeatType = "pilot" | "gunner" | "power" | "systems" | "support";

export class SeatState extends Schema {
  @type("string") seatId: SeatType = "pilot";
  @type("string") occupantId = "";
  @type("string") occupantName = "";
  @type("string") controller = "bot"; // bot | player
}

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") seat: SeatType = "pilot";
  @type("number") score = 0;
}

export class ShipState extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
  @type("number") rotation = 0;
  @type("number") hp = 100;
  @type("number") shield = 50;
  @type("number") energyEngines = 0.33;
  @type("number") energyWeapons = 0.34;
  @type("number") energyShields = 0.33;
}

export class EnemyState extends Schema {
  @type("string") id = "";
  @type("string") kind = "chaser";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") hp = 10;
  @type("boolean") revealed = false;
}

export class UpgradeOption extends Schema {
  @type("string") id = "";
  @type("string") label = "";
  @type("string") seat = "";
}

export class RoomState extends Schema {
  @type("string") phase = "lobby";
  @type("number") tick = 0;
  @type("number") wave = 1;
  @type("number") timeElapsed = 0;
  @type("number") score = 0;
  @type(ShipState) ship = new ShipState();
  @type([EnemyState]) enemies = new ArraySchema<EnemyState>();
  @type([SeatState]) seats = new ArraySchema<SeatState>();
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("number") swapCountdown = 0;
  @type("number") swapGrace = 0;
  @type("number") nextSwapIn = 0;
  @type([UpgradeOption]) upgrades = new ArraySchema<UpgradeOption>();
  @type("string") announcer = "";
}
