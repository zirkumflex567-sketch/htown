export type SeatType = 'pilot' | 'gunner' | 'power' | 'systems' | 'support';

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerInput {
  seat: SeatType;
  move?: Vector2;
  boost?: boolean;
  throttle?: number;
  brake?: number;
  steer?: number;
  handbrake?: boolean;
  aim?: Vector2;
  aimYaw?: number;
  aimPitch?: number;
  fire?: boolean;
  altFire?: boolean;
  swapWeapon?: boolean;
  weaponIndex?: number;
  power?: {
    engines: number;
    weapons: number;
    shields: number;
  };
  powerPreset?: 'attack' | 'defense' | 'speed' | 'balanced';
  systems?: {
    abilityIndex: number;
  };
  support?: {
    action: 'repair' | 'scan' | 'loot';
  };
  supportHold?: boolean;
  radarToggle?: boolean;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  damage: number;
  range: number;
  cooldownMs: number;
  spread: number;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  speed: number;
  health: number;
  damage: number;
  behavior: 'chaser' | 'runner' | 'spitter' | 'boss';
}

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  seat: SeatType | 'all';
  effect: {
    type: 'damage' | 'speed' | 'shield' | 'cooldown' | 'vision' | 'swap';
    value: number;
  };
}

export interface StatusEffectDefinition {
  id: string;
  name: string;
  duration: number;
  damageMultiplier?: number;
  explosionRadius?: number;
  explosionDamage?: number;
  aimAssist?: number;
}

export interface ComboDefinition {
  id: string;
  name: string;
  windowMs: number;
  cooldownMs: number;
  effects: string[];
}

export interface LeaderboardEntry {
  userId: string;
  email: string;
  bestScore: number;
  totalRuns: number;
}
