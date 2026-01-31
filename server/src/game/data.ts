import { readFileSync } from "node:fs";
import path from "node:path";

function loadJson<T>(file: string): T {
  const fullPath = path.resolve(process.cwd(), "../shared/data", file);
  const raw = readFileSync(fullPath, "utf8");
  return JSON.parse(raw) as T;
}

export const weaponData = loadJson<
  {
    id: string;
    name: string;
    cooldownMs: number;
    range: number;
    damage: number;
    spread: number;
    pellets?: number;
  }[]
>("weapons.json");

export const enemyData = loadJson<{ id: string; hp: number; speed: number }[]>("enemies.json");

export const upgradeData = loadJson<{ id: string; label: string; seat: string }[]>(
  "upgrades.json"
);
