# Prompt 0 — Arbeitsmodus & Repo-Scan (3D + Chase Cam)

```text
Du bist ein Senior Game/Netcode Engineer. Arbeite in diesem Repository.

Ziel: Multiplayer Co-op Roguelite mit 5 Stationen (Pilot/Gunner/Power/Systems/Support), Seat-Swap, Waves, Enemies, Upgrades, Bots, Settings.
WICHTIG: Das Spiel ist 3D mit Vehicle (Fahrzeug) und Third-Person Chase Camera (Spring Arm / Follow Cam).

Regeln:
1) Lies zuerst README + scanne Ordnerstruktur (Client/Server). Finde: Rendering Stack (three.js/babylon/phaser3d/etc.), Scenes/World, Colyseus Room/Schema.
2) Keine Halluzinationen: wenn etwas fehlt, suche im Repo, dann entscheide.
3) Änderungen klein, TypeScript, build-fähig.
4) Server autoritativ: Clients senden Inputs; Server simuliert Vehicle + Combat; broadcastet Snapshots.
5) Nach jeder Änderung: `pnpm dev` muss laufen und Client laden. Falls Tests existieren: `pnpm test`.
Liefer am Ende: geänderte Dateien + manuelle Testschritte.
```
