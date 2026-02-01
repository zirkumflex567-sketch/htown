import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import type { GameMode, SeatType } from '@htown/shared';

export class Vec2 extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
}

export class Vec3 extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
}

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') seat: SeatType = 'pilot';
  @type('boolean') isBot = false;
  @type('boolean') connected = true;
  @type('boolean') ready = false;
}

export class SeatInputState extends Schema {
  @type('string') seat: SeatType = 'pilot';
  @type(Vec2) move = new Vec2();
  @type(Vec2) aim = new Vec2();
  @type('number') lift = 0;
  @type('boolean') boost = false;
  @type('boolean') fire = false;
  @type('number') weaponIndex = 0;
  @type('number') powerEngines = 0.33;
  @type('number') powerWeapons = 0.33;
  @type('number') powerShields = 0.34;
  @type('string') powerPreset = 'balanced';
  @type('number') systemsAbility = -1;
  @type('string') supportAction = '';
}

export class EnemyState extends Schema {
  @type('string') id = '';
  @type('string') kind = 'chaser';
  @type(Vec3) position = new Vec3();
  @type(Vec3) velocity = new Vec3();
  @type('number') yaw = 0;
  @type('number') markedUntil = 0;
  @type('number') exposedUntil = 0;
  @type('number') volatileUntil = 0;
  @type('number') trackingUntil = 0;
  @type('number') weakpointUntil = 0;
  @type('number') slowUntil = 0;
  @type('number') shockedUntil = 0;
  @type('number') poisonedUntil = 0;
  @type('number') telegraphUntil = 0;
  @type('number') attackCooldown = 0;
  @type('string') attackMode = '';
  @type('number') health = 0;
}

export class ShipState extends Schema {
  @type(Vec3) position = new Vec3();
  @type(Vec3) velocity = new Vec3();
  @type('number') heading = 0;
  @type('number') health = 100;
  @type('number') shield = 50;
  @type('number') energyEngines = 0.33;
  @type('number') energyWeapons = 0.33;
  @type('number') energyShields = 0.34;
  @type('number') visionRadius = 160;
  @type('number') powerTargetEngines = 0.33;
  @type('number') powerTargetWeapons = 0.33;
  @type('number') powerTargetShields = 0.34;
  @type('number') powerInstability = 0;
  @type('number') powerHeat = 0;
  @type('number') powerWindowStart = 0;
  @type('number') powerWindowEnd = 0;
  @type('string') powerWindowType = '';
  @type('number') powerOverloadUntil = 0;
  @type('number') powerPerfectUntil = 0;
  @type('number') visionPulseUntil = 0;
  @type('number') comboSpeedUntil = 0;
  @type('number') comboTrailUntil = 0;
  @type('number') comboDamageUntil = 0;
  @type('number') hullRegenUntil = 0;
  @type('number') scoreBoostUntil = 0;
  @type('number') reflectUntil = 0;
  @type('number') chainUntil = 0;
  @type('number') poisonUntil = 0;
  @type('number') pierceUntil = 0;
  @type('number') boomerangUntil = 0;
}

export class UpgradeState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') description = '';
  @type('string') seat = 'all';
}

export class LootModState extends Schema {
  @type('string') name = '';
  @type('string') description = '';
  @type(['string']) tags = new ArraySchema<string>();
}

export class LootWeaponState extends Schema {
  @type('string') name = '';
  @type('string') rarity = 'common';
  @type('number') powerScore = 0;
  @type(['string']) tags = new ArraySchema<string>();
  @type({ map: 'number' }) stats = new MapSchema<number>();
  @type([LootModState]) mods = new ArraySchema<LootModState>();
  @type('string') quirkName = '';
  @type('string') quirkDescription = '';
  @type(['string']) quirkTags = new ArraySchema<string>();
}

export class LootUpgradeState extends Schema {
  @type('string') name = '';
  @type('string') rarity = 'common';
  @type('string') description = '';
  @type(['string']) tags = new ArraySchema<string>();
}

export class LootSynergyState extends Schema {
  @type('string') name = '';
  @type('string') description = '';
  @type(['string']) requirements = new ArraySchema<string>();
}

export class LootState extends Schema {
  @type('number') seed = 0;
  @type([LootWeaponState]) weapons = new ArraySchema<LootWeaponState>();
  @type([LootUpgradeState]) upgrades = new ArraySchema<LootUpgradeState>();
  @type([LootSynergyState]) synergies = new ArraySchema<LootSynergyState>();
}

export class ProjectileState extends Schema {
  @type('string') id = '';
  @type('string') kind = 'mg';
  @type('string') owner = 'player';
  @type(Vec3) position = new Vec3();
  @type(Vec3) velocity = new Vec3();
  @type('number') ttl = 0;
  @type('number') initialTtl = 0;
  @type('number') damage = 0;
  @type('number') pierceRemaining = 0;
  @type('boolean') boomerang = false;
  @type('boolean') returning = false;
}

export class SystemsState extends Schema {
  @type('number') empCooldown = 0;
  @type('number') shieldCooldown = 0;
  @type('number') slowCooldown = 0;
  @type('number') overdriveCooldown = 0;
  @type('number') overdriveUntil = 0;
  @type('number') empUntil = 0;
  @type('number') slowFieldUntil = 0;
  @type('number') slowFieldRadius = 0;
  @type('string') empMode = 'standard';
  @type('string') shieldMode = 'standard';
  @type('string') slowMode = 'standard';
  @type('string') overdriveMode = 'standard';
}

export class SupportState extends Schema {
  @type('number') pingCooldown = 0;
  @type('number') repairCooldown = 0;
  @type('number') radarUntil = 0;
  @type('number') repairWindowStart = 0;
  @type('number') repairWindowEnd = 0;
  @type('number') repairQuality = 0;
}

export class GameState extends Schema {
  @type('string') phase = 'lobby';
  @type('string') mode: GameMode = 'crew';
  @type(ShipState) ship = new ShipState();
  @type({ map: ShipState }) ships = new MapSchema<ShipState>();
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: SeatInputState }) seatInputs = new MapSchema<SeatInputState>();
  @type([EnemyState]) enemies = new ArraySchema<EnemyState>();
  @type([ProjectileState]) projectiles = new ArraySchema<ProjectileState>();
  @type(SystemsState) systems = new SystemsState();
  @type(SupportState) support = new SupportState();
  @type([UpgradeState]) upgradeChoices = new ArraySchema<UpgradeState>();
  @type(LootState) loot = new LootState();
  @type('number') score = 0;
  @type('number') wave = 1;
  @type('number') timeSurvived = 0;
  @type('number') swapCountdown = 0;
  @type('number') swapGrace = 0;
  @type('string') swapLabel = '';
  @type('string') comboName = '';
  @type('string') comboDetail = '';
  @type('number') comboUntil = 0;
}
