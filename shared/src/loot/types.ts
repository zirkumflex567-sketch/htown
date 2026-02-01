import type { Tag } from './tags';

export type RarityId = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface RarityDefinition {
  id: RarityId;
  weight: number;
  affixes: number;
  quirkChance: number;
}

export const WEAPON_STAT_KEYS = [
  'damage',
  'cooldownMs',
  'projectileCount',
  'spread',
  'range',
  'critChance',
  'critMultiplier',
  'magazine',
  'reloadMs',
  'burstCount',
  'chargeMs',
] as const;

export type WeaponStatKey = (typeof WEAPON_STAT_KEYS)[number];

export type WeaponStats = Record<WeaponStatKey, number>;

export interface StatModifier {
  add?: Partial<WeaponStats>;
  mult?: Partial<WeaponStats>;
}

export interface WeaponArchetype {
  id: string;
  name: string;
  weight: number;
  tags: Tag[];
  stats: Partial<WeaponStats>;
  description: string;
  modBiasTags?: Tag[];
}

export interface InfusionDefinition {
  id: string;
  name: string;
  weight: number;
  tags: Tag[];
  modifiers: StatModifier;
  description: string;
  namePrefix?: string;
  nameSuffix?: string;
}

export interface ModDefinition {
  id: string;
  name: string;
  group: string;
  weight: number;
  tags: Tag[];
  modifiers: StatModifier;
  description: string;
  requiresTags?: Tag[];
  forbidsTags?: Tag[];
  minRarity?: RarityId;
  maxRarity?: RarityId;
  namePrefix?: string;
  nameSuffix?: string;
}

export interface QuirkDefinition {
  id: string;
  name: string;
  group?: string;
  weight: number;
  tags: Tag[];
  modifiers: StatModifier;
  description: string;
  requiresTags?: Tag[];
  forbidsTags?: Tag[];
  namePrefix?: string;
  nameSuffix?: string;
}

export interface LootUpgradeDefinition {
  id: string;
  name: string;
  description: string;
  weight: number;
  tags: Tag[];
  modifiers?: StatModifier;
  minRarity?: RarityId;
  maxRarity?: RarityId;
}

export interface TagRequirement {
  tag: Tag;
  count?: number;
}

export interface SynergyDefinition {
  id: string;
  name: string;
  description: string;
  requirements: TagRequirement[];
  anyOf?: Tag[];
  minAnyOf?: number;
  bonusTags?: Tag[];
}

export interface RolledMod {
  id: string;
  name: string;
  group: string;
  tags: Tag[];
  description: string;
  modifiers: StatModifier;
  namePrefix?: string;
  nameSuffix?: string;
}

export interface RolledWeapon {
  id: string;
  seed: number;
  name: string;
  rarity: RarityId;
  baseId: string;
  infusionId?: string;
  mods: RolledMod[];
  quirk?: RolledMod;
  tags: Tag[];
  stats: WeaponStats;
  description: string[];
  powerScore: number;
}

export interface RolledUpgrade {
  id: string;
  name: string;
  rarity: RarityId;
  tags: Tag[];
  description: string;
  modifiers?: StatModifier;
}

export interface SynergyResult {
  synergy: SynergyDefinition;
  active: boolean;
  satisfied: TagRequirement[];
  missing: TagRequirement[];
}

export interface RunLoadout {
  seed: number;
  weapons: RolledWeapon[];
  upgrades: RolledUpgrade[];
  synergies: SynergyDefinition[];
  tagCounts: Record<Tag, number>;
}
