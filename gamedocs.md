# HTOWN Crew — IST-Dokumentation (2026-02-01)

Diese Datei beschreibt den **aktuellen Ist-Zustand** des Projekts, nicht die Wunschliste.

## 1) Projektstatus (Kurzfassung)
- **Aktueller Kernmodus:** Crew-Coop auf **einem gemeinsamen Vehicle** mit 1–5 Seats (Pilot, Gunner, Power, Systems, Support).
- **Solo-Ship Mode:** **1 Spieler = 1 Vehicle**, bis zu 5 Spieler pro Karte, reduzierte Stationslogik (Pilot + Gunner).
- **Single-Modus:** 1 Client, Pilot + Gunner Input, keine Bots.

## 2) Repo-Struktur (IST)
- `client/` — Vite + Three.js Client, monolithisch in `client/src/main.ts`.
- `server/` — Node + Colyseus + Express (Auth/Leaderboard/Matchmaking), Tick-Simulation.
- `shared/` — gemeinsame Typen + JSON-Daten (Weapons, Enemies, Upgrades, StatusEffects, Combos).
- `tests/e2e/` — Playwright UI/Visual-Smoke Tests.
- `server/src/tests/` + `shared/src/tests/` — Vitest Unit/Integration Tests.
- `assets/`, `client/public/assets/` — 3D/Audio Assets.

## 3) Laufzeit-Modi (IST)
- **crew (Standard):**
  - `maxClients = 5`
  - 1 gemeinsames Ship, 5 Seats
  - Bots füllen fehlende Seats
  - Seat-Swap aktiv
- **solo (Solo-Ship):**
  - `maxClients = 5`
  - 1 Ship pro Spieler (`state.ships`)
  - Seat immer `pilot` (Pilot + Gunner Input pro Client)
  - Bots deaktiviert
  - Seat-Swap deaktiviert
- **single:**
  - `maxClients = 1`
  - Seat immer `pilot` (Pilot + Gunner Input)
  - Bots deaktiviert
  - Seat-Swap deaktiviert

## 4) Client-Architektur (IST)
**Datei:** `client/src/main.ts`
- **Rendering:** Three.js (GLTFLoader, Lights, Sprites, Partikel-Sparks, Reticle, Radar, Minimap).
- **Scene:**
  - Ship, Enemies, Projectiles, Powerups, Stars, Cave-Umgebung (Clamp via `shared/caveMap`).
- **Input & Controls:**
  - Keyboard + Mouse, Gamepad, Touch-Sticks.
  - Local input wird **sofort gerendert** (Smoothing) und gleichzeitig an Server gesendet.
  - Gunner nutzt Pointer Lock + Aim-Vector.
- **Networking:**
  - Colyseus Client (`joinOrCreate`, `joinById`), State Sync via Schema-Patches.
  - Client sendet nur Inputs; Server ist authoritative.
- **UI/HUD:**
  - Overlay (Login/Matchmaking), Seat-Panel, Crew-Overview, Debug/Settings/Stats.
  - Seat-Fokus + Crew-Overview (70/30 Ziel, praktisch umgesetzt).

**Mismatch zur README:** Client nutzt **Three.js**, nicht Phaser.

## 5) Server-Architektur (IST)
**Dateien:**
- `server/src/index.ts` — Express API + Colyseus.
- `server/src/rooms/GameRoom.ts` — authoritative Simulation + Tick (20Hz).
- `server/src/systems/*` — Seat/Bot/Enemy/Ship/Upgrade.
- `server/src/db.ts` — SQLite Persistence.

**API (Express):**
- Auth: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`.
- Leaderboard: `/leaderboard/top`, `/leaderboard/me`.
- Matchmake (Code): `/matchmake/create`, `/matchmake/join`.

**Colyseus Room:**
- `GameRoom` mit Schema-`GameState`.
- `GameState`: `mode`, `ship` (crew/single), `ships` (solo).
- Tick: `setSimulationInterval(..., 50)` → ~20 Hz.
- **Authoritative Systems:** Ship, Enemies, Projectiles, Upgrades, Combos, Seats, Bots.
- **Seat Swap:** Warnung + Grace + Stabilizer.
- **Bots:** Einfache Heuristik (Prototyp-Qualität).

## 6) Geteilte Datenmodelle (IST)
**Dateien:** `shared/src/types.ts`, `shared/src/data/*.json`
- `SeatType`: pilot/gunner/power/systems/support.
- `GameMode`: crew/solo/single.
- `PlayerInput`: Input-Payload (move/aim/power/systems/support).
- `weapons.json`, `enemies.json`, `upgrades.json`, `statusEffects.json`, `combos.json`.
- `caveMap.ts`: fixe Cave-Route + `clampToCave` (keine Prozeduralität).

## 7) Systeme-Übersicht (IST + Status)
**Client-Systeme**
- Rendering (Three.js Scene, GLTF Assets): **vollständig**
- Seat-UI & Crew-Overview: **vollständig**
- Radar/Minimap: **vollständig**
- Input (KB/Maus/Gamepad/Touch): **vollständig**
- SFX/FX (Sparks, Flashes, Reticle): **vollständig**
- Login/Matchmaking UI: **vollständig**
- Debug/Settings/Stats Overlay: **vollständig**

**Server-Systeme**
- Room Lifecycle + Tick: **vollständig**
- Solo-Ship Multi-Vehicle State + Targeting: **teilweise (Pilot + Gunner)**
- Seat System (Zuweisung + Swap): **vollständig**
- Bot System: **prototypisch**
- Ship Movement + Power Rhythm: **vollständig**
- Enemy Spawns + AI: **prototypisch, funktionsfähig**
- Projectile System: **vollständig**
- Upgrades (Seat-bound + Auto-Pick): **vollständig**
- Combos (server-auth, data-driven): **vollständig**
- Support/Systems Abilities: **vollständig**
- Persistence (SQLite): **vollständig (basic)**

**Stubs / fehlend**
- Solo-Ship: **keine per-Ship Systems/Support/Combos** (reduced stations)
- Prozedurale Level/ Biome-Rotation: **fehlend** (aktuell fixe Cave-Route)
- Reconnect-Flow (Token-basierte Room-Rejoin): **teilweise**
- Anti-Cheat / Input-Rate-Limits: **teilweise**

## 8) Implizite Annahmen (IST)
- **Crew/Single:** Ein einziges gemeinsames Ship pro Room.
- **Solo:** Ship pro Player, Seat-Zuordnung bleibt `pilot`.
- **Maximal 5 Seats** (hardcoded).
- **Bots** übernehmen freie Seats.
- **Input Payload enthält Seat** und wird serverseitig akzeptiert (jetzt geprüft).
- **Client-UI ist seat-zentriert**, keine globale Spectator-UI.
- **Assets/Gameplay** stark auf 3D/Three.js ausgelegt.

## 9) Multiplayer-Readiness (IST)
**Room Lifecycle**
- Create: `/matchmake/create` (Auth) oder `joinOrCreate` (Quick Play).
- Join: `/matchmake/join` → `joinById`.
- Join validiert AccessToken serverseitig (`onAuth`).
- Leave: `onLeave` markiert Player `connected=false`, Bots füllen.
- Dispose: Colyseus Auto-Dispose (kein explizites `onDispose`).

**State Sync**
- ~20 Hz server tick; Colyseus patch-basierte State Sync.
- **Payload wächst** mit Enemy/Projectile Count (keine Interest-Management).

**Input Flow**
- Client sendet `input` → Server prüft Seat-Zuordnung (Solo: Pilot/Gunner pro Spieler) → Tick verarbeitet.

**Late Join**
- Möglich: neuer Client erhält aktuelle State-Snapshot.

**Disconnect / Reconnect**
- Disconnect → Player bleibt 30s im State, Bots übernehmen Seat.
- Rejoin möglich, aber **kein automatischer Reconnect-Token**.

**Race Conditions / Limits**
- Max Clients = 5 (crew/solo) / 1 (single).
- Seat-Swap kann bei `lockSeat` (nur E2E) theoretisch Seat-Kollisionen erzeugen.

## 10) UI/UX Audit (IST)
**Global UI**
- Header: Seat, Score, Wave, Timer, Input Debug.
- Overlays: Login/Matchmaking, Settings, Stats, Debug.

**Seat-spezifisch**
- Pilot: Stick, Boost, Aim toggle, Speed/HB.
- Gunner: Aim stick, Fire, Weapon select, Reticle.
- Power: Sliders + Presets + Instability/Heat/Timing.
- Systems: Ability buttons + Mode readout.
- Support: Scan/Repair/Loot + Radar/Repair Window.

**Auffälligkeiten**
- UI ist funktionsreich, aber stark "Debug-lastig" (Input-State, Key-State, Debug-FAB).
- Crew-Overview ist dicht; gute 70/30-Trennung, aber viele Mikrotexte.
- Keine Trennung zwischen "Core HUD" und "Erweiterungs-UI" (z.B. Upgrades vs. Core).
- Solo-Ship zeigt Allies als einfache Platzhalter + Minimap-Dots; Seat-UI bleibt crew-zentriert.

**Empfehlungen (keine Redesigns)**
- Debug-Anzeigen per Flag (prod vs dev) trennen.
- Core HUD + Erweiterungen (Upgrades/Stats/Settings) klarer isolieren.
- Seat-UI vorbereitet lassen für spätere Seat-spezifische HUD-Skins.

## 11) Tests & Dev-Ergonomie (IST)
**Vorhanden**
- Unit-Tests: `server/src/tests/*` (Combos, Seats, Simulation, EnemySystem, etc.)
- Shared Tests: `shared/src/tests/*`
- Server-Join-Test: `server/src/tests/roomJoin.test.ts` (5 Clients, Solo-Ship, shipCount=5)
- E2E (Playwright): Login, Seat UI, Visual Snapshots, Multiplayer 2-Client.

**Lücken / dringend**
- Kein Browser-Test für **5 reale Clients** gleichzeitig (nur serverseitig).
- Kein Reconnect-Test (Drop + Rejoin).
- Kein Load-Test für große Enemy/Projectile-Counts.

**Minimaler Test-Plan (empfohlen)**
- **Room Join (5 Clients):** Server-Join-Test (`roomJoin.test.ts`), `shipCount=5`.
- **Movement Sync:** Pilot bewegt → andere Clients sehen Positionsänderung.
- **Disconnect/Reconnect:** Client verlässt → Bot übernimmt → Rejoin mit gleichem UserId.

## 12) Bekannte Risiken (IST)
- **Solo-Ship reduziert:** keine per-Ship Systems/Support/Combos; Shared `systems`-State bleibt crew-orientiert.
- **State Payload** wächst linear mit Enemy/Projectile Count (kein Interest Management).
- **Reconnect** ist manuell; kein Token/Auto-Rejoin.
- **README** nennt Phaser, Realität ist Three.js.

## 12a) Fun-Kill Leitplanken (verankert)
Quelle: `funkill.md` (Design-Guardrails, verbindlich fuer Reviews)
- Pflicht-Perfektion ist tabu: Systeme muessen optional optimieren, nie ueberleben erzwingen.
- UI muss in <0.5s begreifbar sein (Icons, Farben, Feedback) statt Zahlenwaende.
- Fehler duerfen ineffizient sein, aber nie destruktiv (keine Guilt-Mechaniken).
- Meta-Dominanz vermeiden: Sidegrades + Situationsstaerke statt linearer Power.
- Keine Progression, die Skill ersetzt; Run-Start ist gleich, Power kommt aus Entscheidungen.
- Chaos braucht Lesbarkeit (klare Ursache/Wirkung, kurze Combo-Feedbacks).
- Systeme muessen Teamplay aktivieren, nicht ersetzen; Bots sind inferior.
- Neue Systeme nur mit Eskalationskurve; muessen viele neue Spielsituationen erzeugen.

## 13) Design-Alignment (Kurz)
- Crew-Coop, Seat-Swap, Combos, Run-Endlos, Bots, Server-Auth → **im Code vorhanden**.
- Solo-Ship (pro Spieler ein Vehicle) → **vorhanden (Baseline, reduced stations)**.
- Prozedurale Biome/Events → **nicht vorhanden**.

---

Dieses Dokument wird bei Architekturänderungen aktualisiert.
