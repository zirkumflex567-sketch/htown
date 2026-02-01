export const nowIso = () => new Date().toISOString();

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
