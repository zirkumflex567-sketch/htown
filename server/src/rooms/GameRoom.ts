import { Room, Client } from '@colyseus/core';
import { GameState, PlayerState, SeatInputState, ProjectileState, EnemyState } from './schema/GameState';
import { combos, mulberry32, statusEffects, weapons as weaponDefs, upgrades as upgradeDefs } from '@htown/shared';
import type { PlayerInput, SeatType } from '@htown/shared';
import { SeatSystem } from '../systems/SeatSystem';
import { BotSystem } from '../systems/BotSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { ShipSystem } from '../systems/ShipSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { updateRunStats } from '../db';

const statusById = new Map(statusEffects.map((effect) => [effect.id, effect]));
const comboById = new Map(combos.map((combo) => [combo.id, combo]));

export class GameRoom extends Room<GameState> {
  state = new GameState();
  inputs = new Map<SeatType, PlayerInput>();
  rng = mulberry32(Math.floor(Math.random() * 999999));
  simulationTime = 0;
  damageReduction = 1;
  swapGraceUntil = 0;
  stabilizerUntil = 0;
  botSeats = new Set<SeatType>();
  lockedPlayers = new Set<string>();
  lastPilotMove = { x: 0, y: 0 };
  lastGunnerAim = { x: 1, y: 0 };
  seatStats = {
    pilot: { distance: 0, boosts: 0, handbrakes: 0 },
    gunner: { shots: 0, hits: 0, kills: 0, rockets: 0, cannons: 0, mgs: 0 },
    power: { presets: 0, sliders: 0 },
    systems: { uses: 0 },
    support: { scans: 0, repairs: 0, loots: 0 }
  };
  lastShipPos = { x: 0, y: 0 };
  lastBoost = false;
  lastHandbrake = false;
  lastPowerPreset = '';
  lastPowerValues = { engines: 0.33, weapons: 0.33, shields: 0.34 };
  comboCooldowns = new Map<string, number>();
  lastSupportScanAt = 0;
  lastSupportRepairPerfectAt = 0;
  lastSystemsOverdriveAt = 0;
  lastSystemsShieldAt = 0;
  lastPilotBoostAt = 0;
  lastPowerShiftEnginesAt = 0;
  lastPowerShiftWeaponsAt = 0;
  lastMarkedKillAt = 0;
  lastMarkedKillId = '';

  private seatSystem = new SeatSystem(this);
  private botSystem = new BotSystem(this);
  private enemySystem = new EnemySystem(this);
  private shipSystem = new ShipSystem(this);
  private upgradeSystem = new UpgradeSystem(this);
  private lastFireAt = new Map<string, number>();
  private sessionToPlayer = new Map<string, string>();
  private projectileCounter = 0;
  private gunnerHeat = 0;
  invulUntil = 0;
  lastWallHit = 0;
  killCount = 0;
  bossKillCount = 0;
  seatBonuses = {
    pilot: { speed: 0 },
    gunner: { damage: 0 },
    power: { shield: 0 },
    systems: { cooldown: 0 },
    support: { vision: 0 }
  };
  swapOverdriveSeconds = 0;

  onCreate() {
    this.setState(this.state);
    this.seedSeatInputs();
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);

    this.onMessage('input', (client, input: PlayerInput) => {
      this.inputs.set(input.seat, input);
    });

    this.onMessage('upgrade', (client, upgradeId: string) => {
      const upgrade = upgradeDefs.find((entry) => entry.id === upgradeId);
      if (!upgrade) return;
      const playerId = this.sessionToPlayer.get(client.sessionId) ?? client.sessionId;
      const player = this.state.players.get(playerId);
      if (upgrade.seat !== 'all' && player?.seat !== upgrade.seat) return;
      this.applyUpgrade(upgradeId);
      this.state.upgradeChoices.clear();
    });
  }

  onJoin(client: Client, options: { userId?: string; seat?: SeatType; lockSeat?: boolean }) {
    const playerId = options.userId ?? client.sessionId;
    let player = this.state.players.get(playerId);
    if (!player) {
      player = new PlayerState();
      player.id = playerId;
      player.seat = this.seatSystem.assignSeat(playerId, options.seat);
      player.isBot = false;
      player.connected = true;
      this.state.players.set(playerId, player);
    } else {
      player.connected = true;
    }
    this.sessionToPlayer.set(client.sessionId, playerId);
    if (options.lockSeat) {
      this.lockedPlayers.add(playerId);
    }
    this.refreshBots();
  }

  onLeave(client: Client, consented: boolean) {
    const playerId = this.sessionToPlayer.get(client.sessionId) ?? client.sessionId;
    const player = this.state.players.get(playerId);
    if (player) {
      player.connected = false;
      this.refreshBots();
      this.clock.setTimeout(() => {
        if (player.connected) return;
        this.state.players.delete(playerId);
        this.sessionToPlayer.delete(client.sessionId);
        this.lockedPlayers.delete(playerId);
        this.refreshBots();
      }, 30000);
    }
  }

  update(deltaTime: number) {
    const delta = deltaTime / 1000;
    this.simulationTime += deltaTime;
    this.state.timeSurvived += delta;
    const now = this.simulationTime / 1000;
    const scoreMultiplier = this.state.ship.scoreBoostUntil > now ? 1.35 : 1;
    this.state.score += Math.floor((delta * 2 + this.state.enemies.length * 0.2) * scoreMultiplier);

    this.seatSystem.tick(deltaTime);
    this.botSystem.update();
    this.syncSeatInputs();
    this.shipSystem.update(delta);
    this.updateSeatStats(delta);
    this.updateSystemsModes();
    this.updateSystemsAbilities(delta);
    this.updateSupportActions(delta);
    this.enemySystem.update(delta);
    this.updateProjectiles(delta);
    this.upgradeSystem.update(delta);
    this.handleCombat(deltaTime);
    this.checkCombos();
    this.gunnerHeat = Math.max(0, this.gunnerHeat - delta * 0.6);

    if (this.state.ship.health <= 0) {
      const seatSnapshot = JSON.parse(JSON.stringify(this.seatStats));
      this.broadcast('gameover', {
        score: this.state.score,
        wave: this.state.wave,
        time: this.state.timeSurvived,
        kills: this.killCount,
        bossKills: this.bossKillCount,
        seatStats: seatSnapshot
      });
      this.saveScores(seatSnapshot);
      this.state.ship.health = 100;
      this.state.score = 0;
      this.state.wave = 1;
      this.state.timeSurvived = 0;
      this.state.enemies.clear();
      this.killCount = 0;
      this.bossKillCount = 0;
      this.resetSeatStats();
    }
  }

  spawnProjectile(options: {
    kind: string;
    owner: 'player' | 'enemy';
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl: number;
    damage: number;
  }) {
    const projectile = new ProjectileState();
    projectile.id = `p-${this.projectileCounter++}`;
    projectile.kind = options.kind;
    projectile.owner = options.owner;
    projectile.position.x = options.x;
    projectile.position.y = options.y;
    projectile.velocity.x = options.vx;
    projectile.velocity.y = options.vy;
    projectile.ttl = options.ttl;
    projectile.damage = options.damage;
    this.state.projectiles.push(projectile);
  }

  handleCombat(deltaTime: number) {
    const gunnerInput = this.inputs.get('gunner');
    if (!gunnerInput?.fire && !gunnerInput?.altFire) return;
    const weaponIndex = gunnerInput.weaponIndex ?? 0;
    const selectedWeapon = weaponDefs[Math.min(weaponIndex, weaponDefs.length - 1)];
    const rocketWeapon = weaponDefs.find((entry) => entry.id === 'rocket') ?? selectedWeapon;
    const weapon = gunnerInput.altFire ? rocketWeapon : selectedWeapon;
    const now = this.simulationTime;
    const key = `gunner-${weapon.id}`;
    const last = this.lastFireAt.get(key) ?? 0;
    const ship = this.state.ship;
    const nowSeconds = now / 1000;
    const overdriveActive = this.state.systems.overdriveUntil > nowSeconds;
    const powerPerfect = ship.powerPerfectUntil > nowSeconds;
    const overloadActive = ship.powerOverloadUntil > nowSeconds;
    const comboDamage = ship.comboDamageUntil > nowSeconds;
    const cooldownMs =
      weapon.cooldownMs *
      (1 - ship.energyWeapons * 0.25) *
      (overdriveActive ? 0.7 : 1) *
      (overloadActive ? 1.1 : 1);
    if (now - last < cooldownMs) return;
    this.lastFireAt.set(key, now);

    const aim = gunnerInput.aim ?? { x: 1, y: 0 };
    const aimLen = Math.hypot(aim.x, aim.y) || 1;
    const aimDir = { x: aim.x / aimLen, y: aim.y / aimLen };

    const damageScale =
      (1 + ship.energyWeapons * 0.5 + (overdriveActive ? 0.25 : 0) + this.seatBonuses.gunner.damage) *
      (comboDamage ? 1.25 : 1) *
      (powerPerfect ? 1.06 : 1) *
      (overloadActive ? 0.92 : 1);
    const aimBase = Math.atan2(aimDir.y, aimDir.x);

    if (weapon.id === 'rocket') {
      const speed = 220 + ship.energyWeapons * 80 + (overdriveActive ? 40 : 0);
      this.spawnProjectile({
        kind: 'rocket',
        owner: 'player',
        x: ship.position.x,
        y: ship.position.y,
        vx: aimDir.x * speed,
        vy: aimDir.y * speed,
        ttl: 2.2,
        damage: weapon.damage * damageScale
      });
      this.seatStats.gunner.shots += 1;
      this.seatStats.gunner.rockets += 1;
      return;
    }

    if (weapon.id === 'mg') {
      if (this.gunnerHeat > 1) return;
      this.gunnerHeat += 0.08;
      const spread = Math.max(0.04, weapon.spread);
      const angle = aimBase + (this.rng() - 0.5) * spread;
      const speed = 320 + ship.energyWeapons * 60;
      this.spawnProjectile({
        kind: 'mg',
        owner: 'player',
        x: ship.position.x,
        y: ship.position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl: 1.1,
        damage: weapon.damage * damageScale
      });
      this.seatStats.gunner.shots += 1;
      this.seatStats.gunner.mgs += 1;
      return;
    }
    if (weapon.id === 'cannon') {
      const speed = 220 + ship.energyWeapons * 50;
      this.spawnProjectile({
        kind: 'cannon',
        owner: 'player',
        x: ship.position.x,
        y: ship.position.y,
        vx: Math.cos(aimBase) * speed,
        vy: Math.sin(aimBase) * speed,
        ttl: 1.6,
        damage: weapon.damage * damageScale
      });
      this.seatStats.gunner.shots += 1;
      this.seatStats.gunner.cannons += 1;
      return;
    }
  }

  updateProjectiles(delta: number) {
    const now = this.simulationTime / 1000;
    const scoreBoost = this.state.ship.scoreBoostUntil > now ? 1.2 : 1;
    const pendingExplosions: Array<{ x: number; y: number; radius: number; damage: number }> = [];
    const statusMultiplier = (enemy: EnemyState) => {
      let mult = 1;
      if (enemy.exposedUntil > now) mult += 0.2;
      if (enemy.weakpointUntil > now) mult += 0.35;
      if (enemy.trackingUntil > now) mult += 0.1;
      return mult;
    };
    const recordKill = (enemy: EnemyState, index: number) => {
      const removeIndex =
        index >= 0 && index < this.state.enemies.length ? index : this.state.enemies.indexOf(enemy);
      if (removeIndex < 0) return;
      this.state.score += Math.floor(25 * scoreBoost);
      this.killCount += 1;
      this.seatStats.gunner.kills += 1;
      if (enemy.kind === 'boss') {
        this.bossKillCount += 1;
      }
      if (enemy.markedUntil > now || enemy.exposedUntil > now || enemy.trackingUntil > now) {
        this.lastMarkedKillAt = now;
        this.lastMarkedKillId = enemy.id;
      }
      this.state.enemies.splice(removeIndex, 1);
    };
    const queueExplosion = (x: number, y: number, radius: number, baseDamage: number) => {
      pendingExplosions.push({ x, y, radius, damage: baseDamage });
    };
    const resolveExplosions = () => {
      while (pendingExplosions.length) {
        const next = pendingExplosions.shift();
        if (!next) break;
        for (let j = this.state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = this.state.enemies[j];
          const dist = distance(next.x, next.y, enemy.position.x, enemy.position.y);
          if (dist > next.radius) continue;
          const falloff = 1 - dist / next.radius;
          enemy.health -= next.damage * (0.5 + 0.5 * falloff) * statusMultiplier(enemy);
          this.seatStats.gunner.hits += 1;
          if (enemy.health <= 0) {
            const volatile = enemy.volatileUntil > now;
            const ex = enemy.position.x;
            const ey = enemy.position.y;
            recordKill(enemy, j);
            if (volatile) {
              pendingExplosions.push({ x: ex, y: ey, radius: 24, damage: 18 });
            }
          }
        }
      }
    };

    for (let i = this.state.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.state.projectiles[i];
      projectile.position.x += projectile.velocity.x * delta;
      projectile.position.y += projectile.velocity.y * delta;
      projectile.ttl -= delta;
      let exploded = false;
      if (projectile.owner === 'player') {
        if (projectile.kind === 'rocket' || projectile.kind === 'cannon') {
          const hitRadius = projectile.kind === 'rocket' ? 9 : 7;
          for (let j = this.state.enemies.length - 1; j >= 0; j -= 1) {
            const enemy = this.state.enemies[j];
            const trackingBonus = enemy.trackingUntil > now ? 3 : 0;
            const dist = distance(
              projectile.position.x,
              projectile.position.y,
              enemy.position.x,
              enemy.position.y
            );
            if (dist < hitRadius + trackingBonus) {
              const radius = projectile.kind === 'rocket' ? 20 : 14;
              const damage = projectile.damage || (projectile.kind === 'rocket' ? 40 : 18);
              queueExplosion(projectile.position.x, projectile.position.y, radius, damage);
              resolveExplosions();
              projectile.ttl = 0;
              exploded = true;
              break;
            }
          }
        } else {
          const hitRadius = 5;
          for (let j = this.state.enemies.length - 1; j >= 0; j -= 1) {
            const enemy = this.state.enemies[j];
            const trackingBonus = enemy.trackingUntil > now ? 3 : 0;
            const dist = distance(
              projectile.position.x,
              projectile.position.y,
              enemy.position.x,
              enemy.position.y
            );
            if (dist < hitRadius + trackingBonus) {
              enemy.health -= (projectile.damage || 8) * statusMultiplier(enemy);
              this.seatStats.gunner.hits += 1;
              projectile.ttl = 0;
              if (enemy.health <= 0) {
                if (enemy.volatileUntil > now) {
                  queueExplosion(enemy.position.x, enemy.position.y, 24, 18);
                  resolveExplosions();
                }
                recordKill(enemy, j);
              }
              break;
            }
          }
        }
      } else {
        const ship = this.state.ship;
        const dist = distance(projectile.position.x, projectile.position.y, ship.position.x, ship.position.y);
        if (dist < 7) {
          this.damageShip(projectile.damage || 8);
          projectile.ttl = 0;
        }
      }
      if (projectile.ttl <= 0) {
        if (!exploded && projectile.owner === 'player' && (projectile.kind === 'rocket' || projectile.kind === 'cannon')) {
          const radius = projectile.kind === 'rocket' ? 18 : 12;
          const damage = projectile.damage || (projectile.kind === 'rocket' ? 36 : 16);
          queueExplosion(projectile.position.x, projectile.position.y, radius, damage);
          resolveExplosions();
        }
        this.state.projectiles.splice(i, 1);
      }
    }
  }

  updateSystemsAbilities(delta: number) {
    const systems = this.state.systems;
    systems.empCooldown = Math.max(0, systems.empCooldown - delta);
    systems.shieldCooldown = Math.max(0, systems.shieldCooldown - delta);
    systems.slowCooldown = Math.max(0, systems.slowCooldown - delta);
    systems.overdriveCooldown = Math.max(0, systems.overdriveCooldown - delta);

    const now = this.simulationTime / 1000;
    if (systems.overdriveUntil > 0 && now > systems.overdriveUntil) {
      systems.overdriveUntil = 0;
    }

    const input = this.inputs.get('systems');
    const ability = input?.systems?.abilityIndex;
    if (ability === undefined || ability === null) return;

    const cooldownScale = 1 - this.seatBonuses.systems.cooldown;
    if (ability === 0 && systems.empCooldown <= 0) {
      systems.empCooldown = 12 * cooldownScale;
      systems.empUntil = now + 2;
      for (const enemy of this.state.enemies) {
        enemy.slowUntil = Math.max(enemy.slowUntil, now + 2);
        if (systems.empMode === 'overcharge') {
          this.applyStatus(enemy, 'exposed', now);
        }
        if (systems.empMode === 'combo') {
          this.applyStatus(enemy, 'weakpoint', now);
          this.applyStatus(enemy, 'exposed', now);
        }
      }
      this.seatStats.systems.uses += 1;
    }

    if (ability === 1 && systems.shieldCooldown <= 0) {
      systems.shieldCooldown = 18 * cooldownScale;
      const shieldBonus = systems.shieldMode === 'fortify' ? 90 : systems.shieldMode === 'reflect' ? 50 : 60;
      this.state.ship.shield = Math.min(this.state.ship.shield + shieldBonus, 140);
      this.invulUntil = now + (systems.shieldMode === 'fortify' ? 1.6 : 1.2);
      if (systems.shieldMode === 'reflect') {
        this.state.ship.reflectUntil = now + 2.2;
      }
      if (systems.shieldMode === 'support') {
        const support = this.state.support;
        support.repairWindowStart = now;
        support.repairWindowEnd = Math.max(support.repairWindowEnd, now + 0.6);
      }
      this.lastSystemsShieldAt = now;
      this.seatStats.systems.uses += 1;
    }

    if (ability === 2 && systems.slowCooldown <= 0) {
      systems.slowCooldown = 16 * cooldownScale;
      const wide = systems.slowMode === 'wide';
      systems.slowFieldUntil = now + (wide ? 5.5 : 4);
      systems.slowFieldRadius = wide ? 160 : 120;
      this.seatStats.systems.uses += 1;
    }

    if (ability === 3 && systems.overdriveCooldown <= 0) {
      systems.overdriveCooldown = 22 * cooldownScale;
      const duration = systems.overdriveMode === 'momentum' ? 6.5 : systems.overdriveMode === 'weapon' ? 5.5 : 5;
      systems.overdriveUntil = now + duration;
      this.lastSystemsOverdriveAt = now;
      if (systems.overdriveMode === 'weapon') {
        this.state.ship.comboDamageUntil = Math.max(this.state.ship.comboDamageUntil, now + 1.5);
      }
      this.seatStats.systems.uses += 1;
    }
  }

  private updateSystemsModes() {
    const ship = this.state.ship;
    const systems = this.state.systems;
    const now = this.simulationTime / 1000;
    const powerPerfect = ship.powerPerfectUntil > now;
    const powerWeapons = ship.energyWeapons + (powerPerfect ? 0.08 : 0);
    const powerShields = ship.energyShields + (powerPerfect ? 0.05 : 0);
    const powerEngines = ship.energyEngines + (powerPerfect ? 0.05 : 0);

    systems.empMode = ship.comboDamageUntil > now ? 'combo' : powerWeapons > 0.6 ? 'overcharge' : 'standard';
    systems.shieldMode =
      ship.reflectUntil > now
        ? 'reflect'
        : powerShields > 0.6
          ? 'fortify'
          : this.state.support.repairWindowEnd > now
            ? 'support'
            : 'standard';
    systems.slowMode = powerEngines > 0.6 ? 'wide' : 'standard';
    systems.overdriveMode = powerEngines > 0.6 ? 'momentum' : powerWeapons > 0.6 ? 'weapon' : 'standard';
  }

  updateSupportActions(delta: number) {
    const support = this.state.support;
    support.pingCooldown = Math.max(0, support.pingCooldown - delta);
    support.repairCooldown = Math.max(0, support.repairCooldown - delta);
    support.radarUntil = Math.max(0, support.radarUntil - delta);

    const input = this.inputs.get('support');
    const action = input?.support?.action;
    const now = this.simulationTime / 1000;

    if (action === 'scan' && support.pingCooldown <= 0) {
      support.pingCooldown = 10;
      support.radarUntil = 6;
      this.lastSupportScanAt = now;
      for (const enemy of this.state.enemies) {
        enemy.markedUntil = Math.max(enemy.markedUntil, now + 6);
        this.applyStatus(enemy, 'exposed', now);
      }
      const volatileTarget = this.state.enemies.find((enemy) => enemy.kind === 'boss') ?? this.state.enemies[0];
      if (volatileTarget) this.applyStatus(volatileTarget, 'volatile', now);
      const trackingTarget = this.state.enemies[this.state.enemies.length - 1];
      if (trackingTarget) this.applyStatus(trackingTarget, 'tracking', now);
      this.seatStats.support.scans += 1;
    }

    if (action === 'repair') {
      if (support.repairWindowEnd > 0 && now <= support.repairWindowEnd) {
        const perfect = now >= support.repairWindowStart && now <= support.repairWindowEnd;
        support.repairWindowStart = 0;
        support.repairWindowEnd = 0;
        support.repairQuality = perfect ? 1 : -1;
        const heal = perfect ? 42 : 22;
        support.repairCooldown = perfect ? 7 : 10;
        this.state.ship.health = Math.min(100, this.state.ship.health + heal);
        this.seatStats.support.repairs += 1;
        if (perfect) this.lastSupportRepairPerfectAt = now;
      } else if (support.repairCooldown <= 0 && support.repairWindowEnd <= 0) {
        support.repairWindowStart = now + 0.25;
        support.repairWindowEnd = now + 0.65;
        support.repairQuality = 0;
      }
    }

    if (support.repairWindowEnd > 0 && now > support.repairWindowEnd && support.repairQuality === 0) {
      support.repairQuality = -1;
      support.repairCooldown = 10;
      this.state.ship.health = Math.min(100, this.state.ship.health + 18);
      this.seatStats.support.repairs += 1;
      support.repairWindowStart = 0;
      support.repairWindowEnd = 0;
    }

    if (action === 'loot' && support.radarUntil <= 0) {
      support.radarUntil = 4;
      this.seatStats.support.loots += 1;
    }
  }

  private applyStatus(enemy: EnemyState, id: string, now: number) {
    const def = statusById.get(id);
    if (!def) return;
    const until = now + def.duration;
    switch (id) {
      case 'exposed':
        enemy.exposedUntil = Math.max(enemy.exposedUntil, until);
        break;
      case 'volatile':
        enemy.volatileUntil = Math.max(enemy.volatileUntil, until);
        break;
      case 'tracking':
        enemy.trackingUntil = Math.max(enemy.trackingUntil, until);
        break;
      case 'weakpoint':
        enemy.weakpointUntil = Math.max(enemy.weakpointUntil, until);
        break;
    }
  }

  private triggerCombo(id: string, detail: string, now: number) {
    const combo = comboById.get(id);
    if (!combo) return;
    const cooldownUntil = this.comboCooldowns.get(id) ?? 0;
    if (now < cooldownUntil) return;
    this.comboCooldowns.set(id, now + combo.cooldownMs / 1000);
    this.state.comboName = combo.name;
    this.state.comboDetail = detail;
    this.state.comboUntil = now + 2;

    if (id === 'execution') {
      this.state.ship.comboDamageUntil = now + 3;
      this.state.ship.visionPulseUntil = now + 2;
      this.gunnerHeat = 0;
    }
    if (id === 'momentum') {
      this.state.ship.comboSpeedUntil = now + 3;
      this.state.ship.comboTrailUntil = now + 3;
    }
    if (id === 'stabilization') {
      this.state.ship.hullRegenUntil = now + 4;
      this.state.ship.scoreBoostUntil = now + 6;
      this.state.ship.powerOverloadUntil = 0;
      this.state.ship.powerInstability = Math.max(0, this.state.ship.powerInstability - 0.4);
    }
  }

  private checkCombos() {
    const now = this.simulationTime / 1000;
    if (this.lastMarkedKillAt > 0) {
      const executionWindow = (comboById.get('execution')?.windowMs ?? 1500) / 1000;
      if (
        now - this.lastMarkedKillAt <= executionWindow &&
        now - this.lastSupportScanAt <= executionWindow &&
        this.state.ship.energyWeapons > 0.6
      ) {
        this.triggerCombo('execution', 'Marked kill + weapons surge', now);
        this.lastMarkedKillAt = 0;
      }
    }

    const momentumWindow = (comboById.get('momentum')?.windowMs ?? 1200) / 1000;
    if (
      now - this.lastSystemsOverdriveAt <= momentumWindow &&
      now - this.lastPilotBoostAt <= 1 &&
      now - this.lastPowerShiftEnginesAt <= 1
    ) {
      this.triggerCombo('momentum', 'Overdrive + boost + engines shift', now);
      this.lastSystemsOverdriveAt = 0;
    }

    const stabilizationWindow = (comboById.get('stabilization')?.windowMs ?? 700) / 1000;
    if (
      now - this.lastSupportRepairPerfectAt <= stabilizationWindow &&
      now - this.lastSystemsShieldAt <= stabilizationWindow
    ) {
      this.triggerCombo('stabilization', 'Perfect repair during shield burst', now);
      this.lastSupportRepairPerfectAt = 0;
    }
  }

  private updateSeatStats(delta: number) {
    const ship = this.state.ship;
    const dx = ship.position.x - this.lastShipPos.x;
    const dy = ship.position.y - this.lastShipPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      this.seatStats.pilot.distance += dist;
    }
    this.lastShipPos.x = ship.position.x;
    this.lastShipPos.y = ship.position.y;

    const pilotInput = this.inputs.get('pilot');
    const boost = Boolean(pilotInput?.boost);
    if (boost && !this.lastBoost) this.seatStats.pilot.boosts += 1;
    if (boost && !this.lastBoost) this.lastPilotBoostAt = this.simulationTime / 1000;
    this.lastBoost = boost;

    const handbrake = Boolean(pilotInput?.handbrake);
    if (handbrake && !this.lastHandbrake) this.seatStats.pilot.handbrakes += 1;
    this.lastHandbrake = handbrake;

    const powerInput = this.inputs.get('power');
    if (powerInput?.powerPreset && powerInput.powerPreset !== this.lastPowerPreset) {
      this.seatStats.power.presets += 1;
      this.lastPowerPreset = powerInput.powerPreset;
    }
    if (powerInput?.power) {
      const diff =
        Math.abs(powerInput.power.engines - this.lastPowerValues.engines) +
        Math.abs(powerInput.power.weapons - this.lastPowerValues.weapons) +
        Math.abs(powerInput.power.shields - this.lastPowerValues.shields);
      if (diff > 0.05) this.seatStats.power.sliders += 1;
      if (diff > 0.12) {
        const now = this.simulationTime / 1000;
        if (powerInput.power.engines > 0.6) this.lastPowerShiftEnginesAt = now;
        if (powerInput.power.weapons > 0.6) this.lastPowerShiftWeaponsAt = now;
      }
      this.lastPowerValues = {
        engines: powerInput.power.engines,
        weapons: powerInput.power.weapons,
        shields: powerInput.power.shields
      };
    }
  }

  private resetSeatStats() {
    this.seatStats = {
      pilot: { distance: 0, boosts: 0, handbrakes: 0 },
      gunner: { shots: 0, hits: 0, kills: 0, rockets: 0, cannons: 0, mgs: 0 },
      power: { presets: 0, sliders: 0 },
      systems: { uses: 0 },
      support: { scans: 0, repairs: 0, loots: 0 }
    };
    this.lastShipPos = { x: this.state.ship.position.x, y: this.state.ship.position.y };
    this.lastBoost = false;
    this.lastHandbrake = false;
    this.lastPowerPreset = '';
    this.lastPowerValues = { engines: 0.33, weapons: 0.33, shields: 0.34 };
  }

  refreshBots() {
    const activeSeats = new Set<SeatType>();
    for (const player of this.state.players.values()) {
      if (player.connected && !player.isBot) {
        activeSeats.add(player.seat);
      }
    }
    this.botSeats.clear();
    for (const seat of ['pilot', 'gunner', 'power', 'systems', 'support'] as SeatType[]) {
      if (!activeSeats.has(seat)) {
        this.botSeats.add(seat);
      }
    }
    for (const [id, player] of this.state.players.entries()) {
      if (player.isBot && !this.botSeats.has(player.seat)) {
        this.state.players.delete(id);
      }
    }
    for (const seat of this.botSeats) {
      const id = `bot-${seat}`;
      let player = this.state.players.get(id);
      if (!player) {
        player = new PlayerState();
        player.id = id;
        player.seat = seat;
        player.isBot = true;
        player.connected = true;
        this.state.players.set(id, player);
      }
    }
  }

  private seedSeatInputs() {
    for (const seat of ['pilot', 'gunner', 'power', 'systems', 'support'] as SeatType[]) {
      if (!this.state.seatInputs.has(seat)) {
        const entry = new SeatInputState();
        entry.seat = seat;
        this.state.seatInputs.set(seat, entry);
      }
    }
  }

  private syncSeatInputs() {
    this.seedSeatInputs();
    const assistActive = this.stabilizerUntil > this.simulationTime;
    for (const seat of ['pilot', 'gunner', 'power', 'systems', 'support'] as SeatType[]) {
      const input = this.inputs.get(seat);
      const entry = this.state.seatInputs.get(seat);
      if (!entry) continue;
      entry.seat = seat;
      entry.boost = Boolean(input?.boost);
      entry.fire = Boolean(input?.fire);
      entry.weaponIndex = input?.weaponIndex ?? entry.weaponIndex ?? 0;

      const move = input?.move ?? { x: 0, y: 0 };
      entry.move.x = move.x;
      entry.move.y = move.y;
      if (seat === 'pilot') {
        this.lastPilotMove = move;
      }

      let aim = input?.aim ?? { x: 1, y: 0 };
      if (seat === 'gunner') {
        if (assistActive) {
          const lastAngle = Math.atan2(this.lastGunnerAim.y, this.lastGunnerAim.x);
          const targetAngle = Math.atan2(aim.y, aim.x);
          let delta = targetAngle - lastAngle;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          const maxTurn = 0.35;
          const clamped = Math.max(-maxTurn, Math.min(maxTurn, delta));
          const nextAngle = lastAngle + clamped;
          aim = { x: Math.cos(nextAngle), y: Math.sin(nextAngle) };
        }
        this.lastGunnerAim = aim;
      }
      entry.aim.x = aim.x;
      entry.aim.y = aim.y;

      if (input?.power) {
        entry.powerEngines = input.power.engines;
        entry.powerWeapons = input.power.weapons;
        entry.powerShields = input.power.shields;
        if (input.powerPreset) entry.powerPreset = input.powerPreset;
      } else {
        if (assistActive) {
          entry.powerEngines = 0.33;
          entry.powerWeapons = 0.33;
          entry.powerShields = 0.34;
          entry.powerPreset = 'balanced';
        } else {
          entry.powerEngines = this.state.ship.energyEngines;
          entry.powerWeapons = this.state.ship.energyWeapons;
          entry.powerShields = this.state.ship.energyShields;
        }
      }

      entry.systemsAbility = input?.systems?.abilityIndex ?? entry.systemsAbility ?? -1;
      entry.supportAction = input?.support?.action ?? entry.supportAction ?? '';
    }
  }

  enableSeatStabilizer(durationMs: number) {
    this.stabilizerUntil = this.simulationTime + durationMs;
  }

  damageShip(amount: number) {
    const now = this.simulationTime / 1000;
    if (this.invulUntil > now) return;
    const ship = this.state.ship;
    if (ship.reflectUntil > now) {
      const reflectRadius = 26;
      for (let i = this.state.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = this.state.enemies[i];
        const dist = distance(ship.position.x, ship.position.y, enemy.position.x, enemy.position.y);
        if (dist > reflectRadius) continue;
        enemy.health -= amount * 0.4;
        if (enemy.health <= 0) {
          this.killCount += 1;
          if (enemy.kind === 'boss') {
            this.bossKillCount += 1;
          }
          this.state.enemies.splice(i, 1);
        }
        break;
      }
    }
    const shieldFactor = 0.3 + ship.energyShields * 0.6;
    const shieldHit = Math.min(ship.shield, amount * shieldFactor);
    ship.shield = Math.max(ship.shield - shieldHit, 0);
    const residual = amount - shieldHit;
    const mitigation = 1 - ship.energyShields * 0.15;
    ship.health = Math.max(ship.health - residual * mitigation, 0);
  }

  applyUpgrade(upgradeId: string) {
    const upgrade = upgradeDefs.find((entry) => entry.id === upgradeId);
    if (!upgrade) return;
    if (upgrade.effect.type === 'damage') {
      this.seatBonuses.gunner.damage += upgrade.effect.value;
    }
    if (upgrade.effect.type === 'speed') {
      this.seatBonuses.pilot.speed += upgrade.effect.value;
    }
    if (upgrade.effect.type === 'shield') {
      this.seatBonuses.power.shield += upgrade.effect.value;
    }
    if (upgrade.effect.type === 'cooldown') {
      this.seatBonuses.systems.cooldown += upgrade.effect.value;
    }
    if (upgrade.effect.type === 'vision') {
      this.seatBonuses.support.vision += upgrade.effect.value;
    }
    if (upgrade.effect.type === 'swap') {
      this.swapOverdriveSeconds = Math.max(this.swapOverdriveSeconds, upgrade.effect.value);
    }
  }

  saveScores(seatSnapshot?: Record<string, unknown>) {
    for (const player of this.state.players.values()) {
      if (player.isBot) continue;
      updateRunStats(player.id, {
        score: this.state.score,
        kills: this.killCount,
        wave: this.state.wave,
        bossKills: this.bossKillCount,
        summary: JSON.stringify({
          wave: this.state.wave,
          time: this.state.timeSurvived,
          kills: this.killCount,
          bossKills: this.bossKillCount,
          seats: seatSnapshot ?? this.seatStats
        })
      });
    }
  }
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}
