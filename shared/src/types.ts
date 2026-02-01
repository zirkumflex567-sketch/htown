export type SeatType = 'pilot' | 'gunner' | 'power' | 'systems' | 'support';

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerInput {
  seat: SeatType;
  move?: Vector2;
  boost?: boolean;
  aim?: Vector2;
  fire?: boolean;
  weaponIndex?: number;
  power?: {
    engines: number;
    weapons: number;
    shields: number;
  };
  systems?: {
    abilityIndex: number;
  };
  support?: {
    action: 'repair' | 'scan' | 'loot';
  };
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
  behavior: 'chaser' | 'runner' | 'spitter';
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

export interface LeaderboardEntry {
  userId: string;
  email: string;
  bestScore: number;
  totalRuns: number;
}
