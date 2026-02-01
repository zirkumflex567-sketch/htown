import { Room, Client } from '@colyseus/core';
import {
  GameState,
  PlayerState,
  SeatInputState,
  ProjectileState,
  EnemyState,
  ShipState,
  LootModState,
  LootWeaponState,
  LootUpgradeState,
  LootSynergyState
} from './schema/GameState';
import {
  combos,
  evaluateSynergies,
  generateRunLoadout,
  mulberry32,
  statusEffects,
  tallyTags,
  weapons as weaponDefs,
  upgrades as upgradeDefs
} from '@htown/shared';
import type { GameMode, PlayerInput, RolledUpgrade, RolledWeapon, RunLoadout, SeatType } from '@htown/shared';
import { SeatSystem } from '../systems/SeatSystem';
import { BotSystem } from '../systems/BotSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { ShipSystem } from '../systems/ShipSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { updateRunStats } from '../db';
import { verifyAccessToken } from '../auth';

const statusById = new Map(statusEffects.map((effect) => [effect.id, effect]));
const comboById = new Map(combos.map((combo) => [combo.id, combo]));

export class GameRoom extends Room<GameState> {
  static acceptingPlayers = true;
  static setAcceptingPlayers(value: boolean) {
    GameRoom.acceptingPlayers = value;
  }

  state = new GameState();
  inputs = new Map<SeatType, PlayerInput>();
  rng = mulberry32(Math.floor(Math.random() * 999999));
  mode: GameMode = 'crew';
  modeLocked = false;
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
  lastShipPos = { x: 0, y: 0, z: 0 };
  lastBoost = false;
  lastHandbrake = false;
  lastPowerPreset = '';
  lastPowerValues = { engines: 0.33, weapons: 0.33, shields: 0.34 };
  comboCooldowns = new Map<string, number>();
  lastSupportScanAt = 0;
  lastSupportRepairPerfectAt = 0;
  lastSystemsOverdriveAt = 0;
  lastSystemsShieldAt = 0;
  lastSystemsEmpAt = 0;
  lastSystemsSlowAt = 0;
  lastPilotBoostAt = 0;
  lastPowerShiftEnginesAt = 0;
  lastPowerShiftWeaponsAt = 0;
  lastMarkedKillAt = 0;
  lastMarkedKillId = '';
  lastSupportLootAt = 0;
  lastUpgradeDropAt = 0;
  achievementFlags = new Set<string>();
  soloInputs = new Map<string, { pilot?: PlayerInput; gunner?: PlayerInput }>();
  lastWallHitByShip = new Map<string, number>();
  lastShipPosById = new Map<string, { x: number; y: number; z: number }>();
  lastBoostByShip = new Map<string, boolean>();
  lastHandbrakeByShip = new Map<string, boolean>();
  gunnerHeatByShip = new Map<string, number>();
  shipSpawnIndex = 0;

  private seatSystem = new SeatSystem(this);
  private botSystem = new BotSystem(this);
  private enemySystem = new EnemySystem(this);
  private shipSystem = new ShipSystem(this);
  private upgradeSystem = new UpgradeSystem(this);
  private lastFireAt = new Map<string, number>();
  private sessionToPlayer = new Map<string, string>();
  private projectileCounter = 0;
  private gunnerHeat = 0;
  private soloBotTarget = 5;
  private runLoadout: RunLoadout | null = null;
  private revealedWeapons = 0;
  private revealedUpgrades = 0;
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

  onCreate(options?: { mode?: GameMode }) {
    this.setState(this.state);
    this.state.phase = 'lobby';
    if (options?.mode) {
      this.mode = options.mode;
      this.modeLocked = true;
    }
    this.maxClients = this.mode === 'single' ? 1 : 5;
    this.state.mode = this.mode;
    if (this.listing) {
      this.setMetadata({ mode: this.mode });
    }
    this.seedSeatInputs();
    this.rollRunLoadout();
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);

    this.onMessage('input', (client, input: PlayerInput) => {
      const playerId = this.sessionToPlayer.get(client.sessionId);
      if (!playerId) return;
      const player = this.state.players.get(playerId);
      if (!player || !player.connected) return;
      if (this.state.phase !== 'running') return;
      if (this.mode === 'solo') {
        if (input.seat !== 'pilot' && input.seat !== 'gunner') return;
        const entry = this.soloInputs.get(playerId) ?? {};
        if (input.seat === 'pilot') {
          entry.pilot = input;
        } else {
          entry.gunner = input;
        }
        this.soloInputs.set(playerId, entry);
        return;
      }
      if (this.mode !== 'single' && player.seat !== input.seat) return;
      this.inputs.set(input.seat, input);
    });

    this.onMessage('upgrade', (client, upgradeId: string) => {
      const playerId = this.sessionToPlayer.get(client.sessionId);
      if (!playerId) return;
      const player = this.state.players.get(playerId);
      if (!player || !player.connected) return;
      if (this.state.phase !== 'running') return;
      const upgrade = upgradeDefs.find((entry) => entry.id === upgradeId);
      if (!upgrade) return;
      if (this.mode === 'crew' && upgrade.seat !== 'all' && player?.seat !== upgrade.seat) return;
      const offered = this.state.upgradeChoices.find((entry) => entry.id === upgradeId);
      if (!offered) return;
      this.applyUpgrade(upgradeId);
      this.state.upgradeChoices.clear();
    });

    this.onMessage('ready', (client, payload: { ready?: boolean } | boolean | undefined) => {
      if (this.state.phase !== 'lobby' && this.state.phase !== 'summary') return;
      if (this.state.phase === 'summary') {
        this.state.phase = 'lobby';
      }
      const playerId = this.sessionToPlayer.get(client.sessionId);
      if (!playerId) return;
      const player = this.state.players.get(playerId);
      if (!player || !player.connected || player.isBot) return;
      const nextReady = typeof payload === 'boolean' ? payload : payload?.ready;
      player.ready = typeof nextReady === 'boolean' ? nextReady : !player.ready;
      if (this.allHumansReady()) {
        this.startRun();
      }
    });
  }

  async onAuth(client: Client, options?: { accessToken?: string; userId?: string }) {
    if (!GameRoom.acceptingPlayers) {
      throw new Error('SERVER_PAUSED');
    }
    const token = options?.accessToken;
    if (!token || typeof token !== 'string') {
      throw new Error('UNAUTHORIZED');
    }
    const payload = verifyAccessToken(token);
    if (options?.userId && options.userId !== payload.sub) {
      throw new Error('USER_MISMATCH');
    }
    return { userId: payload.sub };
  }

  onJoin(
    client: Client,
    options: { userId?: string; seat?: SeatType; lockSeat?: boolean; mode?: GameMode; accessToken?: string }
  ) {
    const authedUserId = (client.auth as { userId?: string } | undefined)?.userId;
    const playerId = authedUserId ?? options.userId ?? client.sessionId;
    if (!this.modeLocked && options.mode) {
      this.mode = options.mode;
      this.modeLocked = true;
      this.maxClients = this.mode === 'single' ? 1 : 5;
      this.state.mode = this.mode;
      if (this.listing) {
        this.setMetadata({ mode: this.mode });
      }
    }
    let player = this.state.players.get(playerId);
    if (!player) {
      player = new PlayerState();
      player.id = playerId;
      if (this.mode === 'crew') {
        const preferred = options.seat;
        player.seat = this.seatSystem.assignSeat(playerId, preferred);
      } else {
        player.seat = 'pilot';
      }
      player.isBot = false;
      player.connected = true;
      player.ready = false;
      this.state.players.set(playerId, player);
    } else {
      player.connected = true;
      player.ready = false;
      if (this.mode !== 'crew') {
        player.seat = 'pilot';
      }
    }
    this.sessionToPlayer.set(client.sessionId, playerId);
    if (options.lockSeat) {
      this.lockedPlayers.add(playerId);
    }
    if (this.mode === 'solo') {
      this.ensureSoloShip(playerId);
      if (this.state.phase === 'running') {
        this.syncSoloBots();
      }
    } else {
      this.refreshBots();
    }
  }

  onLeave(client: Client, consented: boolean) {
    const playerId = this.sessionToPlayer.get(client.sessionId) ?? client.sessionId;
    const player = this.state.players.get(playerId);
    if (player) {
      player.connected = false;
      if (this.mode === 'crew') {
        this.refreshBots();
      }
      this.clock.setTimeout(() => {
        if (player.connected) return;
        this.state.players.delete(playerId);
        this.sessionToPlayer.delete(client.sessionId);
        this.lockedPlayers.delete(playerId);
        if (this.mode === 'solo') {
          this.state.ships.delete(playerId);
          this.soloInputs.delete(playerId);
          this.lastWallHitByShip.delete(playerId);
          this.lastShipPosById.delete(playerId);
          this.lastBoostByShip.delete(playerId);
          this.lastHandbrakeByShip.delete(playerId);
          this.gunnerHeatByShip.delete(playerId);
          if (this.state.phase === 'running') {
            this.syncSoloBots();
          }
        } else {
          this.refreshBots();
        }
      }, 30000);
    }
  }

  update(deltaTime: number) {
    if (this.state.phase !== 'running') return;
    const delta = deltaTime / 1000;
    this.simulationTime += deltaTime;
    this.state.timeSurvived += delta;
    const now = this.simulationTime / 1000;
    const scoreMultiplier = this.getScoreMultiplier(now);
    this.state.score += Math.floor((delta * 2 + this.state.enemies.length * 0.2) * scoreMultiplier);

    if (this.mode === 'solo') {
      this.updateSolo(deltaTime);
      return;
    }

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
    this.checkAchievements();
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
      this.state.phase = 'summary';
      for (const player of this.state.players.values()) {
        player.ready = false;
      }
      this.resetRunState(true);
    }
  }

  private updateSolo(deltaTime: number) {
    if (this.state.ships.size === 0) return;
    const delta = deltaTime / 1000;

    for (const [playerId, ship] of this.state.ships.entries()) {
      const inputs = this.soloInputs.get(playerId);
      const pilotInput = inputs?.pilot;
      this.shipSystem.updateShip(delta, ship, pilotInput, undefined, {
        assistActive: false,
        lastPilotMove: { x: 0, y: 0 },
        lastWallHitAt: this.lastWallHitByShip.get(playerId) ?? 0,
        setLastWallHitAt: (value) => this.lastWallHitByShip.set(playerId, value),
        onWallHit: (amount) => this.damageShip(amount, playerId)
      });
    }

    this.updateSoloStats();
    this.enemySystem.update(delta);
    this.updateProjectiles(delta);
    this.upgradeSystem.update(delta);
    this.handleSoloCombat();
    this.checkAchievements();

    for (const [id, heat] of this.gunnerHeatByShip.entries()) {
      this.gunnerHeatByShip.set(id, Math.max(0, heat - delta * 0.6));
    }

    if (this.isSoloGameover()) {
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
      this.state.phase = 'summary';
      for (const player of this.state.players.values()) {
        player.ready = false;
      }
      this.resetRunState(true);
    }
  }

  spawnProjectile(options: {
    kind: string;
    owner: 'player' | 'enemy';
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    ttl: number;
    damage: number;
    pierceRemaining?: number;
    boomerang?: boolean;
  }) {
    const projectile = new ProjectileState();
    projectile.id = `p-${this.projectileCounter++}`;
    projectile.kind = options.kind;
    projectile.owner = options.owner;
    projectile.position.x = options.x;
    projectile.position.y = options.y;
    projectile.position.z = options.z;
    projectile.velocity.x = options.vx;
    projectile.velocity.y = options.vy;
    projectile.velocity.z = options.vz;
    projectile.ttl = options.ttl;
    projectile.initialTtl = options.ttl;
    projectile.damage = options.damage;
    projectile.pierceRemaining = options.pierceRemaining ?? 0;
    projectile.boomerang = Boolean(options.boomerang);
    this.state.projectiles.push(projectile);
  }

  handleCombat(deltaTime: number) {
    this.handleCombatForShip('crew', this.state.ship, this.inputs.get('gunner'));
  }

  private handleCombatForShip(shipId: string, ship: ShipState, gunnerInput?: PlayerInput) {
    if (!gunnerInput?.fire && !gunnerInput?.altFire) return;
    const weaponIndex = gunnerInput.weaponIndex ?? 0;
    const selectedWeapon = weaponDefs[Math.min(weaponIndex, weaponDefs.length - 1)];
    const rocketWeapon = weaponDefs.find((entry) => entry.id === 'rocket') ?? selectedWeapon;
    const weapon = gunnerInput.altFire ? rocketWeapon : selectedWeapon;
    const now = this.simulationTime;
    const key = `gunner-${shipId}-${weapon.id}`;
    const last = this.lastFireAt.get(key) ?? 0;
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
        z: ship.position.z,
        vx: aimDir.x * speed,
        vy: aimDir.y * speed,
        vz: 0,
        ttl: 2.2,
        damage: weapon.damage * damageScale
      });
      this.seatStats.gunner.shots += 1;
      this.seatStats.gunner.rockets += 1;
      return;
    }

    if (weapon.id === 'mg') {
      const heat = shipId === 'crew' ? this.gunnerHeat : this.gunnerHeatByShip.get(shipId) ?? 0;
      if (heat > 1) return;
      const nextHeat = heat + 0.08;
      if (shipId === 'crew') {
        this.gunnerHeat = nextHeat;
      } else {
        this.gunnerHeatByShip.set(shipId, nextHeat);
      }
      const spread = Math.max(0.04, weapon.spread);
      const angle = aimBase + (this.rng() - 0.5) * spread;
      const speed = 320 + ship.energyWeapons * 60;
      this.spawnProjectile({
        kind: 'mg',
        owner: 'player',
        x: ship.position.x,
        y: ship.position.y,
        z: ship.position.z,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 0,
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
        z: ship.position.z,
        vx: Math.cos(aimBase) * speed,
        vy: Math.sin(aimBase) * speed,
        vz: 0,
        ttl: 1.6,
        damage: weapon.damage * damageScale
      });
      this.seatStats.gunner.shots += 1;
      this.seatStats.gunner.cannons += 1;
      return;
    }
    if (weapon.id === 'piercer') {
      const speed = 260 + ship.energyWeapons * 60;
      const pierceCount = ship.pierceUntil > nowSeconds ? 3 : 2;
      this.spawnProjectile({
        kind: 'piercer',
        owner: 'player',
        x: ship.position.x,
        y: ship.position.y,
        z: ship.position.z,
        vx: Math.cos(aimBase) * speed,
        vy: Math.sin(aimBase) * speed,
        vz: 0,
        ttl: 1.8,
        damage: weapon.damage * damageScale,
        pierceRemaining: pierceCount
      });
      this.seatStats.gunner.shots += 1;
      return;
    }
    if (weapon.id === 'boomerang') {
      const speed = 200 + ship.energyWeapons * 40;
      const boomerangActive = ship.boomerangUntil > nowSeconds;
      this.spawnProjectile({
        kind: 'boomerang',
        owner: 'player',
        x: ship.position.x,
        y: ship.position.y,
        z: ship.position.z,
        vx: Math.cos(aimBase) * speed,
        vy: Math.sin(aimBase) * speed,
        vz: 0,
        ttl: boomerangActive ? 2.2 : 1.6,
        damage: weapon.damage * damageScale,
        boomerang: boomerangActive
      });
      this.seatStats.gunner.shots += 1;
      return;
    }
    if (weapon.id === 'arc') {
      const speed = 240 + ship.energyWeapons * 50;
      this.spawnProjectile({
        kind: 'arc',
        owner: 'player',
        x: ship.position.x,
        y: ship.position.y,
        z: ship.position.z,
        vx: Math.cos(aimBase) * speed,
        vy: Math.sin(aimBase) * speed,
        vz: 0,
        ttl: 1.5,
        damage: weapon.damage * damageScale
      });
      this.seatStats.gunner.shots += 1;
      return;
    }
  }

  private handleSoloCombat() {
    for (const [playerId, ship] of this.state.ships.entries()) {
      const gunnerInput = this.soloInputs.get(playerId)?.gunner;
      this.handleCombatForShip(playerId, ship, gunnerInput);
    }
  }

  private isSoloGameover() {
    if (this.state.ships.size === 0) return false;
    for (const ship of this.state.ships.values()) {
      if (ship.health > 0) return false;
    }
    return true;
  }

  updateProjectiles(delta: number) {
    const now = this.simulationTime / 1000;
    const ships = this.mode === 'solo' ? Array.from(this.state.ships.values()) : [this.state.ship];
    const scoreBoost = ships.some((ship) => ship.scoreBoostUntil > now) ? 1.2 : 1;
    const chainActive = ships.some((ship) => ship.chainUntil > now);
    const poisonActive = ships.some((ship) => ship.poisonUntil > now);
    const pendingExplosions: Array<{ x: number; y: number; z: number; radius: number; damage: number }> = [];
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
      if (isBossKind(enemy.kind)) {
        this.bossKillCount += 1;
      }
      if (enemy.markedUntil > now || enemy.exposedUntil > now || enemy.trackingUntil > now) {
        this.lastMarkedKillAt = now;
        this.lastMarkedKillId = enemy.id;
      }
      this.state.enemies.splice(removeIndex, 1);
      this.maybeDropUpgrade(isBossKind(enemy.kind) ? 'boss' : 'enemy');
    };
    const queueExplosion = (x: number, y: number, z: number, radius: number, baseDamage: number) => {
      pendingExplosions.push({ x, y, z, radius, damage: baseDamage });
    };
    const applyChain = (source: EnemyState, baseDamage: number) => {
      const chainTargets = this.state.enemies
        .filter((enemy) => enemy.id !== source.id)
        .map((enemy) => ({
          enemy,
          dist: distance(
            source.position.x,
            source.position.y,
            source.position.z,
            enemy.position.x,
            enemy.position.y,
            enemy.position.z
          )
        }))
        .filter((entry) => entry.dist < 22)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
      for (const target of chainTargets) {
        target.enemy.health -= baseDamage * 0.5 * statusMultiplier(target.enemy);
        this.seatStats.gunner.hits += 1;
        if (target.enemy.health <= 0) {
          recordKill(target.enemy, this.state.enemies.indexOf(target.enemy));
        }
      }
    };
    const resolveExplosions = () => {
      while (pendingExplosions.length) {
        const next = pendingExplosions.shift();
        if (!next) break;
        for (let j = this.state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = this.state.enemies[j];
          const dist = distance(next.x, next.y, next.z, enemy.position.x, enemy.position.y, enemy.position.z);
          if (dist > next.radius) continue;
          const falloff = 1 - dist / next.radius;
          enemy.health -= next.damage * (0.5 + 0.5 * falloff) * statusMultiplier(enemy);
          this.seatStats.gunner.hits += 1;
          if (enemy.health <= 0) {
            const volatile = enemy.volatileUntil > now;
            const ex = enemy.position.x;
            const ey = enemy.position.y;
            const ez = enemy.position.z;
            recordKill(enemy, j);
            if (volatile) {
              pendingExplosions.push({ x: ex, y: ey, z: ez, radius: 24, damage: 18 });
            }
          }
        }
      }
    };

    for (let i = this.state.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.state.projectiles[i];
      projectile.position.x += projectile.velocity.x * delta;
      projectile.position.y += projectile.velocity.y * delta;
      projectile.position.z += projectile.velocity.z * delta;
      if (projectile.boomerang && !projectile.returning && projectile.ttl < projectile.initialTtl * 0.5) {
        projectile.velocity.x *= -1;
        projectile.velocity.y *= -1;
        projectile.velocity.z *= -1;
        projectile.returning = true;
      }
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
              projectile.position.z,
              enemy.position.x,
              enemy.position.y,
              enemy.position.z
            );
            if (dist < hitRadius + trackingBonus) {
              const radius = projectile.kind === 'rocket' ? 20 : 14;
              const damage = projectile.damage || (projectile.kind === 'rocket' ? 40 : 18);
              queueExplosion(projectile.position.x, projectile.position.y, projectile.position.z, radius, damage);
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
              projectile.position.z,
              enemy.position.x,
              enemy.position.y,
              enemy.position.z
            );
            if (dist < hitRadius + trackingBonus) {
              enemy.health -= (projectile.damage || 8) * statusMultiplier(enemy);
              this.seatStats.gunner.hits += 1;
              if (poisonActive || projectile.kind === 'arc') {
                enemy.poisonedUntil = Math.max(enemy.poisonedUntil, now + 4);
              }
              if (chainActive || enemy.shockedUntil > now || projectile.kind === 'arc') {
                applyChain(enemy, projectile.damage || 8);
              }
              if (projectile.pierceRemaining > 0) {
                projectile.pierceRemaining -= 1;
              } else {
                projectile.ttl = 0;
              }
              if (enemy.health <= 0) {
                if (enemy.volatileUntil > now) {
                  queueExplosion(enemy.position.x, enemy.position.y, enemy.position.z, 24, 18);
                  resolveExplosions();
                }
                recordKill(enemy, j);
              }
              break;
            }
          }
        }
      } else {
        const targets =
          this.mode === 'solo'
            ? this.getEnemyTargets()
            : [{ id: 'crew', ship: this.state.ship }];
        let hitTarget: { id: string; ship: ShipState } | null = null;
        let hitDist = Infinity;
        for (const target of targets) {
          const dist = distance(
            projectile.position.x,
            projectile.position.y,
            projectile.position.z,
            target.ship.position.x,
            target.ship.position.y,
            target.ship.position.z
          );
          if (dist < 7 && dist < hitDist) {
            hitTarget = target;
            hitDist = dist;
          }
        }
        if (hitTarget) {
          const shipId = hitTarget.id === 'crew' ? undefined : hitTarget.id;
          this.damageShip(projectile.damage || 8, shipId);
          projectile.ttl = 0;
        }
      }
      if (projectile.ttl <= 0) {
        if (!exploded && projectile.owner === 'player' && (projectile.kind === 'rocket' || projectile.kind === 'cannon')) {
          const radius = projectile.kind === 'rocket' ? 18 : 12;
          const damage = projectile.damage || (projectile.kind === 'rocket' ? 36 : 16);
          queueExplosion(projectile.position.x, projectile.position.y, projectile.position.z, radius, damage);
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
        enemy.shockedUntil = Math.max(enemy.shockedUntil, now + 2.4);
        if (systems.empMode === 'overcharge') {
          this.applyStatus(enemy, 'exposed', now);
        }
        if (systems.empMode === 'combo') {
          this.applyStatus(enemy, 'weakpoint', now);
          this.applyStatus(enemy, 'exposed', now);
        }
      }
      this.lastSystemsEmpAt = now;
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
      this.lastSystemsSlowAt = now;
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
          const volatileTarget = this.state.enemies.find((enemy) => isBossKind(enemy.kind)) ?? this.state.enemies[0];
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
      this.lastSupportLootAt = now;
      this.maybeDropUpgrade('event');
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
    if (id === 'shockchain') {
      this.state.ship.chainUntil = now + 4;
      this.state.ship.visionPulseUntil = Math.max(this.state.ship.visionPulseUntil, now + 2.5);
    }
    if (id === 'toxicloud') {
      this.state.ship.poisonUntil = now + 4.5;
      this.state.ship.comboTrailUntil = Math.max(this.state.ship.comboTrailUntil, now + 2.5);
    }
    if (id === 'piercingrun') {
      this.state.ship.pierceUntil = now + 4;
      this.state.ship.boomerangUntil = now + 4;
    }

    if (id === 'shockchain') {
      this.awardAchievement('shockchain', 'Shock Chain Unlocked');
    }
    if (id === 'toxicloud') {
      this.awardAchievement('toxicloud', 'Toxic Cloud Unlocked');
    }
    if (id === 'piercingrun') {
      this.awardAchievement('piercingrun', 'Piercing Run Unlocked');
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

    const shockWindow = (comboById.get('shockchain')?.windowMs ?? 1200) / 1000;
    if (
      now - this.lastSupportScanAt <= shockWindow &&
      now - this.lastSystemsEmpAt <= shockWindow &&
      now - this.lastMarkedKillAt <= shockWindow
    ) {
      this.triggerCombo('shockchain', 'Scan + EMP + marked kill', now);
      this.lastSystemsEmpAt = 0;
    }

    const toxicWindow = (comboById.get('toxicloud')?.windowMs ?? 1300) / 1000;
    if (
      now - this.lastSupportLootAt <= toxicWindow &&
      now - this.lastSystemsSlowAt <= toxicWindow &&
      now - this.lastPowerShiftWeaponsAt <= toxicWindow
    ) {
      this.triggerCombo('toxicloud', 'Loot + slow field + weapons surge', now);
      this.lastSupportLootAt = 0;
    }

    const piercingWindow = (comboById.get('piercingrun')?.windowMs ?? 1200) / 1000;
    if (
      now - this.lastSystemsOverdriveAt <= piercingWindow &&
      now - this.lastPowerShiftWeaponsAt <= piercingWindow &&
      now - this.lastPilotBoostAt <= 1.4
    ) {
      this.triggerCombo('piercingrun', 'Overdrive + weapons shift + boost', now);
      this.lastSystemsOverdriveAt = 0;
    }
  }

  private awardAchievement(id: string, label: string) {
    if (this.achievementFlags.has(id)) return;
    this.achievementFlags.add(id);
    this.broadcast('achievement', { id, label });
  }

  private checkAchievements() {
    if (this.killCount >= 25) this.awardAchievement('kill-25', '25 Eliminations');
    if (this.killCount >= 100) this.awardAchievement('kill-100', '100 Eliminations');
    if (this.bossKillCount >= 1) this.awardAchievement('boss-1', 'First Boss Down');
    if (this.state.wave >= 10) this.awardAchievement('wave-10', 'Wave 10 Survivor');
  }

  private updateSeatStats(delta: number) {
    const ship = this.state.ship;
    const dx = ship.position.x - this.lastShipPos.x;
    const dy = ship.position.y - this.lastShipPos.y;
    const dz = ship.position.z - this.lastShipPos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 0) {
      this.seatStats.pilot.distance += dist;
    }
    this.lastShipPos.x = ship.position.x;
    this.lastShipPos.y = ship.position.y;
    this.lastShipPos.z = ship.position.z;

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

  private updateSoloStats() {
    for (const [playerId, ship] of this.state.ships.entries()) {
      const last = this.lastShipPosById.get(playerId);
      if (last) {
        const dx = ship.position.x - last.x;
        const dy = ship.position.y - last.y;
        const dz = ship.position.z - last.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > 0) {
          this.seatStats.pilot.distance += dist;
        }
      }
      this.lastShipPosById.set(playerId, {
        x: ship.position.x,
        y: ship.position.y,
        z: ship.position.z
      });

      const pilotInput = this.soloInputs.get(playerId)?.pilot;
      const boost = Boolean(pilotInput?.boost);
      const lastBoost = this.lastBoostByShip.get(playerId) ?? false;
      if (boost && !lastBoost) this.seatStats.pilot.boosts += 1;
      this.lastBoostByShip.set(playerId, boost);

      const handbrake = Boolean(pilotInput?.handbrake);
      const lastHandbrake = this.lastHandbrakeByShip.get(playerId) ?? false;
      if (handbrake && !lastHandbrake) this.seatStats.pilot.handbrakes += 1;
      this.lastHandbrakeByShip.set(playerId, handbrake);
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
    this.lastShipPos = { x: this.state.ship.position.x, y: this.state.ship.position.y, z: this.state.ship.position.z };
    this.lastBoost = false;
    this.lastHandbrake = false;
    this.lastPowerPreset = '';
    this.lastPowerValues = { engines: 0.33, weapons: 0.33, shields: 0.34 };
  }

  private resetSeatBonuses() {
    this.seatBonuses = {
      pilot: { speed: 0 },
      gunner: { damage: 0 },
      power: { shield: 0 },
      systems: { cooldown: 0 },
      support: { vision: 0 }
    };
  }

  private resetSystemsState() {
    const systems = this.state.systems;
    systems.empCooldown = 0;
    systems.shieldCooldown = 0;
    systems.slowCooldown = 0;
    systems.overdriveCooldown = 0;
    systems.overdriveUntil = 0;
    systems.empUntil = 0;
    systems.slowFieldUntil = 0;
    systems.slowFieldRadius = 0;
    systems.empMode = 'standard';
    systems.shieldMode = 'standard';
    systems.slowMode = 'standard';
    systems.overdriveMode = 'standard';
  }

  private resetSupportState() {
    const support = this.state.support;
    support.pingCooldown = 0;
    support.repairCooldown = 0;
    support.radarUntil = 0;
    support.repairWindowStart = 0;
    support.repairWindowEnd = 0;
    support.repairQuality = 0;
  }

  private resetSeatInputState() {
    for (const seat of ['pilot', 'gunner', 'power', 'systems', 'support'] as SeatType[]) {
      let entry = this.state.seatInputs.get(seat);
      if (!entry) {
        entry = new SeatInputState();
        entry.seat = seat;
        this.state.seatInputs.set(seat, entry);
      }
      entry.seat = seat;
      entry.move.x = 0;
      entry.move.y = 0;
      entry.aim.x = 0;
      entry.aim.y = 0;
      entry.lift = 0;
      entry.boost = false;
      entry.fire = false;
      entry.weaponIndex = 0;
      entry.powerEngines = 0.33;
      entry.powerWeapons = 0.33;
      entry.powerShields = 0.34;
      entry.powerPreset = 'balanced';
      entry.systemsAbility = -1;
      entry.supportAction = '';
    }
  }

  private resetShipState(ship: ShipState, position?: { x: number; y: number; z: number }) {
    if (position) {
      ship.position.x = position.x;
      ship.position.y = position.y;
      ship.position.z = position.z;
    }
    ship.velocity.x = 0;
    ship.velocity.y = 0;
    ship.velocity.z = 0;
    ship.heading = 0;
    ship.health = 100;
    ship.shield = 50;
    ship.energyEngines = 0.33;
    ship.energyWeapons = 0.33;
    ship.energyShields = 0.34;
    ship.visionRadius = 160;
    ship.powerTargetEngines = 0.33;
    ship.powerTargetWeapons = 0.33;
    ship.powerTargetShields = 0.34;
    ship.powerInstability = 0;
    ship.powerHeat = 0;
    ship.powerWindowStart = 0;
    ship.powerWindowEnd = 0;
    ship.powerWindowType = '';
    ship.powerOverloadUntil = 0;
    ship.powerPerfectUntil = 0;
    ship.visionPulseUntil = 0;
    ship.comboSpeedUntil = 0;
    ship.comboTrailUntil = 0;
    ship.comboDamageUntil = 0;
    ship.hullRegenUntil = 0;
    ship.scoreBoostUntil = 0;
    ship.reflectUntil = 0;
    ship.chainUntil = 0;
    ship.poisonUntil = 0;
    ship.pierceUntil = 0;
    ship.boomerangUntil = 0;
  }

  private resetRunState(resetPositions: boolean) {
    this.simulationTime = 0;
    this.invulUntil = 0;
    this.stabilizerUntil = 0;
    this.swapGraceUntil = 0;
    this.swapOverdriveSeconds = 0;
    this.state.swapCountdown = 0;
    this.state.swapGrace = 0;
    this.state.swapLabel = '';
    this.state.comboName = '';
    this.state.comboDetail = '';
    this.state.comboUntil = 0;
    this.state.score = 0;
    this.state.wave = 1;
    this.state.timeSurvived = 0;
    this.state.enemies.clear();
    this.state.projectiles.clear();
    this.state.upgradeChoices.clear();
    this.killCount = 0;
    this.bossKillCount = 0;
    this.gunnerHeat = 0;
    this.lastSupportScanAt = 0;
    this.lastSupportRepairPerfectAt = 0;
    this.lastSystemsOverdriveAt = 0;
    this.lastSystemsShieldAt = 0;
    this.lastSystemsEmpAt = 0;
    this.lastSystemsSlowAt = 0;
    this.lastPilotBoostAt = 0;
    this.lastPowerShiftEnginesAt = 0;
    this.lastPowerShiftWeaponsAt = 0;
    this.lastMarkedKillAt = 0;
    this.lastMarkedKillId = '';
    this.lastSupportLootAt = 0;
    this.lastUpgradeDropAt = 0;
    this.comboCooldowns.clear();
    this.lastFireAt.clear();
    this.achievementFlags.clear();
    this.clearSeatInputs();
    this.soloInputs.clear();
    this.resetSeatInputState();
    this.resetSystemsState();
    this.resetSupportState();
    this.resetSeatBonuses();
    this.lastShipPosById.clear();
    this.lastBoostByShip.clear();
    this.lastHandbrakeByShip.clear();
    this.lastWallHitByShip.clear();
    this.gunnerHeatByShip.clear();

    const crewSpawn = resetPositions ? { x: 0, y: 0, z: 0 } : undefined;
    this.resetShipState(this.state.ship, crewSpawn);

    if (this.mode === 'solo') {
      const ships = Array.from(this.state.ships.entries());
      const count = Math.max(ships.length, 1);
      ships.forEach(([playerId, ship], index) => {
        const angle = (index / count) * Math.PI * 2;
        const radius = 8;
        const spawn = resetPositions
          ? { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 }
          : undefined;
        this.resetShipState(ship, spawn);
        this.lastShipPosById.set(playerId, {
          x: ship.position.x,
          y: ship.position.y,
          z: ship.position.z
        });
        this.lastBoostByShip.set(playerId, false);
        this.lastHandbrakeByShip.set(playerId, false);
        this.lastWallHitByShip.set(playerId, 0);
        this.gunnerHeatByShip.set(playerId, 0);
      });
      this.shipSpawnIndex = this.state.ships.size;
    }

    this.resetSeatStats();
    this.rollRunLoadout();
  }

  private syncSoloBots() {
    if (this.mode !== 'solo') return;
    const humanIds = new Set<string>();
    const existingBots: string[] = [];
    this.state.players.forEach((player) => {
      if (player.isBot && player.id.startsWith('bot-solo-')) {
        existingBots.push(player.id);
      } else if (!player.isBot) {
        humanIds.add(player.id);
      }
    });
    const desiredBotCount = Math.max(0, this.soloBotTarget - humanIds.size);
    existingBots.sort();

    // Remove extra bots.
    for (let i = desiredBotCount; i < existingBots.length; i += 1) {
      const id = existingBots[i];
      this.state.players.delete(id);
      this.state.ships.delete(id);
      this.soloInputs.delete(id);
      this.lastWallHitByShip.delete(id);
      this.lastShipPosById.delete(id);
      this.lastBoostByShip.delete(id);
      this.lastHandbrakeByShip.delete(id);
      this.gunnerHeatByShip.delete(id);
    }

    // Add missing bots.
    const used = new Set<string>([...humanIds, ...existingBots.slice(0, desiredBotCount)]);
    let index = 1;
    while (used.size - humanIds.size < desiredBotCount) {
      const id = `bot-solo-${index}`;
      index += 1;
      if (used.has(id)) continue;
      used.add(id);
      let player = this.state.players.get(id);
      if (!player) {
        player = new PlayerState();
        player.id = id;
        player.seat = 'pilot';
        player.isBot = true;
        player.connected = true;
        player.ready = false;
        this.state.players.set(id, player);
      }
      this.ensureSoloShip(id);
    }
  }

  clearSeatInputs() {
    this.inputs.clear();
  }

  private allHumansReady() {
    const humans = Array.from(this.state.players.values()).filter((player) => !player.isBot && player.connected);
    if (!humans.length) return false;
    return humans.every((player) => player.ready);
  }

  private startRun() {
    this.state.phase = 'running';
    for (const player of this.state.players.values()) {
      player.ready = false;
    }
    this.resetRunState(true);
    if (this.mode === 'solo') {
      this.syncSoloBots();
    } else {
      this.refreshBots();
    }
  }

  refreshBots() {
    if (this.mode !== 'crew') {
      this.botSeats.clear();
      for (const [id, player] of this.state.players.entries()) {
        if (player.isBot) this.state.players.delete(id);
      }
      return;
    }
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

  ensureSoloShip(playerId: string) {
    if (this.state.ships.has(playerId)) return;
    const ship = new ShipState();
    const index = this.shipSpawnIndex % 5;
    this.shipSpawnIndex += 1;
    const angle = (index / 5) * Math.PI * 2;
    const radius = 8;
    ship.position.x = Math.cos(angle) * radius;
    ship.position.y = Math.sin(angle) * radius;
    ship.position.z = 0;
    this.state.ships.set(playerId, ship);
    this.lastShipPosById.set(playerId, {
      x: ship.position.x,
      y: ship.position.y,
      z: ship.position.z
    });
    this.lastWallHitByShip.set(playerId, 0);
    this.gunnerHeatByShip.set(playerId, 0);
  }

  getEnemyTargets() {
    if (this.mode === 'solo') {
      const targets: Array<{ id: string; ship: ShipState }> = [];
      this.state.ships.forEach((ship, id) => targets.push({ id, ship }));
      return targets;
    }
    return [{ id: 'crew', ship: this.state.ship }];
  }

  getSpawnAnchor() {
    if (this.mode !== 'solo' || this.state.ships.size === 0) {
      return {
        x: this.state.ship.position.x,
        y: this.state.ship.position.y,
        z: this.state.ship.position.z
      };
    }
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let count = 0;
    this.state.ships.forEach((ship) => {
      sumX += ship.position.x;
      sumY += ship.position.y;
      sumZ += ship.position.z;
      count += 1;
    });
    const div = count || 1;
    return { x: sumX / div, y: sumY / div, z: sumZ / div };
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
    if (this.mode === 'solo') return;
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
      entry.lift = input?.lift ?? 0;

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

  private getScoreMultiplier(now: number) {
    if (this.mode === 'solo') {
      for (const ship of this.state.ships.values()) {
        if (ship.scoreBoostUntil > now) return 1.35;
      }
      return 1;
    }
    return this.state.ship.scoreBoostUntil > now ? 1.35 : 1;
  }

  enableSeatStabilizer(durationMs: number) {
    this.stabilizerUntil = this.simulationTime + durationMs;
  }

  damageShip(amount: number, shipId?: string) {
    const now = this.simulationTime / 1000;
    if (this.invulUntil > now) return;
    const ship = shipId ? this.state.ships.get(shipId) : this.state.ship;
    if (!ship) return;
    if (ship.reflectUntil > now) {
      const reflectRadius = 26;
      for (let i = this.state.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = this.state.enemies[i];
        const dist = distance(
          ship.position.x,
          ship.position.y,
          ship.position.z,
          enemy.position.x,
          enemy.position.y,
          enemy.position.z
        );
        if (dist > reflectRadius) continue;
        enemy.health -= amount * 0.4;
        if (enemy.health <= 0) {
          this.killCount += 1;
        if (isBossKind(enemy.kind)) {
          this.bossKillCount += 1;
        }
        this.state.enemies.splice(i, 1);
          this.maybeDropUpgrade(isBossKind(enemy.kind) ? 'boss' : 'enemy');
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

  maybeDropUpgrade(source: 'enemy' | 'boss' | 'event') {
    if (this.state.upgradeChoices.length) return;
    const now = this.simulationTime / 1000;
    const cooldown = source === 'boss' ? 6 : 8;
    if (now - this.lastUpgradeDropAt < cooldown) return;
    const chance = source === 'boss' ? 1 : source === 'event' ? 0.7 : 0.2;
    if (source !== 'boss' && this.rng() > chance) return;
    this.lastUpgradeDropAt = now;
    this.upgradeSystem.rollUpgrades();
    this.revealLoot({
      upgrades: 1,
      weapons: this.revealedWeapons === 0 || source === 'boss' ? 1 : 0
    });
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

  private rollRunLoadout() {
    const seed = Math.floor(this.rng() * 999999999);
    this.runLoadout = generateRunLoadout(seed, { weaponCount: 2, upgradeCount: 10 });
    this.revealedWeapons = 0;
    this.revealedUpgrades = 0;
    this.state.loot.seed = 0;
    this.state.loot.weapons.clear();
    this.state.loot.upgrades.clear();
    this.state.loot.synergies.clear();
  }

  private revealLoot(options: { weapons?: number; upgrades?: number } = {}) {
    if (!this.runLoadout) return;
    const weaponCount = options.weapons ?? 0;
    const upgradeCount = options.upgrades ?? 0;
    let revealedAny = false;

    const nextWeaponCount = Math.min(this.runLoadout.weapons.length, this.revealedWeapons + weaponCount);
    for (let i = this.revealedWeapons; i < nextWeaponCount; i += 1) {
      const weapon = this.runLoadout.weapons[i];
      if (weapon) {
        this.state.loot.weapons.push(this.buildWeaponState(weapon));
        revealedAny = true;
      }
    }
    this.revealedWeapons = nextWeaponCount;

    const nextUpgradeCount = Math.min(this.runLoadout.upgrades.length, this.revealedUpgrades + upgradeCount);
    for (let i = this.revealedUpgrades; i < nextUpgradeCount; i += 1) {
      const upgrade = this.runLoadout.upgrades[i];
      if (upgrade) {
        this.state.loot.upgrades.push(this.buildUpgradeState(upgrade));
        revealedAny = true;
      }
    }
    this.revealedUpgrades = nextUpgradeCount;

    this.refreshSynergies();
  }

  private refreshSynergies() {
    this.state.loot.synergies.clear();
    if (!this.runLoadout) return;
    const weapons = this.runLoadout.weapons.slice(0, this.revealedWeapons);
    const upgrades = this.runLoadout.upgrades.slice(0, this.revealedUpgrades);
    if (!weapons.length && !upgrades.length) return;
    const tagCounts = tallyTags(weapons, upgrades);
    const synergies = evaluateSynergies(tagCounts);
    synergies.forEach((synergy) => {
      const synergyState = new LootSynergyState();
      synergyState.name = synergy.name;
      synergyState.description = synergy.description;
      synergy.requirements.forEach((req) => {
        const label = req.count && req.count > 1 ? `${req.tag} x${req.count}` : req.tag;
        synergyState.requirements.push(label);
      });
      if (synergy.anyOf?.length) {
        const min = synergy.minAnyOf ?? 1;
        synergyState.requirements.push(`any ${min}: ${synergy.anyOf.join(' / ')}`);
      }
      this.state.loot.synergies.push(synergyState);
    });
  }

  private buildWeaponState(weapon: RolledWeapon) {
    const weaponState = new LootWeaponState();
    weaponState.name = weapon.name;
    weaponState.rarity = weapon.rarity;
    weaponState.powerScore = weapon.powerScore;
    weapon.tags.forEach((tag) => weaponState.tags.push(tag));
    Object.entries(weapon.stats).forEach(([key, value]) => weaponState.stats.set(key, value));

    weapon.mods.forEach((mod) => {
      const modState = new LootModState();
      modState.name = mod.name;
      modState.description = mod.description;
      mod.tags.forEach((tag) => modState.tags.push(tag));
      weaponState.mods.push(modState);
    });

    if (weapon.quirk) {
      weaponState.quirkName = weapon.quirk.name;
      weaponState.quirkDescription = weapon.quirk.description;
      weapon.quirk.tags.forEach((tag) => weaponState.quirkTags.push(tag));
    }
    return weaponState;
  }

  private buildUpgradeState(upgrade: RolledUpgrade) {
    const upgradeState = new LootUpgradeState();
    upgradeState.name = upgrade.name;
    upgradeState.rarity = upgrade.rarity;
    upgradeState.description = upgrade.description;
    upgrade.tags.forEach((tag) => upgradeState.tags.push(tag));
    return upgradeState;
  }
}

function distance(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

function isBossKind(kind: string) {
  return kind.startsWith('boss-');
}
