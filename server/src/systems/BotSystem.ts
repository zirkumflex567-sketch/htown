import type { SeatType, Vector2 } from '@htown/shared';
import type { GameRoom } from '../rooms/GameRoom';

export class BotSystem {
  constructor(private room: GameRoom) {}

  update() {
    if (this.room.mode !== 'crew') return;
    const ship = this.room.state.ship;
    const enemies = this.room.state.enemies;
    const nearest = enemies[0];
    const now = this.room.simulationTime / 1000;
    const systems = this.room.state.systems;
    const support = this.room.state.support;
    const cluster = enemies.slice(0, 6);

    for (const seat of this.room.botSeats) {
      switch (seat) {
        case 'pilot': {
          const target = nearest?.position ?? { x: ship.position.x + 1, y: ship.position.y };
          const dir = normalize({ x: target.x - ship.position.x, y: target.y - ship.position.y });
          const crowd =
            cluster.reduce((acc, enemy) => acc + distance(enemy.position, ship.position), 0) /
            Math.max(1, cluster.length);
          const evasion = crowd < 60 ? { x: -dir.y, y: dir.x } : { x: -dir.x, y: -dir.y };
          this.room.inputs.set('pilot', {
            seat: 'pilot',
            move: {
              x: evasion.x * 0.6 + dir.x * 0.4,
              y: evasion.y * 0.6 + dir.y * 0.4
            },
            lift: 0,
            boost: ship.health < 40 || enemies.length > 6
          });
          break;
        }
        case 'gunner': {
          const target = nearest?.position ?? { x: ship.position.x + 1, y: ship.position.y };
          const lead = nearest?.velocity ? { x: target.x + nearest.velocity.x * 0.4, y: target.y + nearest.velocity.y * 0.4 } : target;
          const aim = normalize({ x: lead.x - ship.position.x, y: lead.y - ship.position.y });
          this.room.inputs.set('gunner', {
            seat: 'gunner',
            aim,
            fire: Boolean(nearest)
          });
          break;
        }
        case 'power': {
          const danger = ship.health < 55;
          const swarm = enemies.length > 6;
          this.room.inputs.set('power', {
            seat: 'power',
            powerPreset: danger ? 'defense' : swarm ? 'attack' : 'balanced',
            power: {
              engines: danger ? 0.2 : 0.33,
              weapons: swarm ? 0.45 : 0.33,
              shields: danger ? 0.5 : 0.34
            }
          });
          break;
        }
        case 'systems': {
          if (systems.empCooldown <= 0 && enemies.length > 5) {
            this.room.inputs.set('systems', { seat: 'systems', systems: { abilityIndex: 0 } });
            break;
          }
          if (systems.shieldCooldown <= 0 && ship.shield < 20) {
            this.room.inputs.set('systems', { seat: 'systems', systems: { abilityIndex: 1 } });
            break;
          }
          if (systems.slowCooldown <= 0 && enemies.length > 3) {
            this.room.inputs.set('systems', { seat: 'systems', systems: { abilityIndex: 2 } });
            break;
          }
          if (systems.overdriveCooldown <= 0 && now % 10 < 0.1) {
            this.room.inputs.set('systems', { seat: 'systems', systems: { abilityIndex: 3 } });
            break;
          }
          this.room.inputs.set('systems', {
            seat: 'systems',
            systems: { abilityIndex: enemies.length > 4 ? 1 : 0 }
          });
          break;
        }
        case 'support': {
          if (support.repairWindowEnd > 0 && now >= support.repairWindowStart && now <= support.repairWindowEnd) {
            this.room.inputs.set('support', { seat: 'support', support: { action: 'repair' } });
            break;
          }
          const action =
            ship.health < 60 && support.repairCooldown <= 0
              ? 'repair'
              : enemies.length > 0 && support.pingCooldown <= 0
                ? 'scan'
                : support.radarUntil <= 0
                  ? 'loot'
                  : 'scan';
          this.room.inputs.set('support', {
            seat: 'support',
            support: { action }
          });
          break;
        }
      }
    }
  }
}

function normalize(vec: Vector2): Vector2 {
  const len = Math.hypot(vec.x, vec.y) || 1;
  return { x: vec.x / len, y: vec.y / len };
}

function distance(a: Vector2, b: Vector2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
