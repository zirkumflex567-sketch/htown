import { clampToCave, enemies as enemyDefs, randomInt, randomRange } from '@htown/shared';
import { EnemyState } from '../rooms/schema/GameState';
import type { GameRoom } from '../rooms/GameRoom';

export class EnemySystem {
  private spawnTimer = 0;
  private lastSpitAt = new Map<string, number>();

  constructor(private room: GameRoom) {
    this.spawnTimer = 2;
  }

  update(delta: number) {
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnWave();
      this.spawnTimer = Math.max(3.5 - this.room.state.wave * 0.08, 1.2);
    }

    const ship = this.room.state.ship;
    const now = this.room.simulationTime / 1000;
    const slowFieldActive = this.room.state.systems.slowFieldUntil > now;
    const slowFieldRadius = this.room.state.systems.slowFieldRadius;
    const comboTrailActive = ship.comboTrailUntil > now;
    for (const enemy of this.room.state.enemies) {
      const def = enemyDefs.find((entry) => entry.id === enemy.kind) ?? enemyDefs[0];
      const dirX = ship.position.x - enemy.position.x;
      const dirY = ship.position.y - enemy.position.y;
      const dist = Math.hypot(dirX, dirY) || 1;
      const dir = { x: dirX / dist, y: dirY / dist };
      const perp = { x: -dir.y, y: dir.x };
      let desired = { x: 0, y: 0 };
      const slowed = enemy.slowUntil > now || (slowFieldActive && dist < slowFieldRadius);
      const slowFactor = slowed ? 0.4 : 1;

      if (enemy.kind === 'boss') {
        enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
        if (enemy.telegraphUntil > 0 && now >= enemy.telegraphUntil) {
          if (enemy.attackMode === 'charge') {
            enemy.velocity.x = dir.x * (def.speed * 3.4);
            enemy.velocity.y = dir.y * (def.speed * 3.4);
          } else if (enemy.attackMode === 'burst') {
            const count = 12;
            for (let i = 0; i < count; i += 1) {
              const angle = (i / count) * Math.PI * 2;
              const speed = 120 + this.room.state.wave * 2;
              this.room.spawnProjectile({
                kind: 'boss',
                owner: 'enemy',
                x: enemy.position.x,
                y: enemy.position.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                ttl: 2.6,
                damage: def.damage * 0.8
              });
            }
          } else {
            const pellets = 5;
            for (let i = 0; i < pellets; i += 1) {
              const offset = (i - (pellets - 1) / 2) * 0.18;
              const angle = Math.atan2(dir.y, dir.x) + offset;
              const speed = 150;
              this.room.spawnProjectile({
                kind: 'plasma',
                owner: 'enemy',
                x: enemy.position.x,
                y: enemy.position.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                ttl: 2.2,
                damage: def.damage * 0.6
              });
            }
          }
          enemy.telegraphUntil = 0;
        }
        if (enemy.attackCooldown <= 0 && dist < 180 && enemy.telegraphUntil <= 0) {
          const roll = this.room.rng();
          enemy.attackMode = roll < 0.4 ? 'charge' : roll < 0.75 ? 'burst' : 'volley';
          enemy.telegraphUntil = now + 1.1;
          enemy.attackCooldown = 7;
        }
        desired = dist > 180 ? dir : { x: 0, y: 0 };
      } else if (enemy.kind === 'chaser') {
        desired = dir;
      } else if (enemy.kind === 'runner') {
        if (dist < 45) {
          desired = { x: -dir.x, y: -dir.y };
        } else if (dist > 120) {
          desired = dir;
        } else {
          desired = perp;
        }
      } else {
        if (dist < 90) {
          desired = { x: -dir.x, y: -dir.y };
        } else if (dist > 180) {
          desired = { x: dir.x * 0.4, y: dir.y * 0.4 };
        }
        const lastSpit = this.lastSpitAt.get(enemy.id) ?? 0;
        if (dist < 170 && now - lastSpit > 1.6) {
          this.lastSpitAt.set(enemy.id, now);
          const speed = 140;
          const angle = Math.atan2(dir.y, dir.x);
          this.room.spawnProjectile({
            kind: 'spit',
            owner: 'enemy',
            x: enemy.position.x,
            y: enemy.position.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ttl: 2,
            damage: def.damage * 0.7
          });
        }
      }

      if (enemy.kind !== 'boss') {
        const chaseBias = enemy.kind === 'spitter' ? 0.22 : 0.35;
        desired = { x: desired.x + dir.x * chaseBias, y: desired.y + dir.y * chaseBias };
        const desiredLen = Math.hypot(desired.x, desired.y) || 1;
        desired = { x: desired.x / desiredLen, y: desired.y / desiredLen };
      }

      const maxSpeed = (def.speed + this.room.state.wave * 1.6) * slowFactor;
      const accel = maxSpeed * 1.4;
      enemy.velocity.x += desired.x * accel * delta;
      enemy.velocity.y += desired.y * accel * delta;
      const speed = Math.hypot(enemy.velocity.x, enemy.velocity.y);
      if (speed > maxSpeed) {
        enemy.velocity.x = (enemy.velocity.x / speed) * maxSpeed;
        enemy.velocity.y = (enemy.velocity.y / speed) * maxSpeed;
      }
      enemy.position.x += enemy.velocity.x * delta;
      enemy.position.y += enemy.velocity.y * delta;
      const clamp = clampToCave(enemy.position.x, enemy.position.y, 1);
      if (clamp.outside) {
        enemy.position.x = clamp.x;
        enemy.position.y = clamp.y;
        const tangentDot = enemy.velocity.x * clamp.tangentX + enemy.velocity.y * clamp.tangentY;
        enemy.velocity.x = clamp.tangentX * tangentDot * 0.75;
        enemy.velocity.y = clamp.tangentY * tangentDot * 0.75;
      }
      enemy.velocity.x *= 0.92;
      enemy.velocity.y *= 0.92;
      if (Math.hypot(enemy.velocity.x, enemy.velocity.y) > 0.01) {
        enemy.yaw = Math.atan2(enemy.velocity.x, enemy.velocity.y);
      }

      if (dist < 16) {
        enemy.health = 0;
        this.room.damageShip(def.damage * this.room.damageReduction);
        enemy.velocity.x = -dir.x * maxSpeed;
        enemy.velocity.y = -dir.y * maxSpeed;
      }
    }

    if (comboTrailActive) {
      const trailRadius = 22;
      const trailDamage = 12 * delta;
      for (let i = this.room.state.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = this.room.state.enemies[i];
        const dist = Math.hypot(enemy.position.x - ship.position.x, enemy.position.y - ship.position.y);
        if (dist > trailRadius) continue;
        enemy.health -= enemy.kind === 'boss' ? trailDamage * 0.6 : trailDamage;
        if (enemy.health <= 0) {
          this.room.killCount += 1;
          if (enemy.kind === 'boss') {
            this.room.bossKillCount += 1;
          }
          this.room.state.enemies.splice(i, 1);
        }
      }
    }

    for (let i = this.room.state.enemies.length - 1; i >= 0; i -= 1) {
      if (this.room.state.enemies[i].health <= 0) {
        const killed = this.room.state.enemies[i];
        this.room.killCount += 1;
        if (killed.kind === 'boss') {
          this.room.bossKillCount += 1;
        }
        this.room.state.enemies.splice(i, 1);
      }
    }
  }

  private pickSpawnPosition() {
    const ship = this.room.state.ship;
    const angle = randomRange(this.room.rng, 0, Math.PI * 2);
    const distance = randomRange(this.room.rng, 90, 150);
    const rawX = ship.position.x + Math.cos(angle) * distance;
    const rawY = ship.position.y + Math.sin(angle) * distance;
    const clamp = clampToCave(rawX, rawY, 1);
    return { x: clamp.x, y: clamp.y };
  }

  spawnWave() {
    const count = 3 + Math.min(this.room.state.wave, 8);
    for (let i = 0; i < count; i++) {
      const enemyDef = enemyDefs[randomInt(this.room.rng, 0, enemyDefs.length - 1)];
      const enemy = new EnemyState();
      enemy.id = `${enemyDef.id}-${Date.now()}-${i}`;
      enemy.kind = enemyDef.id;
      enemy.health = enemyDef.health;
      const spawn = this.pickSpawnPosition();
      enemy.position.x = spawn.x;
      enemy.position.y = spawn.y;
      this.room.state.enemies.push(enemy);
    }
    this.room.state.wave += 1;
    if (this.room.state.wave % 5 === 0) {
      const bossDef = enemyDefs.find((entry) => entry.id === 'boss');
      if (bossDef) {
        const boss = new EnemyState();
        boss.id = `${bossDef.id}-${Date.now()}`;
        boss.kind = bossDef.id;
        boss.health = bossDef.health;
        const spawn = this.pickSpawnPosition();
        boss.position.x = spawn.x;
        boss.position.y = spawn.y;
        this.room.state.enemies.push(boss);
      }
    }
  }
}
