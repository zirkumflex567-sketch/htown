import { describe, expect, it } from "vitest";
import { RoomState } from "@htown/shared";
import { createDefaultInputs, createRuntime, updateSimulation } from "../src/game/sim";

function createState(): RoomState {
  const state = new RoomState();
  state.phase = "running";
  state.ship.x = 0;
  state.ship.y = 0;
  return state;
}

describe("simulation", () => {
  it("advances tick and spawns enemies", () => {
    const state = createState();
    const runtime = createRuntime(42);
    const inputs = createDefaultInputs();
    inputs.pilot.x = 1;
    inputs.pilot.y = 0;
    updateSimulation(state, runtime, inputs, 0.05);
    expect(state.tick).toBeGreaterThan(0);
    expect(state.enemies.length).toBeGreaterThan(0);
    expect(state.ship.x).not.toBe(0);
  });
});
