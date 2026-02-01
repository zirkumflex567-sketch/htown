import { upgrades as upgradeDefs, randomInt } from '@htown/shared';
import { UpgradeState } from '../rooms/schema/GameState';
import type { GameRoom } from '../rooms/GameRoom';

export class UpgradeSystem {
  private nextUpgradeAt = 20;

  constructor(private room: GameRoom) {}

  update(delta: number) {
    this.nextUpgradeAt -= delta;
    if (this.nextUpgradeAt <= 0 && this.room.state.upgradeChoices.length === 0) {
      this.rollUpgrades();
      this.nextUpgradeAt = 30;
    }
  }

  rollUpgrades() {
    this.room.state.upgradeChoices.clear();
    const chosen = new Set<string>();
    while (chosen.size < 3) {
      const upgrade = upgradeDefs[randomInt(this.room.rng, 0, upgradeDefs.length - 1)];
      if (chosen.has(upgrade.id)) continue;
      chosen.add(upgrade.id);
      const state = new UpgradeState();
      state.id = upgrade.id;
      state.name = upgrade.name;
      state.description = upgrade.description;
      this.room.state.upgradeChoices.push(state);
    }
  }
}
