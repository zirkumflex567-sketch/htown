import { enemies as enemyDefs, randomInt, randomRange } from '@htown/shared';
import { EnemyState } from '../rooms/schema/GameState';
import type { GameRoom } from '../rooms/GameRoom';

export class EnemySystem {
  private spawnTimer = 0;

  constructor(private room: GameRoom) {
    this.spawnTimer = 2;
  }

  update(delta: number) {
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnWave();
      this.spawnTimer = Math.max(4 - this.room.state.wave * 0.1, 1.5);
    }

    const ship = this.room.state.ship;
    for (const enemy of this.room.state.enemies) {
      const dirX = ship.position.x - enemy.position.x;
      const dirY = ship.position.y - enemy.position.y;
      const len = Math.hypot(dirX, dirY) || 1;
      const def = enemyDefs.find((entry) => entry.id === enemy.kind) ?? enemyDefs[0];
      const speed = def.speed + this.room.state.wave * 2;
      enemy.position.x += (dirX / len) * speed * delta;
      enemy.position.y += (dirY / len) * speed * delta;

      if (len < 18) {
        enemy.health = 0;
        this.room.damageShip(def.damage * this.room.damageReduction);
      }
    }

    for (let i = this.room.state.enemies.length - 1; i >= 0; i -= 1) {
      if (this.room.state.enemies[i].health <= 0) {
        this.room.state.enemies.splice(i, 1);
      }
    }
  }

  spawnWave() {
    const count = 2 + Math.min(this.room.state.wave, 6);
    for (let i = 0; i < count; i++) {
      const enemyDef = enemyDefs[randomInt(this.room.rng, 0, enemyDefs.length - 1)];
      const enemy = new EnemyState();
      enemy.id = `${enemyDef.id}-${Date.now()}-${i}`;
      enemy.kind = enemyDef.id;
      enemy.health = enemyDef.health;
      const angle = randomRange(this.room.rng, 0, Math.PI * 2);
      const distance = randomRange(this.room.rng, 240, 360);
      enemy.position.x = this.room.state.ship.position.x + Math.cos(angle) * distance;
      enemy.position.y = this.room.state.ship.position.y + Math.sin(angle) * distance;
      this.room.state.enemies.push(enemy);
    }
    this.room.state.wave += 1;
  }
}
