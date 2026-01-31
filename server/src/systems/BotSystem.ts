import type { SeatType, Vector2 } from '@htown/shared';
import type { GameRoom } from '../rooms/GameRoom';

export class BotSystem {
  constructor(private room: GameRoom) {}

  update() {
    const ship = this.room.state.ship;
    const enemies = this.room.state.enemies;
    const nearest = enemies[0];

    for (const seat of this.room.botSeats) {
      switch (seat) {
        case 'pilot': {
          const target = nearest?.position ?? { x: 0, y: 0 };
          const dir = normalize({ x: target.x - ship.position.x, y: target.y - ship.position.y });
          this.room.inputs.set('pilot', {
            seat: 'pilot',
            move: { x: -dir.x, y: -dir.y },
            boost: ship.health < 40
          });
          break;
        }
        case 'gunner': {
          const target = nearest?.position ?? { x: ship.position.x + 1, y: ship.position.y };
          const aim = normalize({ x: target.x - ship.position.x, y: target.y - ship.position.y });
          this.room.inputs.set('gunner', {
            seat: 'gunner',
            aim,
            fire: Boolean(nearest)
          });
          break;
        }
        case 'power': {
          const danger = ship.health < 60;
          this.room.inputs.set('power', {
            seat: 'power',
            power: {
              engines: danger ? 0.2 : 0.33,
              weapons: danger ? 0.3 : 0.4,
              shields: danger ? 0.5 : 0.27
            }
          });
          break;
        }
        case 'systems': {
          this.room.inputs.set('systems', {
            seat: 'systems',
            systems: { abilityIndex: enemies.length > 4 ? 1 : 0 }
          });
          break;
        }
        case 'support': {
          const action = ship.health < 70 ? 'repair' : enemies.length > 0 ? 'scan' : 'loot';
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
