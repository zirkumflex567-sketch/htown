import { z } from 'zod';

export const SeatTypes = ['pilot', 'gunner', 'power', 'systems', 'support'] as const;
export type SeatType = (typeof SeatTypes)[number];

export type InputState = {
  seat: SeatType;
  axisX?: number;
  axisY?: number;
  boost?: boolean;
  fire?: boolean;
  aimX?: number;
  aimY?: number;
  weaponIndex?: number;
  powerDistribution?: {
    engines: number;
    weapons: number;
    shields: number;
  };
  abilities?: Record<string, boolean>;
  support?: {
    repair?: boolean;
    ping?: boolean;
    lootPulse?: boolean;
  };
};

export const AuthTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type AuthTokens = z.infer<typeof AuthTokenSchema>;

export type RoomSnapshot = {
  time: number;
  ship: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    hp: number;
    shields: number;
    heat: number;
  };
  enemies: Array<{ id: string; x: number; y: number; hp: number; type: string }>;
  projectiles: Array<{ id: string; x: number; y: number; vx: number; vy: number; ttl: number }>;
  score: number;
  wave: number;
  seatAssignments: Record<string, SeatType>;
  swap: { inCountdown: boolean; timeRemaining: number };
};

export { DeterministicRng } from './rng.js';
