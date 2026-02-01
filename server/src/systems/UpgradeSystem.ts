import { upgrades as upgradeDefs, randomInt } from '@htown/shared';
import { UpgradeState } from '../rooms/schema/GameState';
import type { GameRoom } from '../rooms/GameRoom';

export class UpgradeSystem {
  private lastWave = 1;
  private pendingTimeout: ReturnType<GameRoom['clock']['setTimeout']> | null = null;

  constructor(private room: GameRoom) {}

  update(delta: number) {
    if (this.room.state.wave > this.lastWave && this.room.state.upgradeChoices.length === 0) {
      this.rollUpgrades();
      this.lastWave = this.room.state.wave;
    }
  }

  rollUpgrades() {
    this.room.state.upgradeChoices.clear();
    if (this.pendingTimeout) {
      this.pendingTimeout.clear();
      this.pendingTimeout = null;
    }
    const chosen = new Set<string>();
    while (chosen.size < 3) {
      const upgrade = upgradeDefs[randomInt(this.room.rng, 0, upgradeDefs.length - 1)];
      if (chosen.has(upgrade.id)) continue;
      chosen.add(upgrade.id);
      const state = new UpgradeState();
      state.id = upgrade.id;
      state.name = upgrade.name;
      state.description = upgrade.description;
      state.seat = upgrade.seat;
      this.room.state.upgradeChoices.push(state);
    }
    this.pendingTimeout = this.room.clock.setTimeout(() => {
      if (!this.room.state.upgradeChoices.length) return;
      const pick = this.room.state.upgradeChoices[0];
      if (pick) {
        this.room.applyUpgrade(pick.id);
        this.room.state.upgradeChoices.clear();
      }
    }, 8000);
  }
}
