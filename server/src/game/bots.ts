import type { RoomState, SeatType } from "@htown/shared";
import type { SeatInputs } from "./sim";

function findClosestEnemy(state: RoomState) {
  let closest = null as { x: number; y: number; dist: number } | null;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - state.ship.x, enemy.y - state.ship.y);
    if (!closest || dist < closest.dist) {
      closest = { x: enemy.x, y: enemy.y, dist };
    }
  }
  return closest;
}

function isBotSeat(state: RoomState, seatId: SeatType): boolean {
  const seat = state.seats.find((entry) => entry.seatId === seatId);
  return seat?.controller !== "player";
}

export function updateBots(state: RoomState, inputs: SeatInputs): void {
  const closest = findClosestEnemy(state);
  if (isBotSeat(state, "gunner")) {
    if (closest) {
      const dx = closest.x - state.ship.x;
      const dy = closest.y - state.ship.y;
      const len = Math.hypot(dx, dy) || 1;
      inputs.gunner.aimX = dx / len;
      inputs.gunner.aimY = dy / len;
      inputs.gunner.fire = closest.dist < 260;
    } else {
      inputs.gunner.fire = false;
    }
  }

  if (isBotSeat(state, "pilot")) {
    if (closest && closest.dist < 140) {
      inputs.pilot.x = -inputs.gunner.aimX;
      inputs.pilot.y = -inputs.gunner.aimY;
      inputs.pilot.boost = true;
    } else {
      inputs.pilot.x = inputs.gunner.aimX;
      inputs.pilot.y = inputs.gunner.aimY;
      inputs.pilot.boost = false;
    }
  }

  if (isBotSeat(state, "power")) {
    const shieldRatio = state.ship.shield / 80;
    if (shieldRatio < 0.3) {
      inputs.power.shields = 0.5;
      inputs.power.engines = 0.25;
      inputs.power.weapons = 0.25;
    } else if (state.enemies.length > 10) {
      inputs.power.weapons = 0.5;
      inputs.power.engines = 0.3;
      inputs.power.shields = 0.2;
    } else {
      inputs.power.engines = 0.34;
      inputs.power.weapons = 0.33;
      inputs.power.shields = 0.33;
    }
  }

  if (isBotSeat(state, "systems")) {
    inputs.systems.ability = state.enemies.length > 8 ? 0 : -1;
  }

  if (isBotSeat(state, "support")) {
    inputs.support.repair = state.ship.hp < 70;
    inputs.support.scan = state.enemies.length > 6;
    inputs.support.loot = state.enemies.length === 0;
  }
}
