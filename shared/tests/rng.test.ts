import { describe, expect, it } from "vitest";
import { SeededRng } from "../src/rng";

describe("SeededRng", () => {
  it("produces deterministic sequence", () => {
    const a = new SeededRng(1234);
    const b = new SeededRng(1234);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
});
