import { Room, Client } from '@colyseus/core';
import { GameState, PlayerState } from './schema/GameState';
import { mulberry32, weapons as weaponDefs, upgrades as upgradeDefs } from '@htown/shared';
import type { PlayerInput, SeatType } from '@htown/shared';
import { SeatSystem } from '../systems/SeatSystem';
import { BotSystem } from '../systems/BotSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { ShipSystem } from '../systems/ShipSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { updateRunStats } from '../db';

export class GameRoom extends Room<GameState> {
  state = new GameState();
  inputs = new Map<SeatType, PlayerInput>();
  rng = mulberry32(Math.floor(Math.random() * 999999));
  simulationTime = 0;
  damageReduction = 1;
  swapGraceUntil = 0;
  botSeats = new Set<SeatType>();

  private seatSystem = new SeatSystem(this);
  private botSystem = new BotSystem(this);
  private enemySystem = new EnemySystem(this);
  private shipSystem = new ShipSystem(this);
  private upgradeSystem = new UpgradeSystem(this);
  private lastFireAt = new Map<string, number>();
  private sessionToPlayer = new Map<string, string>();

  onCreate() {
    this.setState(this.state);
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);

    this.onMessage('input', (client, input: PlayerInput) => {
      this.inputs.set(input.seat, input);
    });

    this.onMessage('upgrade', (client, upgradeId: string) => {
      const upgrade = upgradeDefs.find((entry) => entry.id === upgradeId);
      if (!upgrade) return;
      this.applyUpgrade(upgradeId);
      this.state.upgradeChoices.clear();
    });
  }

  onJoin(client: Client, options: { userId?: string }) {
    const playerId = options.userId ?? client.sessionId;
    let player = this.state.players.get(playerId);
    if (!player) {
      player = new PlayerState();
      player.id = playerId;
      player.seat = this.seatSystem.assignSeat(playerId);
      player.isBot = false;
      player.connected = true;
      this.state.players.set(playerId, player);
    } else {
      player.connected = true;
    }
    this.sessionToPlayer.set(client.sessionId, playerId);
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
        this.refreshBots();
      }, 30000);
    }
  }

  update(deltaTime: number) {
    const delta = deltaTime / 1000;
    this.simulationTime += deltaTime;
    this.state.timeSurvived += delta;
    this.state.score += Math.floor(delta * 2 + this.state.enemies.length * 0.2);

    this.seatSystem.tick(deltaTime);
    this.botSystem.update();
    this.shipSystem.update(delta);
    this.enemySystem.update(delta);
    this.upgradeSystem.update(delta);
    this.handleCombat(deltaTime);

    if (this.state.ship.health <= 0) {
      this.broadcast('gameover', { score: this.state.score });
      this.saveScores();
      this.state.ship.health = 100;
      this.state.score = 0;
      this.state.wave = 1;
      this.state.timeSurvived = 0;
      this.state.enemies.clear();
    }
  }

  handleCombat(deltaTime: number) {
    const gunnerInput = this.inputs.get('gunner');
    if (!gunnerInput?.fire) return;
    const weaponIndex = gunnerInput.weaponIndex ?? 0;
    const weapon = weaponDefs[Math.min(weaponIndex, weaponDefs.length - 1)];
    const now = this.simulationTime;
    const key = `gunner-${weapon.id}`;
    const last = this.lastFireAt.get(key) ?? 0;
    if (now - last < weapon.cooldownMs) return;
    this.lastFireAt.set(key, now);

    const aim = gunnerInput.aim ?? { x: 1, y: 0 };
    const ship = this.state.ship;
    const target = this.state.enemies
      .filter((enemy) => distance(ship.position.x, ship.position.y, enemy.position.x, enemy.position.y) <= weapon.range)
      .sort((a, b) => {
        const da = distance(ship.position.x, ship.position.y, a.position.x, a.position.y);
        const db = distance(ship.position.x, ship.position.y, b.position.x, b.position.y);
        return da - db;
      })[0];

    if (target) {
      target.health -= weapon.damage * (1 + ship.energyWeapons * 0.5);
      if (target.health <= 0) {
        this.state.score += 25;
      }
    }
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

  damageShip(amount: number) {
    const ship = this.state.ship;
    const shieldHit = Math.min(ship.shield, amount * ship.energyShields);
    ship.shield = Math.max(ship.shield - shieldHit, 0);
    ship.health = Math.max(ship.health - (amount - shieldHit), 0);
  }

  applyUpgrade(upgradeId: string) {
    const upgrade = upgradeDefs.find((entry) => entry.id === upgradeId);
    if (!upgrade) return;
    const ship = this.state.ship;
    if (upgrade.effect.type === 'damage') {
      ship.energyWeapons += upgrade.effect.value;
    }
    if (upgrade.effect.type === 'speed') {
      ship.energyEngines += upgrade.effect.value;
    }
    if (upgrade.effect.type === 'shield') {
      ship.energyShields += upgrade.effect.value;
    }
    if (upgrade.effect.type === 'vision') {
      ship.visionRadius += upgrade.effect.value * 100;
    }
  }

  saveScores() {
    for (const player of this.state.players.values()) {
      if (player.isBot) continue;
      updateRunStats(player.id, this.state.score, JSON.stringify({ wave: this.state.wave, time: this.state.timeSurvived }));
    }
  }
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}
