import { DeterministicRng, SeatType } from '@htown/shared';
import enemiesData from '@htown/shared/data/enemies.json';
import upgradesData from '@htown/shared/data/upgrades.json';

export type Vec2 = { x: number; y: number };

export type ShipState = {
  position: Vec2;
  velocity: Vec2;
  rotation: number;
  hp: number;
  shields: number;
  heat: number;
  energy: { engines: number; weapons: number; shields: number };
};

export type EnemyState = {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
};

export type ProjectileState = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
};

export type SeatInput = {
  axisX: number;
  axisY: number;
  boost: boolean;
  fire: boolean;
  aim: Vec2;
  weaponIndex: number;
  powerDistribution: { engines: number; weapons: number; shields: number };
  abilities: Record<string, boolean>;
  support: { repair: boolean; ping: boolean; lootPulse: boolean };
};

export type GameSnapshot = {
  time: number;
  ship: {\n    x: number;\n    y: number;\n    vx: number;\n    vy: number;\n    rotation: number;\n    hp: number;\n    shields: number;\n    heat: number;\n  };
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  score: number;
  wave: number;
  seatAssignments: Record<string, SeatType>;
  swap: { inCountdown: boolean; timeRemaining: number };
};

const ENEMY_TYPES = enemiesData as Array<{ id: string; speed: number; hp: number }>;
const UPGRADES = upgradesData as Array<{ id: string; seat: SeatType; effect: string; value: number }>;

export class GameSim {
  private rng: DeterministicRng;
  time = 0;
  ship: ShipState;
  enemies: EnemyState[] = [];
  projectiles: ProjectileState[] = [];
  score = 0;
  wave = 1;
  nextEnemyId = 1;
  nextProjectileId = 1;
  spawnCooldown = 0;
  upgrades: Record<string, number> = {};
  damageMultiplier = 1;

  constructor(seed: number) {
    this.rng = new DeterministicRng(seed);
    this.ship = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      hp: 100,
      shields: 60,
      heat: 0,
      energy: { engines: 0.34, weapons: 0.33, shields: 0.33 },
    };
  }

  tick(delta: number, inputs: Partial<Record<SeatType, SeatInput>>) {
    this.time += delta;
    this.handlePilot(delta, inputs.pilot);
    this.handlePower(inputs.power);
    this.handleSystems(inputs.systems);
    this.handleSupport(inputs.support);
    this.handleWeapons(delta, inputs.gunner);
    this.updateProjectiles(delta);
    this.updateEnemies(delta);
    this.spawnEnemies(delta);
    this.rechargeShields(delta);
  }

  setDamageMultiplier(multiplier: number) {
    this.damageMultiplier = multiplier;
  }

  private handlePilot(delta: number, input?: SeatInput) {
    const accel = 220 * (1 + (this.upgrades.turnRate || 0));
    const boostMultiplier = input?.boost ? 1.6 : 1;
    const ax = (input?.axisX || 0) * accel * boostMultiplier;
    const ay = (input?.axisY || 0) * accel * boostMultiplier;
    this.ship.velocity.x += ax * delta;
    this.ship.velocity.y += ay * delta;

    const friction = 0.86;
    this.ship.velocity.x *= friction;
    this.ship.velocity.y *= friction;

    this.ship.position.x += this.ship.velocity.x * delta;
    this.ship.position.y += this.ship.velocity.y * delta;
  }

  private handlePower(input?: SeatInput) {
    if (!input?.powerDistribution) {
      return;
    }
    const total =
      input.powerDistribution.engines +
      input.powerDistribution.weapons +
      input.powerDistribution.shields;
    if (total <= 0) {
      return;
    }
    this.ship.energy = {
      engines: input.powerDistribution.engines / total,
      weapons: input.powerDistribution.weapons / total,
      shields: input.powerDistribution.shields / total,
    };
  }

  private handleSystems(input?: SeatInput) {
    if (input?.abilities?.overdrive) {
      this.ship.heat = Math.min(100, this.ship.heat + 0.6);
      this.ship.velocity.x *= 1.01;
      this.ship.velocity.y *= 1.01;
    }
  }

  private handleSupport(input?: SeatInput) {
    if (!input?.support) {
      return;
    }
    if (input.support.repair) {
      this.ship.hp = Math.min(100, this.ship.hp + 0.4);
    }
  }

  private handleWeapons(delta: number, input?: SeatInput) {
    if (!input?.fire) {
      return;
    }
    const direction = normalize(input.aim.x, input.aim.y);
    const speed = 520;
      this.projectiles.push({
        id: `p-${this.nextProjectileId++}`,
        x: this.ship.position.x,
        y: this.ship.position.y,
        vx: direction.x * speed,
        vy: direction.y * speed,
        ttl: 1.2,
      });
  }

  private updateProjectiles(delta: number) {
    for (const projectile of this.projectiles) {
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
      projectile.ttl -= delta;
    }
    this.projectiles = this.projectiles.filter((projectile) => projectile.ttl > 0);
  }

  private updateEnemies(delta: number) {
    for (const enemy of this.enemies) {
      const toShip = normalize(this.ship.position.x - enemy.x, this.ship.position.y - enemy.y);
      const data = ENEMY_TYPES.find((entry) => entry.id === enemy.type);
      const speed = data?.speed ?? 80;
      enemy.x += toShip.x * speed * delta;
      enemy.y += toShip.y * speed * delta;

      const distSq =
        (this.ship.position.x - enemy.x) ** 2 + (this.ship.position.y - enemy.y) ** 2;
      if (distSq < 30 * 30) {
        const damage = 4 * this.damageMultiplier;
        if (this.ship.shields > 0) {
          this.ship.shields = Math.max(0, this.ship.shields - damage);
        } else {
          this.ship.hp = Math.max(0, this.ship.hp - damage);
        }
      }

      for (const projectile of this.projectiles) {
        const dx = projectile.x - enemy.x;
        const dy = projectile.y - enemy.y;
        if (dx * dx + dy * dy < 32 * 32) {
          enemy.hp -= 10;
          projectile.ttl = 0;
          if (enemy.hp <= 0) {
            this.score += 10;
          }
        }
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
  }

  private spawnEnemies(delta: number) {
    this.spawnCooldown -= delta;
    if (this.spawnCooldown > 0) {
      return;
    }
    const spawnCount = Math.min(4 + this.wave, 10);
    for (let index = 0; index < spawnCount; index += 1) {
      const type = this.rng.pick(ENEMY_TYPES).id;
      const angle = this.rng.nextRange(0, Math.PI * 2);
      const radius = this.rng.nextRange(420, 620);
      const enemyTemplate = ENEMY_TYPES.find((entry) => entry.id === type);
      this.enemies.push({
        id: `e-${this.nextEnemyId++}`,
        type,
        hp: enemyTemplate?.hp ?? 20,
        x: this.ship.position.x + Math.cos(angle) * radius,
        y: this.ship.position.y + Math.sin(angle) * radius,
      });
    }
    this.wave += 1;
    this.spawnCooldown = 4;
  }

  private rechargeShields(delta: number) {
    const regen = 2 + (this.upgrades.shieldRegen || 0) * 5;
    this.ship.shields = Math.min(80, this.ship.shields + regen * delta);
  }

  rollUpgrades() {
    const shuffled = [...UPGRADES].sort(() => this.rng.next() - 0.5);
    return shuffled.slice(0, 3);
  }

  applyUpgrade(id: string) {
    const upgrade = UPGRADES.find((item) => item.id === id);
    if (!upgrade) {
      return;
    }
    const key = upgrade.effect;
    this.upgrades[key] = (this.upgrades[key] || 0) + upgrade.value;
  }

  getSnapshot(seatAssignments: Record<string, SeatType>, swap: { inCountdown: boolean; timeRemaining: number }): GameSnapshot {
    return {
      time: this.time,
      ship: {
        x: this.ship.position.x,
        y: this.ship.position.y,
        vx: this.ship.velocity.x,
        vy: this.ship.velocity.y,
        rotation: this.ship.rotation,
        hp: this.ship.hp,
        shields: this.ship.shields,
        heat: this.ship.heat,
      },
      enemies: this.enemies,
      projectiles: this.projectiles,
      score: this.score,
      wave: this.wave,
      seatAssignments,
      swap,
    };
  }
}

function normalize(x: number, y: number) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}
