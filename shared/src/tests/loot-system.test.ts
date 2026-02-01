import { describe, expect, it } from 'vitest';
import { TAGS } from '../loot/tags';
import { evaluateSynergies, generateRunLoadout, rollUpgradeChoices, rollWeapon } from '../loot/generator';
import type { Tag } from '../loot/tags';

describe('loot system', () => {
  it('rolls deterministic weapons for the same seed', () => {
    const weaponA = rollWeapon(1337, { infusionChance: 0.5 });
    const weaponB = rollWeapon(1337, { infusionChance: 0.5 });
    expect(weaponA).toEqual(weaponB);
  });

  it('rolls deterministic run loadouts', () => {
    const loadoutA = generateRunLoadout(4242);
    const loadoutB = generateRunLoadout(4242);
    expect(loadoutA).toEqual(loadoutB);
  });

  it('detects active synergies by tags', () => {
    const counts = Object.fromEntries(TAGS.map((tag) => [tag, 0])) as Record<Tag, number>;
    counts.shock = 1;
    counts.chain = 1;
    counts.support = 1;
    counts.healing = 1;

    const active = evaluateSynergies(counts).map((synergy) => synergy.id);
    expect(active).toContain('synergy_storm');
    expect(active).toContain('synergy_support');
  });

  it('rolls unique upgrade choices', () => {
    const upgrades = rollUpgradeChoices(812, 3);
    const ids = new Set(upgrades.map((upgrade) => upgrade.id));
    expect(ids.size).toBe(upgrades.length);
  });
});
