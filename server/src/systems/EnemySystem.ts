import { clampToCave, enemies as enemyDefs, randomInt, randomRange } from '@htown/shared';
import { EnemyState } from '../rooms/schema/GameState';
import type { GameRoom } from '../rooms/GameRoom';

const MAX_ENEMIES = 90;

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
      this.spawnTimer = Math.max(2.6 - this.room.state.wave * 0.06, 0.9);
    }

    const targets = this.room.getEnemyTargets();
    if (targets.length === 0) return;
    const now = this.room.simulationTime / 1000;
    const slowFieldActive = this.room.state.systems.slowFieldUntil > now;
    const slowFieldRadius = this.room.state.systems.slowFieldRadius;
    const comboTrailShips = targets.filter((target) => target.ship.comboTrailUntil > now);
    const pickNearestTarget = (enemy: EnemyState) => {
      let closest = targets[0];
      let closestDist = Infinity;
      for (const target of targets) {
        const dx = target.ship.position.x - enemy.position.x;
        const dy = target.ship.position.y - enemy.position.y;
        const dz = target.ship.position.z - enemy.position.z;
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < closestDist) {
          closestDist = dist;
          closest = target;
        }
      }
      return closest;
    };
    for (const enemy of this.room.state.enemies) {
      const target = pickNearestTarget(enemy);
      const ship = target.ship;
      const def = enemyDefs.find((entry) => entry.id === enemy.kind) ?? enemyDefs[0];
      const dirX = ship.position.x - enemy.position.x;
      const dirY = ship.position.y - enemy.position.y;
      const dirZ = ship.position.z - enemy.position.z;
      const dist = Math.hypot(dirX, dirY, dirZ) || 1;
      const flatDist = Math.hypot(dirX, dirY) || 1;
      const dir = { x: dirX / flatDist, y: dirY / flatDist, z: dirZ / dist };
      const perp = { x: -dir.y, y: dir.x };
      let desired = { x: 0, y: 0, z: 0 };
      const slowed = enemy.slowUntil > now || (slowFieldActive && dist < slowFieldRadius);
      const shocked = enemy.shockedUntil > now;
      const slowFactor = shocked ? 0.25 : slowed ? 0.4 : 1;

      if (def.behavior === 'boss') {
        enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
        if (enemy.telegraphUntil > 0 && now >= enemy.telegraphUntil) {
          if (enemy.attackMode === 'charge') {
            enemy.velocity.x = dir.x * (def.speed * 3.4);
            enemy.velocity.y = dir.y * (def.speed * 3.4);
            enemy.velocity.z = dir.z * (def.speed * 1.6);
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
                z: enemy.position.z,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                vz: 0,
                ttl: 2.6,
                damage: def.damage * 0.8
              });
            }
          } else if (enemy.attackMode === 'chorus') {
            const count = 8;
            for (let i = 0; i < count; i += 1) {
              const angle = (i / count) * Math.PI * 2 + now * 0.6;
              const speed = 140 + this.room.state.wave * 2.4;
              this.room.spawnProjectile({
                kind: 'plasma',
                owner: 'enemy',
                x: enemy.position.x,
                y: enemy.position.y,
                z: enemy.position.z,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                vz: Math.sin(angle * 2) * 20,
                ttl: 2.4,
                damage: def.damage * 0.7
              });
            }
          } else if (enemy.attackMode === 'quake') {
            const rings = 3;
            for (let ring = 0; ring < rings; ring += 1) {
              const count = 10 + ring * 4;
              const radiusSpeed = 100 + ring * 25;
              for (let i = 0; i < count; i += 1) {
                const angle = (i / count) * Math.PI * 2;
                this.room.spawnProjectile({
                  kind: 'boss',
                  owner: 'enemy',
                  x: enemy.position.x,
                  y: enemy.position.y,
                  z: enemy.position.z,
                  vx: Math.cos(angle) * radiusSpeed,
                  vy: Math.sin(angle) * radiusSpeed,
                  vz: 0,
                  ttl: 2.2 + ring * 0.2,
                  damage: def.damage * 0.6
                });
              }
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
                z: enemy.position.z,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                vz: 0,
                ttl: 2.2,
                damage: def.damage * 0.6
              });
            }
          }
          enemy.telegraphUntil = 0;
        }
        if (enemy.attackCooldown <= 0 && dist < 180 && enemy.telegraphUntil <= 0) {
          const roll = this.room.rng();
          if (enemy.kind === 'boss-siren') {
            enemy.attackMode = roll < 0.45 ? 'chorus' : roll < 0.8 ? 'volley' : 'charge';
            enemy.telegraphUntil = now + 0.9;
            enemy.attackCooldown = 6.5;
          } else if (enemy.kind === 'boss-behemoth') {
            enemy.attackMode = roll < 0.5 ? 'quake' : roll < 0.85 ? 'charge' : 'burst';
            enemy.telegraphUntil = now + 1.3;
            enemy.attackCooldown = 8;
          } else {
            enemy.attackMode = roll < 0.4 ? 'charge' : roll < 0.75 ? 'burst' : 'volley';
            enemy.telegraphUntil = now + 1.1;
            enemy.attackCooldown = 7;
          }
        }
        if (enemy.kind === 'boss-siren' && dist < 220 && dist > 90) {
          desired = { x: perp.x, y: perp.y, z: dir.z * 0.6 };
        } else if (enemy.kind === 'boss-behemoth' && dist < 140) {
          desired = { x: -dir.x * 0.2, y: -dir.y * 0.2, z: -dir.z * 0.2 };
        } else {
          desired = dist > 180 ? { x: dir.x, y: dir.y, z: dir.z } : { x: 0, y: 0, z: 0 };
        }
      } else if (def.behavior === 'chaser') {
        desired = { x: dir.x, y: dir.y, z: dir.z };
      } else if (def.behavior === 'runner') {
        if (dist < 45) {
          desired = { x: -dir.x, y: -dir.y, z: -dir.z * 0.5 };
        } else if (dist > 120) {
          desired = { x: dir.x, y: dir.y, z: dir.z };
        } else {
          desired = { x: perp.x, y: perp.y, z: dir.z * 0.3 };
        }
      } else if (def.behavior === 'spitter') {
        if (dist < 90) {
          desired = { x: -dir.x, y: -dir.y, z: -dir.z * 0.4 };
        } else if (dist > 180) {
          desired = { x: dir.x * 0.4, y: dir.y * 0.4, z: dir.z * 0.4 };
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
            z: enemy.position.z,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: dir.z * (speed * 0.4),
            ttl: 2,
            damage: def.damage * 0.7
          });
        }
      } else if (def.behavior === 'lurker') {
        enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
        if (dist < 70) {
          desired = { x: -dir.x, y: -dir.y, z: -dir.z * 0.3 };
        } else if (dist > 150) {
          desired = { x: dir.x * 0.6, y: dir.y * 0.6, z: dir.z * 0.4 };
        } else {
          desired = { x: perp.x, y: perp.y, z: dir.z * 0.2 };
        }
        if (enemy.attackCooldown <= 0 && dist < 170) {
          enemy.attackCooldown = 2.4;
          const volley = 3;
          for (let i = 0; i < volley; i += 1) {
            const offset = (i - 1) * 0.12;
            const angle = Math.atan2(dir.y, dir.x) + offset;
            const speed = 160;
            this.room.spawnProjectile({
              kind: 'spit',
              owner: 'enemy',
              x: enemy.position.x,
              y: enemy.position.y,
              z: enemy.position.z,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              vz: dir.z * 30,
              ttl: 1.9,
              damage: def.damage * 0.6
            });
          }
        }
      } else if (def.behavior === 'brute') {
        enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
        if (enemy.attackCooldown <= 0 && dist < 120) {
          enemy.attackCooldown = 3.2;
          enemy.velocity.x = dir.x * def.speed * 2.6;
          enemy.velocity.y = dir.y * def.speed * 2.6;
          enemy.velocity.z = dir.z * def.speed * 1.2;
        } else if (dist > 90) {
          desired = { x: dir.x, y: dir.y, z: dir.z };
        } else {
          desired = { x: perp.x * 0.2, y: perp.y * 0.2, z: dir.z * 0.1 };
        }
      } else if (def.behavior === 'swarm') {
        const wobble = Math.sin(now * 4 + enemy.position.x * 0.2);
        desired = { x: dir.x + perp.x * 0.4 * wobble, y: dir.y + perp.y * 0.4 * wobble, z: dir.z * 0.6 };
      }

      if (def.behavior !== 'boss') {
        const chaseBias = def.behavior === 'spitter' || def.behavior === 'lurker' ? 0.26 : def.behavior === 'swarm' ? 0.5 : 0.4;
        desired = {
          x: desired.x + dir.x * chaseBias,
          y: desired.y + dir.y * chaseBias,
          z: desired.z + dir.z * (chaseBias * 0.6)
        };
        const desiredLen = Math.hypot(desired.x, desired.y, desired.z) || 1;
        desired = { x: desired.x / desiredLen, y: desired.y / desiredLen, z: desired.z / desiredLen };
      }

      const maxSpeed = (def.speed + this.room.state.wave * 2.2) * slowFactor;
      const accel = maxSpeed * 1.6;
      enemy.velocity.x += desired.x * accel * delta;
      enemy.velocity.y += desired.y * accel * delta;
      enemy.velocity.z += desired.z * accel * delta;
      const speed = Math.hypot(enemy.velocity.x, enemy.velocity.y, enemy.velocity.z);
      if (speed > maxSpeed) {
        enemy.velocity.x = (enemy.velocity.x / speed) * maxSpeed;
        enemy.velocity.y = (enemy.velocity.y / speed) * maxSpeed;
        enemy.velocity.z = (enemy.velocity.z / speed) * maxSpeed;
      }
      enemy.position.x += enemy.velocity.x * delta;
      enemy.position.y += enemy.velocity.y * delta;
      enemy.position.z += enemy.velocity.z * delta;
      const clamp = clampToCave(enemy.position.x, enemy.position.y, enemy.position.z, 1);
      if (clamp.outside) {
        enemy.position.x = clamp.x;
        enemy.position.y = clamp.y;
        enemy.position.z = clamp.z;
        const tangentDot = enemy.velocity.x * clamp.tangentX + enemy.velocity.y * clamp.tangentY;
        enemy.velocity.x = clamp.tangentX * tangentDot * 0.75;
        enemy.velocity.y = clamp.tangentY * tangentDot * 0.75;
        enemy.velocity.z *= 0.35;
      }
      enemy.velocity.x *= 0.92;
      enemy.velocity.y *= 0.92;
      enemy.velocity.z *= 0.9;
      if (Math.hypot(enemy.velocity.x, enemy.velocity.y) > 0.01) {
        enemy.yaw = Math.atan2(enemy.velocity.x, enemy.velocity.y);
      }

      if (enemy.poisonedUntil > now) {
        const poisonDamage = (def.health * 0.015 + 2) * delta;
        enemy.health -= poisonDamage;
      }

      if (dist < 16) {
        enemy.health = 0;
        this.room.damageShip(def.damage * this.room.damageReduction, target.id);
        enemy.velocity.x = -dir.x * maxSpeed;
        enemy.velocity.y = -dir.y * maxSpeed;
        enemy.velocity.z = -dir.z * maxSpeed;
      }
    }

    if (comboTrailShips.length) {
      const trailRadius = 22;
      const trailDamage = 12 * delta;
      for (const target of comboTrailShips) {
        const ship = target.ship;
        for (let i = this.room.state.enemies.length - 1; i >= 0; i -= 1) {
          const enemy = this.room.state.enemies[i];
          const dist = Math.hypot(
            enemy.position.x - ship.position.x,
            enemy.position.y - ship.position.y,
            enemy.position.z - ship.position.z
          );
          if (dist > trailRadius) continue;
          enemy.health -= isBossKind(enemy.kind) ? trailDamage * 0.6 : trailDamage;
          if (enemy.health <= 0) {
            this.room.killCount += 1;
            if (isBossKind(enemy.kind)) {
              this.room.bossKillCount += 1;
            }
            this.room.state.enemies.splice(i, 1);
            this.room.maybeDropUpgrade(isBossKind(enemy.kind) ? 'boss' : 'enemy');
          }
        }
      }
    }

    for (let i = this.room.state.enemies.length - 1; i >= 0; i -= 1) {
      if (this.room.state.enemies[i].health <= 0) {
        const killed = this.room.state.enemies[i];
        this.room.killCount += 1;
        if (isBossKind(killed.kind)) {
          this.room.bossKillCount += 1;
        }
        this.room.state.enemies.splice(i, 1);
        this.room.maybeDropUpgrade(isBossKind(killed.kind) ? 'boss' : 'enemy');
      }
    }
  }

  private pickSpawnPosition() {
    const anchor = this.room.getSpawnAnchor();
    const angle = randomRange(this.room.rng, 0, Math.PI * 2);
    const distance = randomRange(this.room.rng, 90, 150);
    const rawX = anchor.x + Math.cos(angle) * distance;
    const rawY = anchor.y + Math.sin(angle) * distance;
    const rawZ = anchor.z + randomRange(this.room.rng, -6, 6);
    const clamp = clampToCave(rawX, rawY, rawZ, 1);
    return { x: clamp.x, y: clamp.y, z: clamp.z };
  }

  spawnWave() {
    const wave = this.room.state.wave;
    const current = this.room.state.enemies.length;
    const capacity = Math.max(0, MAX_ENEMIES - current);
    if (capacity === 0) {
      this.room.state.wave += 1;
      return;
    }
    const bosses = enemyDefs.filter((entry) => entry.behavior === 'boss');
    const shouldSpawnBoss = wave % 5 === 0 && bosses.length > 0 && capacity > 0;
    const bossSlots = shouldSpawnBoss ? 1 : 0;
    const count = Math.min(capacity - bossSlots, 6 + Math.min(wave * 2, 24));
    const enemyPool = enemyDefs.filter((entry) => entry.behavior !== 'boss');
    for (let i = 0; i < count; i++) {
      const enemyDef = enemyPool[randomInt(this.room.rng, 0, enemyPool.length - 1)];
      const enemy = new EnemyState();
      enemy.id = `${enemyDef.id}-${Date.now()}-${i}`;
      enemy.kind = enemyDef.id;
      enemy.health = enemyDef.health;
      const spawn = this.pickSpawnPosition();
      enemy.position.x = spawn.x;
      enemy.position.y = spawn.y;
      enemy.position.z = spawn.z;
      this.room.state.enemies.push(enemy);
    }
    if (shouldSpawnBoss) {
      const bossDef = bosses[(Math.floor(wave / 5) + bosses.length) % bosses.length];
      const boss = new EnemyState();
      boss.id = `${bossDef.id}-${Date.now()}`;
      boss.kind = bossDef.id;
      boss.health = bossDef.health;
      const spawn = this.pickSpawnPosition();
      boss.position.x = spawn.x;
      boss.position.y = spawn.y;
      boss.position.z = spawn.z;
      this.room.state.enemies.push(boss);
    }
    this.room.state.wave += 1;
  }
}

function isBossKind(kind: string) {
  return kind.startsWith('boss-');
}
