export class DeterministicRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0xffffffff;
  }

  nextRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  pick<T>(list: T[]): T {
    return list[Math.floor(this.nextRange(0, list.length))];
  }
}
