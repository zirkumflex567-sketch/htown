import { nanoid } from "nanoid";
import { EnemyState, RoomState, SeatType, UpgradeOption } from "@htown/shared";
import { SeededRng } from "@htown/shared";
import { enemyData, upgradeData, weaponData } from "./data";

export type PilotInput = { x: number; y: number; boost: boolean };
export type GunnerInput = { aimX: number; aimY: number; fire: boolean; weapon: string };
export type PowerInput = { engines: number; weapons: number; shields: number };
export type SystemsInput = { ability: number };
export type SupportInput = { repair: boolean; scan: boolean; loot: boolean };

export type SeatInputs = {
  pilot: PilotInput;
  gunner: GunnerInput;
  power: PowerInput;
  systems: SystemsInput;
  support: SupportInput;
};

export type RuntimeState = {
  weaponCooldowns: Record<string, number>;
  systemsCooldowns: number[];
  supportCooldowns: number[];
  enemyReveal: Map<string, number>;
  upgradeModifiers: Record<string, number>;
  rng: SeededRng;
  nextUpgradeIn: number;
};

const ARENA_SIZE = 900;

export function createRuntime(seed: number): RuntimeState {
  return {
    weaponCooldowns: {},
    systemsCooldowns: [0, 0, 0],
    supportCooldowns: [0, 0, 0],
    enemyReveal: new Map(),
    upgradeModifiers: {
      pilot_turn: 1,
      gunner_rate: 1,
      power_eff: 1,
      systems_cd: 1,
      support_repair: 1,
    },
    rng: new SeededRng(seed),
    nextUpgradeIn: 20,
  };
}

export function createDefaultInputs(): SeatInputs {
  return {
    pilot: { x: 0, y: 0, boost: false },
    gunner: { aimX: 1, aimY: 0, fire: false, weapon: "mg" },
    power: { engines: 0.34, weapons: 0.33, shields: 0.33 },
    systems: { ability: -1 },
    support: { repair: false, scan: false, loot: false },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function randomSpawn(rng: SeededRng): { x: number; y: number } {
  const angle = rng.range(0, Math.PI * 2);
  const radius = rng.range(ARENA_SIZE * 0.35, ARENA_SIZE * 0.48);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function getWeapon(id: string) {
  return weaponData.find((weapon) => weapon.id === id) ?? weaponData[0];
}

function spawnEnemy(state: RoomState, runtime: RuntimeState): void {
  const enemyKind = runtime.rng.pick(enemyData);
  const pos = randomSpawn(runtime.rng);
  const enemy = new EnemyState();
  enemy.id = nanoid();
  enemy.kind = enemyKind.id;
  enemy.x = pos.x;
  enemy.y = pos.y;
  enemy.hp = enemyKind.hp;
  state.enemies.push(enemy);
}

function ensureEnemies(state: RoomState, runtime: RuntimeState): void {
  const desired = Math.min(6 + state.wave * 2, 30);
  while (state.enemies.length < desired) {
    spawnEnemy(state, runtime);
  }
}

function updateEnemy(enemy: EnemyState, state: RoomState, dt: number): void {
  const ship = state.ship;
  const kind = enemyData.find((entry) => entry.id === enemy.kind) ?? enemyData[0];
  const dir = normalize(ship.x - enemy.x, ship.y - enemy.y);
  enemy.x += dir.x * kind.speed * dt;
  enemy.y += dir.y * kind.speed * dt;
}

function applyDamage(state: RoomState, amount: number): void {
  const ship = state.ship;
  const mitigation = state.swapCountdown > 0 || state.swapGrace > 0 ? 0.6 : 1;
  const damage = amount * mitigation;
  if (ship.shield > 0) {
    const absorbed = Math.min(ship.shield, damage);
    ship.shield -= absorbed;
    ship.hp -= Math.max(0, damage - absorbed);
  } else {
    ship.hp -= damage;
  }
}

function handleWeaponFire(
  state: RoomState,
  runtime: RuntimeState,
  input: GunnerInput,
  dt: number
): void {
  const weapon = getWeapon(input.weapon);
  runtime.weaponCooldowns[weapon.id] = Math.max(
    0,
    (runtime.weaponCooldowns[weapon.id] ?? 0) - dt
  );
  if (!input.fire || runtime.weaponCooldowns[weapon.id] > 0) {
    return;
  }
  const fireRateMod = runtime.upgradeModifiers.gunner_rate ?? 1;
  runtime.weaponCooldowns[weapon.id] = (weapon.cooldownMs / 1000) / fireRateMod;
  const aim = normalize(input.aimX, input.aimY);
  let target: EnemyState | null = null;
  let targetDist = weapon.range;
  for (const enemy of state.enemies) {
    const dx = enemy.x - state.ship.x;
    const dy = enemy.y - state.ship.y;
    const dist = Math.hypot(dx, dy);
    if (dist > weapon.range) continue;
    const dir = normalize(dx, dy);
    const dot = dir.x * aim.x + dir.y * aim.y;
    if (dot < 1 - weapon.spread) continue;
    if (dist < targetDist) {
      target = enemy;
      targetDist = dist;
    }
  }
  if (!target) return;
  const pellets = weapon.pellets ?? 1;
  target.hp -= weapon.damage * pellets;
  runtime.enemyReveal.set(target.id, 0.6);
  if (target.hp <= 0) {
    const index = state.enemies.findIndex((enemy) => enemy.id === target.id);
    if (index >= 0) {
      state.enemies.splice(index, 1);
    }
    state.score += 10;
  }
}

function updateShip(state: RoomState, runtime: RuntimeState, input: SeatInputs, dt: number): void {
  const ship = state.ship;
  const pilot = input.pilot;
  const power = input.power;

  ship.energyEngines = clamp(power.engines, 0.1, 0.8);
  ship.energyWeapons = clamp(power.weapons, 0.1, 0.8);
  ship.energyShields = clamp(power.shields, 0.1, 0.8);

  const turnMod = runtime.upgradeModifiers.pilot_turn ?? 1;
  const thrust = 140 * ship.energyEngines * turnMod;
  const boost = pilot.boost ? 1.6 : 1;
  const aim = normalize(pilot.x, pilot.y);
  const sensitivity = state.swapCountdown > 0 ? 0.6 : 1;
  ship.vx += aim.x * thrust * dt * boost * sensitivity;
  ship.vy += aim.y * thrust * dt * boost * sensitivity;
  ship.vx *= 0.96;
  ship.vy *= 0.96;
  ship.x = clamp(ship.x + ship.vx * dt, -ARENA_SIZE / 2, ARENA_SIZE / 2);
  ship.y = clamp(ship.y + ship.vy * dt, -ARENA_SIZE / 2, ARENA_SIZE / 2);
  if (Math.hypot(ship.vx, ship.vy) > 0.1) {
    ship.rotation = Math.atan2(ship.vy, ship.vx);
  }
}

function updateSystems(state: RoomState, runtime: RuntimeState, input: SystemsInput, dt: number): void {
  runtime.systemsCooldowns = runtime.systemsCooldowns.map((cd) => Math.max(0, cd - dt));
  if (input.ability < 0) return;
  const idx = clamp(input.ability, 0, runtime.systemsCooldowns.length - 1);
  if (runtime.systemsCooldowns[idx] > 0) return;
  runtime.systemsCooldowns[idx] = 8 / (runtime.upgradeModifiers.systems_cd ?? 1);
  if (idx === 0) {
    for (const enemy of state.enemies) {
      const dist = Math.hypot(enemy.x - state.ship.x, enemy.y - state.ship.y);
      if (dist < 160) {
        enemy.hp -= 12;
        runtime.enemyReveal.set(enemy.id, 0.8);
      }
    }
  }
  if (idx === 1) {
    state.ship.shield = Math.min(80, state.ship.shield + 25);
  }
  if (idx === 2) {
    state.score += 5;
  }
  input.ability = -1;
}

function updateSupport(state: RoomState, runtime: RuntimeState, input: SupportInput, dt: number): void {
  runtime.supportCooldowns = runtime.supportCooldowns.map((cd) => Math.max(0, cd - dt));
  if (input.repair && runtime.supportCooldowns[0] <= 0) {
    runtime.supportCooldowns[0] = 6 / (runtime.upgradeModifiers.support_repair ?? 1);
    state.ship.hp = Math.min(120, state.ship.hp + 10);
    input.repair = false;
  }
  if (input.scan && runtime.supportCooldowns[1] <= 0) {
    runtime.supportCooldowns[1] = 8;
    for (const enemy of state.enemies) {
      runtime.enemyReveal.set(enemy.id, 1.2);
    }
    input.scan = false;
  }
  if (input.loot && runtime.supportCooldowns[2] <= 0) {
    runtime.supportCooldowns[2] = 10;
    state.score += 3;
    input.loot = false;
  }
}

export function updateSimulation(
  state: RoomState,
  runtime: RuntimeState,
  inputs: SeatInputs,
  dt: number
): void {
  state.tick += 1;
  state.timeElapsed += dt;
  state.score += dt * 2;

  if (state.phase !== "running") return;

  updateShip(state, runtime, inputs, dt);
  handleWeaponFire(state, runtime, inputs.gunner, dt);
  updateSystems(state, runtime, inputs.systems, dt);
  updateSupport(state, runtime, inputs.support, dt);

  ensureEnemies(state, runtime);
  for (const enemy of state.enemies) {
    updateEnemy(enemy, state, dt);
    const dist = Math.hypot(enemy.x - state.ship.x, enemy.y - state.ship.y);
    if (dist < 22) {
      applyDamage(state, 6 * dt);
    }
  }

  for (const [id, time] of runtime.enemyReveal.entries()) {
    const remaining = time - dt;
    runtime.enemyReveal.set(id, remaining);
    const enemy = state.enemies.find((entry) => entry.id === id);
    if (enemy) {
      enemy.revealed = remaining > 0;
    }
    if (remaining <= 0) {
      runtime.enemyReveal.delete(id);
      if (enemy) enemy.revealed = false;
    }
  }

  runtime.nextUpgradeIn -= dt;
  if (runtime.nextUpgradeIn <= 0 && state.upgrades.length === 0) {
    state.upgrades.splice(0, state.upgrades.length);
    const options = [...upgradeData].sort(() => runtime.rng.next() - 0.5).slice(0, 3);
    for (const option of options) {
      const upgrade = new UpgradeOption();
      upgrade.id = option.id;
      upgrade.label = option.label;
      upgrade.seat = option.seat;
      state.upgrades.push(upgrade);
    }
    state.announcer = "Upgrade available";
  }

  if (state.ship.hp <= 0) {
    state.phase = "ended";
    state.announcer = "Ship destroyed";
  }

  if (state.timeElapsed > state.wave * 30) {
    state.wave += 1;
    state.announcer = `Wave ${state.wave}`;
  }
}

export function applyUpgrade(state: RoomState, runtime: RuntimeState, upgradeId: string): void {
  const upgrade = upgradeData.find((entry) => entry.id === upgradeId);
  if (!upgrade) return;
  runtime.upgradeModifiers[upgrade.id] = (runtime.upgradeModifiers[upgrade.id] ?? 1) + 0.1;
  state.upgrades.splice(0, state.upgrades.length);
  runtime.nextUpgradeIn = 25;
}
