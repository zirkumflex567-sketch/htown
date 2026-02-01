import type { PlayerInput } from '@htown/shared';
import { clampToCave } from '@htown/shared';
import type { GameRoom } from '../rooms/GameRoom';
import type { ShipState } from '../rooms/schema/GameState';

export class ShipSystem {
  constructor(private room: GameRoom) {}

  update(delta: number) {
    this.updateShip(delta, this.room.state.ship, this.room.inputs.get('pilot'), this.room.inputs.get('power'), {
      assistActive: this.room.stabilizerUntil > this.room.simulationTime,
      lastPilotMove: this.room.lastPilotMove,
      lastWallHitAt: this.room.lastWallHit,
      setLastWallHitAt: (value) => {
        this.room.lastWallHit = value;
      },
      onWallHit: (amount) => this.room.damageShip(amount)
    });
  }

  updateShip(
    delta: number,
    ship: ShipState,
    pilotInput: PlayerInput | undefined,
    powerInput: PlayerInput | undefined,
    context: {
      assistActive: boolean;
      lastPilotMove: { x: number; y: number };
      lastWallHitAt: number;
      setLastWallHitAt: (value: number) => void;
      onWallHit: (amount: number) => void;
    }
  ) {
    const assistActive = context.assistActive;
    const now = this.room.simulationTime / 1000;

    const prevTarget = {
      engines: ship.powerTargetEngines,
      weapons: ship.powerTargetWeapons,
      shields: ship.powerTargetShields
    };
    let target = { ...prevTarget };
    if (powerInput?.powerPreset) {
      switch (powerInput.powerPreset) {
        case 'attack':
          target = { engines: 0.2, weapons: 0.5, shields: 0.3 };
          break;
        case 'defense':
          target = { engines: 0.2, weapons: 0.2, shields: 0.6 };
          break;
        case 'speed':
          target = { engines: 0.5, weapons: 0.3, shields: 0.2 };
          break;
        default:
          target = { engines: 0.33, weapons: 0.33, shields: 0.34 };
          break;
      }
    } else if (powerInput?.power) {
      target = {
        engines: powerInput.power.engines,
        weapons: powerInput.power.weapons,
        shields: powerInput.power.shields
      };
    } else if (assistActive) {
      target = { engines: 0.33, weapons: 0.33, shields: 0.34 };
    }
    target = normalizePower(target);
    const targetChange =
      Math.abs(target.engines - prevTarget.engines) +
      Math.abs(target.weapons - prevTarget.weapons) +
      Math.abs(target.shields - prevTarget.shields);
    const significantShift = !assistActive && targetChange > 0.12;

    if (significantShift) {
      const windowActive =
        ship.powerWindowEnd > 0 && now >= ship.powerWindowStart && now <= ship.powerWindowEnd;
      if (windowActive) {
        ship.powerPerfectUntil = now + 1.2;
        ship.powerInstability = Math.max(0, ship.powerInstability - 0.25);
        ship.powerHeat = Math.max(0, ship.powerHeat - 0.2);
        ship.powerWindowStart = 0;
        ship.powerWindowEnd = 0;
        ship.powerWindowType = '';
      } else {
        ship.powerWindowStart = now + 0.12;
        ship.powerWindowEnd = now + 0.5;
        ship.powerWindowType = powerInput?.powerPreset ? 'preset' : 'manual';
      }
      ship.powerInstability = Math.min(1.5, ship.powerInstability + targetChange * 0.5);
      ship.powerHeat = Math.min(1.6, ship.powerHeat + targetChange * 0.7);
    }

    if (ship.powerWindowEnd > 0 && now > ship.powerWindowEnd) {
      if (ship.powerPerfectUntil < now) {
        ship.powerInstability = Math.min(1.6, ship.powerInstability + 0.2);
      }
      ship.powerWindowStart = 0;
      ship.powerWindowEnd = 0;
      ship.powerWindowType = '';
    }

    ship.powerInstability = Math.max(0, ship.powerInstability - delta * 0.22);
    ship.powerHeat = Math.max(0, ship.powerHeat - delta * 0.28);
    if (ship.powerHeat > 1.2 || ship.powerInstability > 1.1) {
      ship.powerOverloadUntil = Math.max(ship.powerOverloadUntil, now + 1.8);
    }

    ship.powerTargetEngines = target.engines;
    ship.powerTargetWeapons = target.weapons;
    ship.powerTargetShields = target.shields;
    const overloadActive = ship.powerOverloadUntil > now;
    const response = Math.max(1.2, 4 - ship.powerInstability * 1.8 - (overloadActive ? 1.2 : 0));
    const blend = Math.min(1, delta * response);
    ship.energyEngines += (ship.powerTargetEngines - ship.energyEngines) * blend;
    ship.energyWeapons += (ship.powerTargetWeapons - ship.energyWeapons) * blend;
    ship.energyShields += (ship.powerTargetShields - ship.energyShields) * blend;
    ship.energyEngines = clamp01(ship.energyEngines);
    ship.energyWeapons = clamp01(ship.energyWeapons);
    ship.energyShields = clamp01(ship.energyShields);

    const pilotSpeedBonus = this.room.seatBonuses?.pilot?.speed ?? 0;
    const powerPerfect = ship.powerPerfectUntil > now;
    const powerBonus = powerPerfect ? 0.06 : 0;
    const overloadPenalty = overloadActive ? 0.1 : 0;
    const effectiveEngines = clamp01(ship.energyEngines + powerBonus - overloadPenalty);
    const effectiveShields = clamp01(ship.energyShields + powerBonus - overloadPenalty);
    const effectiveWeapons = clamp01(ship.energyWeapons + (powerPerfect ? 0.04 : 0) - overloadPenalty);
    const comboSpeed = ship.comboSpeedUntil > now ? 1.25 : 1;
    const accel = (18 + effectiveEngines * 30 + pilotSpeedBonus * 25) * comboSpeed;
    let moveX = pilotInput?.move?.x ?? 0;
    let moveY = pilotInput?.move?.y ?? 0;
    const liftInput = Math.max(-1, Math.min(1, pilotInput?.lift ?? 0));
    if (assistActive) {
      moveX = context.lastPilotMove.x * 0.7 + moveX * 0.3;
      moveY = context.lastPilotMove.y * 0.7 + moveY * 0.3;
      const maxSteer = 0.6;
      moveX = Math.max(-maxSteer, Math.min(maxSteer, moveX));
    }
    const inputActive = Math.hypot(moveX, moveY) > 0.05 || Math.abs(liftInput) > 0.05;
    ship.velocity.x += moveX * accel * delta;
    ship.velocity.y += moveY * accel * delta;
    const verticalAccel = (12 + effectiveEngines * 22 + pilotSpeedBonus * 12) * comboSpeed;
    ship.velocity.z += liftInput * verticalAccel * delta;

    const speedLimit = pilotInput?.boost
      ? (80 + effectiveEngines * 40 + pilotSpeedBonus * 40) * comboSpeed
      : (55 + effectiveEngines * 35 + pilotSpeedBonus * 30) * comboSpeed;
    const speed = Math.hypot(ship.velocity.x, ship.velocity.y, ship.velocity.z);
    if (speed > speedLimit) {
      ship.velocity.x = (ship.velocity.x / speed) * speedLimit;
      ship.velocity.y = (ship.velocity.y / speed) * speedLimit;
      ship.velocity.z = (ship.velocity.z / speed) * speedLimit;
    }

    ship.position.x += ship.velocity.x * delta;
    ship.position.y += ship.velocity.y * delta;
    ship.position.z += ship.velocity.z * delta;

    ship.velocity.x *= 0.92;
    ship.velocity.y *= 0.92;
    ship.velocity.z *= 0.9;

    const clamp = clampToCave(ship.position.x, ship.position.y, ship.position.z, 1);
    if (clamp.outside) {
      ship.position.x = clamp.x;
      ship.position.y = clamp.y;
      ship.position.z = clamp.z;
      const tangentDot = ship.velocity.x * clamp.tangentX + ship.velocity.y * clamp.tangentY;
      ship.velocity.x = clamp.tangentX * tangentDot * 0.65;
      ship.velocity.y = clamp.tangentY * tangentDot * 0.65;
      ship.velocity.z *= 0.35;
      if (this.room.simulationTime - context.lastWallHitAt > 400) {
        context.onWallHit(2);
        context.setLastWallHitAt(this.room.simulationTime);
      }
    }
    if (clamp.outside && inputActive) {
      const speedAfterClamp = Math.hypot(ship.velocity.x, ship.velocity.y, ship.velocity.z);
      if (speedAfterClamp < 6) {
        const nudge = 18;
        ship.velocity.x += clamp.tangentX * nudge;
        ship.velocity.y += clamp.tangentY * nudge;
      }
    }

    if (Math.hypot(ship.velocity.x, ship.velocity.y) > 0.01) {
      ship.heading = Math.atan2(ship.velocity.x, ship.velocity.y);
    }

    const supportVision = this.room.seatBonuses?.support?.vision ?? 0;
    ship.visionRadius = 190 + effectiveShields * 110 + supportVision * 170;
    const powerShieldBonus = this.room.seatBonuses?.power?.shield ?? 0;
    const maxShield = 50 + effectiveShields * 90 + powerShieldBonus * 60;
    const regen = 4 + effectiveShields * 8 + powerShieldBonus * 6 + Math.max(0, effectiveWeapons - 0.4) * 6;
    ship.shield = Math.min(maxShield, ship.shield + regen * delta);
    if (ship.hullRegenUntil > now) {
      ship.health = Math.min(100, ship.health + (6 + effectiveShields * 6) * delta);
    }
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizePower(target: { engines: number; weapons: number; shields: number }) {
  const sum = target.engines + target.weapons + target.shields;
  if (sum <= 0.01) return { engines: 0.33, weapons: 0.33, shields: 0.34 };
  return {
    engines: target.engines / sum,
    weapons: target.weapons / sum,
    shields: target.shields / sum
  };
}
