import { mulberry32, randomInt, randomRange } from '../utils/rng';
import { INFUSIONS, MOD_DEFINITIONS, QUIRKS, RARITY_TABLE, SYNERGIES, UPGRADE_DEFINITIONS, WEAPON_ARCHETYPES } from './catalog';
import type {
  InfusionDefinition,
  ModDefinition,
  QuirkDefinition,
  RarityDefinition,
  RarityId,
  RolledMod,
  RolledUpgrade,
  RolledWeapon,
  RunLoadout,
  StatModifier,
  SynergyDefinition,
  SynergyResult,
  TagRequirement,
  WeaponArchetype,
  WeaponStats,
} from './types';
import type { Tag } from './tags';
import { TAGS } from './tags';

export interface RollWeaponOptions {
  seed?: number;
  rarity?: RarityId;
  requiredTags?: Tag[];
  excludedTags?: Tag[];
  allowInfusion?: boolean;
  infusionChance?: number;
  focusTags?: Tag[];
}

export interface RollUpgradeOptions {
  rarity?: RarityId;
  focusTags?: Tag[];
}

const DEFAULT_STATS: WeaponStats = {
  damage: 8,
  cooldownMs: 400,
  projectileCount: 1,
  spread: 4,
  range: 500,
  critChance: 0.08,
  critMultiplier: 1.6,
  magazine: 12,
  reloadMs: 1400,
  burstCount: 1,
  chargeMs: 0,
};

const RARITY_RANK: Record<RarityId, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

const MAX_ROLL_ATTEMPTS = 25;

export function createLootRng(seed: number) {
  return mulberry32(seed);
}

export function rollWeapon(seed: number, options: RollWeaponOptions = {}): RolledWeapon {
  const rng = mulberry32(seed);
  return rollWeaponWithRng(rng, { ...options, seed });
}

export function rollWeaponWithRng(rng: () => number, options: RollWeaponOptions = {}): RolledWeapon {
  const rarity = options.rarity ?? rollRarity(rng);
  const rarityDef = getRarityDefinition(rarity);
  const base = rollWeaponBase(rng, options.requiredTags, options.excludedTags);

  const allowInfusion = options.allowInfusion ?? true;
  const infusionChance = options.infusionChance ?? 0.75;
  const infusion = allowInfusion && rng() < infusionChance ? rollInfusion(rng) : undefined;

  let stats = mergeStats(DEFAULT_STATS, base.stats);
  const description: string[] = [base.description];
  let tags = new Set<Tag>(base.tags);

  if (infusion) {
    stats = applyModifiers(stats, infusion.modifiers);
    infusion.tags.forEach((tag) => tags.add(tag));
    description.push(infusion.description);
  }

  const mods = rollMods(rng, base, rarityDef, tags, options.focusTags ?? []);
  for (const mod of mods) {
    stats = applyModifiers(stats, mod.modifiers);
    mod.tags.forEach((tag) => tags.add(tag));
    description.push(mod.description);
  }

  let quirk: RolledMod | undefined;
  if (rng() < rarityDef.quirkChance) {
    const quirkDef = rollQuirk(rng, tags);
    if (quirkDef) {
      quirk = toRolledMod(quirkDef);
      stats = applyModifiers(stats, quirkDef.modifiers);
      quirkDef.tags.forEach((tag) => tags.add(tag));
      description.push(quirkDef.description);
    }
  }

  stats = clampStats(stats);
  const name = composeWeaponName(base, infusion, mods, quirk);
  const powerScore = calculatePowerScore(stats, tags);

  return {
    id: `${base.id}-${rarity}-${randomInt(rng, 1000, 9999)}`,
    seed: options.seed ?? 0,
    name,
    rarity,
    baseId: base.id,
    infusionId: infusion?.id,
    mods,
    quirk,
    tags: Array.from(tags),
    stats,
    description,
    powerScore,
  };
}

export function rollUpgrade(seed: number, options: RollUpgradeOptions = {}): RolledUpgrade {
  const rng = mulberry32(seed);
  return rollUpgradeWithRng(rng, options);
}

export function rollUpgradeWithRng(rng: () => number, options: RollUpgradeOptions = {}): RolledUpgrade {
  const rarity = options.rarity ?? rollRarity(rng);
  const pool = filterByRarity(UPGRADE_DEFINITIONS, rarity);
  const upgrade = pickWeighted(rng, pool, (entry) => {
    const bonus = matchTagBonus(entry.tags, options.focusTags ?? []);
    return entry.weight * bonus;
  });

  return {
    id: upgrade.id,
    name: upgrade.name,
    rarity,
    tags: upgrade.tags,
    description: upgrade.description,
    modifiers: upgrade.modifiers,
  };
}

export function rollUpgradeChoices(
  seed: number,
  count: number,
  options: RollUpgradeOptions = {},
): RolledUpgrade[] {
  const rng = mulberry32(seed);
  const upgrades: RolledUpgrade[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    let next: RolledUpgrade | undefined;
    for (let attempt = 0; attempt < MAX_ROLL_ATTEMPTS; attempt += 1) {
      const candidate = rollUpgradeWithRng(rng, options);
      if (!seen.has(candidate.id)) {
        next = candidate;
        break;
      }
    }
    if (next) {
      seen.add(next.id);
      upgrades.push(next);
    }
  }
  return upgrades;
}

export function generateRunLoadout(
  seed: number,
  options: { weaponCount?: number; upgradeCount?: number } = {},
): RunLoadout {
  const rng = mulberry32(seed);
  const weaponCount = options.weaponCount ?? 2;
  const upgradeCount = options.upgradeCount ?? 3;
  const weapons: RolledWeapon[] = [];
  for (let i = 0; i < weaponCount; i += 1) {
    weapons.push(rollWeaponWithRng(rng, { seed: seed + i }));
  }

  const upgrades = rollUpgradeChoices(seed + 999, upgradeCount, {
    focusTags: collectTagsFromWeapons(weapons),
  });

  const tagCounts = tallyTags(weapons, upgrades);
  const synergies = evaluateSynergies(tagCounts);

  return {
    seed,
    weapons,
    upgrades,
    synergies,
    tagCounts,
  };
}

export function tallyTags(weapons: RolledWeapon[], upgrades: RolledUpgrade[]): Record<Tag, number> {
  const counts = initializeTagCounts();
  for (const weapon of weapons) {
    for (const tag of weapon.tags) {
      counts[tag] += 1;
    }
  }
  for (const upgrade of upgrades) {
    for (const tag of upgrade.tags) {
      counts[tag] += 1;
    }
  }
  return counts;
}

export function evaluateSynergies(tagCounts: Record<Tag, number>): SynergyDefinition[] {
  return SYNERGIES.filter((synergy) => {
    const result = checkSynergy(tagCounts, synergy);
    return result.active;
  });
}

export function explainSynergies(tagCounts: Record<Tag, number>): SynergyResult[] {
  return SYNERGIES.map((synergy) => checkSynergy(tagCounts, synergy));
}

function rollRarity(rng: () => number): RarityId {
  return pickWeighted(rng, RARITY_TABLE, (entry) => entry.weight).id;
}

function rollWeaponBase(
  rng: () => number,
  requiredTags: Tag[] = [],
  excludedTags: Tag[] = [],
): WeaponArchetype {
  const filtered = WEAPON_ARCHETYPES.filter((weapon) => {
    if (requiredTags.length && !requiredTags.every((tag) => weapon.tags.includes(tag))) {
      return false;
    }
    if (excludedTags.length && excludedTags.some((tag) => weapon.tags.includes(tag))) {
      return false;
    }
    return true;
  });

  const pool = filtered.length ? filtered : WEAPON_ARCHETYPES;
  return pickWeighted(rng, pool, (weapon) => weapon.weight);
}

function rollInfusion(rng: () => number): InfusionDefinition {
  return pickWeighted(rng, INFUSIONS, (infusion) => infusion.weight);
}

function rollMods(
  rng: () => number,
  base: WeaponArchetype,
  rarity: RarityDefinition,
  currentTags: Set<Tag>,
  focusTags: Tag[],
): RolledMod[] {
  const mods: RolledMod[] = [];
  const usedGroups = new Set<string>();
  const modCount = rarity.affixes;

  for (let i = 0; i < modCount; i += 1) {
    const pool = MOD_DEFINITIONS.filter((mod) => {
      if (usedGroups.has(mod.group)) {
        return false;
      }
      if (!tagsMatch(mod.requiresTags, currentTags)) {
        return false;
      }
      if (tagsConflict(mod.forbidsTags, currentTags)) {
        return false;
      }
      if (!rarityWithin(mod, rarity.id)) {
        return false;
      }
      return true;
    });

    if (!pool.length) {
      break;
    }

    const mod = pickWeighted(rng, pool, (entry) => {
      const baseBonus = matchTagBonus(entry.tags, base.modBiasTags ?? []);
      const focusBonus = matchTagBonus(entry.tags, focusTags);
      const tagOverlap = matchTagBonus(entry.tags, Array.from(currentTags));
      return entry.weight * baseBonus * focusBonus * tagOverlap;
    });

    usedGroups.add(mod.group);
    mod.tags.forEach((tag) => currentTags.add(tag));
    mods.push(toRolledMod(mod));
  }

  return mods;
}

function rollQuirk(rng: () => number, currentTags: Set<Tag>): QuirkDefinition | undefined {
  const pool = QUIRKS.filter((quirk) => {
    if (!tagsMatch(quirk.requiresTags, currentTags)) {
      return false;
    }
    if (tagsConflict(quirk.forbidsTags, currentTags)) {
      return false;
    }
    return true;
  });

  if (!pool.length) {
    return undefined;
  }

  return pickWeighted(rng, pool, (quirk) => quirk.weight);
}

function rarityWithin(definition: { minRarity?: RarityId; maxRarity?: RarityId }, rarity: RarityId) {
  if (definition.minRarity && RARITY_RANK[rarity] < RARITY_RANK[definition.minRarity]) {
    return false;
  }
  if (definition.maxRarity && RARITY_RANK[rarity] > RARITY_RANK[definition.maxRarity]) {
    return false;
  }
  return true;
}

function getRarityDefinition(rarity: RarityId): RarityDefinition {
  const found = RARITY_TABLE.find((entry) => entry.id === rarity);
  return found ?? RARITY_TABLE[0];
}

function applyModifiers(stats: WeaponStats, modifiers: StatModifier): WeaponStats {
  const next = { ...stats };
  if (modifiers.add) {
    for (const key of Object.keys(modifiers.add) as (keyof WeaponStats)[]) {
      next[key] += modifiers.add[key] ?? 0;
    }
  }
  if (modifiers.mult) {
    for (const key of Object.keys(modifiers.mult) as (keyof WeaponStats)[]) {
      next[key] *= modifiers.mult[key] ?? 1;
    }
  }
  return next;
}

function mergeStats(base: WeaponStats, overrides: Partial<WeaponStats>): WeaponStats {
  return { ...base, ...overrides };
}

function clampStats(stats: WeaponStats): WeaponStats {
  return {
    damage: Math.max(1, round(stats.damage, 2)),
    cooldownMs: Math.max(60, round(stats.cooldownMs, 0)),
    projectileCount: Math.max(1, Math.round(stats.projectileCount)),
    spread: Math.max(0.5, round(stats.spread, 2)),
    range: Math.max(120, round(stats.range, 0)),
    critChance: clamp(stats.critChance, 0, 0.75),
    critMultiplier: Math.max(1.2, round(stats.critMultiplier, 2)),
    magazine: Math.max(1, Math.round(stats.magazine)),
    reloadMs: Math.max(350, round(stats.reloadMs, 0)),
    burstCount: Math.max(1, Math.round(stats.burstCount)),
    chargeMs: Math.max(0, round(stats.chargeMs, 0)),
  };
}

function composeWeaponName(
  base: WeaponArchetype,
  infusion: InfusionDefinition | undefined,
  mods: RolledMod[],
  quirk: RolledMod | undefined,
): string {
  const prefixes: string[] = [];
  const suffixes: string[] = [];

  if (infusion?.namePrefix) {
    prefixes.push(infusion.namePrefix);
  }
  for (const mod of mods) {
    if (mod.namePrefix) {
      prefixes.push(mod.namePrefix);
    }
    if (mod.nameSuffix) {
      suffixes.push(mod.nameSuffix);
    }
  }
  if (quirk?.namePrefix) {
    prefixes.push(quirk.namePrefix);
  }
  if (quirk?.nameSuffix) {
    suffixes.push(quirk.nameSuffix);
  }
  if (infusion?.nameSuffix) {
    suffixes.push(infusion.nameSuffix);
  }

  const prefixText = prefixes.slice(0, 2).join(' ');
  const suffixText = suffixes.slice(0, 2).join(' ');
  return `${prefixText ? `${prefixText} ` : ''}${base.name}${suffixText ? ` ${suffixText}` : ''}`.trim();
}

function calculatePowerScore(stats: WeaponStats, tags: Set<Tag>): number {
  const rate = 1000 / Math.max(60, stats.cooldownMs);
  const critFactor = 1 + stats.critChance * (stats.critMultiplier - 1);
  const burstFactor = Math.max(1, stats.burstCount);
  const projectileFactor = Math.max(1, stats.projectileCount);
  const baseDps = stats.damage * rate * critFactor * burstFactor * projectileFactor;
  const rangeFactor = clamp(stats.range / 650, 0.75, 1.35);
  const aoeFactor = tags.has('aoe') ? 1.1 : 1;
  const statusFactor = tags.has('dot') || tags.has('status') ? 1.05 : 1;
  return round(baseDps * rangeFactor * aoeFactor * statusFactor, 2);
}

function checkSynergy(tagCounts: Record<Tag, number>, synergy: SynergyDefinition): SynergyResult {
  const satisfied: TagRequirement[] = [];
  const missing: TagRequirement[] = [];

  for (const requirement of synergy.requirements) {
    const needed = requirement.count ?? 1;
    const current = tagCounts[requirement.tag] ?? 0;
    if (current >= needed) {
      satisfied.push(requirement);
    } else {
      missing.push(requirement);
    }
  }

  if (missing.length === 0 && synergy.anyOf && synergy.minAnyOf) {
    const anyCount = synergy.anyOf.reduce((sum, tag) => sum + (tagCounts[tag] ?? 0), 0);
    if (anyCount < synergy.minAnyOf) {
      missing.push(...synergy.anyOf.map((tag) => ({ tag, count: 1 })));
    }
  }

  return {
    synergy,
    active: missing.length === 0,
    satisfied,
    missing,
  };
}

function toRolledMod(definition: ModDefinition | QuirkDefinition): RolledMod {
  return {
    id: definition.id,
    name: definition.name,
    group: definition.group ?? 'quirk',
    tags: definition.tags,
    description: definition.description,
    modifiers: definition.modifiers,
    namePrefix: definition.namePrefix,
    nameSuffix: definition.nameSuffix,
  };
}

function collectTagsFromWeapons(weapons: RolledWeapon[]): Tag[] {
  const tagSet = new Set<Tag>();
  for (const weapon of weapons) {
    for (const tag of weapon.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet);
}

function initializeTagCounts(): Record<Tag, number> {
  const counts = {} as Record<Tag, number>;
  for (const tag of TAGS) {
    counts[tag] = 0;
  }
  return counts;
}

function tagsMatch(required: Tag[] | undefined, currentTags: Set<Tag>) {
  if (!required || required.length === 0) {
    return true;
  }
  return required.every((tag) => currentTags.has(tag));
}

function tagsConflict(forbidden: Tag[] | undefined, currentTags: Set<Tag>) {
  if (!forbidden || forbidden.length === 0) {
    return false;
  }
  return forbidden.some((tag) => currentTags.has(tag));
}

function matchTagBonus(tags: Tag[], focusTags: Tag[]) {
  if (!focusTags.length) {
    return 1;
  }
  const matches = tags.filter((tag) => focusTags.includes(tag)).length;
  return 1 + matches * 0.12;
}

function filterByRarity<T extends { minRarity?: RarityId; maxRarity?: RarityId }>(pool: T[], rarity: RarityId) {
  return pool.filter((entry) => rarityWithin(entry, rarity));
}

function pickWeighted<T>(rng: () => number, items: T[], weightFn: (entry: T) => number): T {
  const weights = items.map(weightFn);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return items[randomInt(rng, 0, items.length - 1)];
  }
  let roll = randomRange(rng, 0, total);
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
