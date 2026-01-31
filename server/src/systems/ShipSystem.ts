import type { GameRoom } from '../rooms/GameRoom';

export class ShipSystem {
  constructor(private room: GameRoom) {}

  update(delta: number) {
    const ship = this.room.state.ship;
    const pilotInput = this.room.inputs.get('pilot');
    const powerInput = this.room.inputs.get('power');

    if (powerInput?.power) {
      ship.energyEngines = powerInput.power.engines;
      ship.energyWeapons = powerInput.power.weapons;
      ship.energyShields = powerInput.power.shields;
    }

    const accel = 80 + ship.energyEngines * 80;
    if (pilotInput?.move) {
      ship.velocity.x += pilotInput.move.x * accel * delta;
      ship.velocity.y += pilotInput.move.y * accel * delta;
    }

    const speedLimit = pilotInput?.boost ? 220 : 160;
    const speed = Math.hypot(ship.velocity.x, ship.velocity.y);
    if (speed > speedLimit) {
      ship.velocity.x = (ship.velocity.x / speed) * speedLimit;
      ship.velocity.y = (ship.velocity.y / speed) * speedLimit;
    }

    ship.position.x += ship.velocity.x * delta;
    ship.position.y += ship.velocity.y * delta;

    ship.velocity.x *= 0.92;
    ship.velocity.y *= 0.92;

    ship.visionRadius = 140 + ship.energyShields * 80;
  }
}
