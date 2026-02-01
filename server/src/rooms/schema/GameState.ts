import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import type { SeatType } from '@htown/shared';

export class Vec2 extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
}

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') seat: SeatType = 'pilot';
  @type('boolean') isBot = false;
  @type('boolean') connected = true;
}

export class EnemyState extends Schema {
  @type('string') id = '';
  @type('string') kind = 'chaser';
  @type(Vec2) position = new Vec2();
  @type('number') health = 0;
}

export class ShipState extends Schema {
  @type(Vec2) position = new Vec2();
  @type(Vec2) velocity = new Vec2();
  @type('number') heading = 0;
  @type('number') health = 100;
  @type('number') shield = 50;
  @type('number') energyEngines = 0.33;
  @type('number') energyWeapons = 0.33;
  @type('number') energyShields = 0.34;
  @type('number') visionRadius = 160;
}

export class UpgradeState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') description = '';
}

export class GameState extends Schema {
  @type(ShipState) ship = new ShipState();
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([EnemyState]) enemies = new ArraySchema<EnemyState>();
  @type([UpgradeState]) upgradeChoices = new ArraySchema<UpgradeState>();
  @type('number') score = 0;
  @type('number') wave = 1;
  @type('number') timeSurvived = 0;
  @type('number') swapCountdown = 0;
  @type('number') swapGrace = 0;
  @type('string') swapLabel = '';
}
