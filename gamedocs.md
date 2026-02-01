# Game Documentation (Game-Ready)

> **Ziel**: Diese Dokumentation beschreibt **jedes Modul des Spiels einzeln und ausführlich**, so dass Design, Engineering und Art direkt damit arbeiten können. Grundlage ist ausschließlich `game_design.md`, hier in **konkrete, implementierbare Spezifikationen** übersetzt.

---

## 1) High Concept & Spielerfantasie

### 1.1 Pitch
Ein kooperativer, top-down Arena-Runner für 1–5 Spieler (Browser + Mobile PWA). Alle Spieler teilen sich **einen** Bildschirm und **ein** Schiff. Jede Person steuert eine **Station** (Pilot, Gunner, Power, Systems, Support). Der Twist: **Seat Swap** mischt Rollen regelmäßig durch, was Chaos, Humor und Skill-Expression erzeugt.

### 1.2 Zielgefühl
- *„Wir sind ein Körper“*: Jede Aktion beeinflusst alle.
- *„Wir kämpfen im Dunkeln“*: Sicht ist wertvoll, Information ist Macht.
- *„Chaos, aber fair“*: Swaps sind planbar, nicht unfair.

### 1.3 Unique Selling Points (USP)
- Gemeinsamer Screen mit vollständiger Crew-Konsole.
- Seat Swap als zentrales Gameplay- und Skill-Element.
- Run-basierte Progression ohne permanentes Power-Grinding.

---

## 2) Kern-Loop & Spielstruktur

### 2.1 Sekunde-zu-Sekunde (Moment-to-Moment)
**Input → Aktion → Feedback** in unter 1 Sekunde.
- Pilot bewegt das Schiff (Inertia/Arcade-Mix).
- Gunner schießt; VFX geben kurze Lichtblitze.
- Support scannt: Sichtbarkeits-Fenster.
- Power verteilt Energie: spürbare Änderung in Beschleunigung/Damage/Shields.
- Systems triggert aktive Fähigkeiten.

**Wichtig**: Alle Aktionen erzeugen **klar sichtbares Feedback** (Sound + VFX + UI).

### 2.2 Minute-zu-Minute (Wellenstruktur)
1. **Welle startet** → Druck steigt.
2. **Bewegung + Fokus-Feinde** → Teamkoordinierung.
3. **Drop/Upgrade** → kurze Entscheidung.
4. **Event-Trigger** → Risiko/Belohnung.

### 2.3 Run-zu-Run
- Prozedurale Arenen + randomisierte Upgrades.
- Score + Leaderboard als langfristige Motivation.
- Mastery durch Rollenverständnis, nicht durch Stats.

---

## 3) Gemeinsamer Bildschirm & UI-Layout (Modul: Shared Screen)

### 3.1 Layout-Prinzip
- **Alle Stationen gleichzeitig sichtbar**, als Panels.
- **Aktive Station** = interaktiv + visuell hervorgehoben.
- Nicht aktive Stationen = read-only, aber vollständig sichtbar.

### 3.2 Panel-Anforderungen
- Große Buttons / Slider (Touch-first, „fat finger safe“).
- **Immer sichtbar**: Ressourcen (Energie, HP, Shield, Score).
- **Kontext-Overlays**: Seat Swap Countdown, „Du bist jetzt …“.

### 3.3 UI-States
- **Normal**: aktive Station leuchtet, andere neutral.
- **Warning**: 3s Countdown + Sound + Blink.
- **Swap**: Panels „slide“, Labels wechseln, Tooltips erscheinen.
- **Grace**: klare visuelle Anzeige, damit Spieler wissen: „kurze Sicherheit“.

---

## 4) Stationen (Core Module) – Ausführliche Spezifikation

> **Prinzip**: Jede Station hat **klaren Job, eigenes UI, eigene Kernwerte** und **spezifisches Skill-Cap**. Swaps müssen auf 1–2 Sekunden „lesbar“ sein.

### 4.1 Seat 1 – Pilot (Movement)

**Ziel**: Positionierung & Survival. Pilot bestimmt Schwierigkeitsgrad des gesamten Runs.

**Inputs**
- Mobile: linker Touch-Stick + Boost-Button.
- Browser: WASD/Stick + Boost.

**UI-Module**
- **Steering-Ring** (Richtung + Trägheitsanzeige)
- **Boost-Cooldown** (Radial-Countdown)
- **Danger-Indicator** (Kollision + Incoming)

**Core-Mechaniken**
- **Inertia**: Schiff driftet, sofortiger Stop nicht möglich.
- **Boost**: kurzer Speed-Peak, dann Cooldown.
- **Kollision**: Schaden + Knockback → Pilot muss „Paths“ lesen.

**Skill & Timing**
- High-skill: enge Kurven, kontrollierte Boost-Ketten.
- Niedrige Skill-Fehler: Crash-Spikes, Fehlpositionierung.

**Swap-Hilfen**
- Autopilot hält Kurs 1–2 Sekunden.
- Steuerungslatenz minimal.

---

### 4.2 Seat 2 – Gunner (Weapons)

**Ziel**: DPS + Priorisierung + Crowd Control.

**Inputs**
- Aim: rechter Stick / Swipe-Aim.
- Fire: Button (Auto- oder semi).
- Weapon-Switch: Toggle.

**UI-Module**
- **Reticle** (Targeting-Feedback)
- **Ammo/Heat-Bar** (Overheat-Mechanik)
- **Weapon Selector** (Icon + Cooldown)
- **Marked Targets Highlight** (Synergie mit Support)

**Core-Mechaniken**
- **Overheat**: Dauerfeuer baut Hitze auf → Forced Cooldown.
- **Weapon Archetypes**: Single Target, AoE, Utility.
- **Target Priority**: Elites > Support-Chasers.

**Skill & Timing**
- Hohe Skill-Decke: Fokus-Feinde sofort eliminieren.
- Geringe Skill: Overheat-Phasen gefährlich.

**Swap-Hilfen**
- Aim Freeze für 1s, soft tracking auf aktuelle Richtung.

---

### 4.3 Seat 3 – Power (Energy Distribution)

**Ziel**: Energie-Budget zwischen Engines / Weapons / Shields.

**Inputs**
- 3 Slider + Preset Buttons (Attack / Defense / Speed).

**UI-Module**
- **Energy Budget** (Gesamtbudget + Verteilung)
- **Overheat Meter** (Weapon/Shield Risiken)
- **Shield Regen Indicator**
- **Engine Thrust Meter**

**Core-Mechaniken**
- **Budget-Limit**: Summe = 100%. Overdrive kurzfristig möglich.
- **Trade-offs**: mehr Engine = weniger Shields.
- **Presets**: One-Tap Rettung in Stresssituationen.

**Skill & Timing**
- High-skill: schnelle Anpassung an Boss-Phasen.
- Low-skill: Dauer-Fehlverteilung → Team stirbt.

**Swap-Hilfen**
- Preset auf „Balanced“ bei Swap.

---

### 4.4 Seat 4 – Systems (Active Abilities)

**Ziel**: Aktive Module & Cooldown-Management.

**Inputs**
- 3–4 große Ability-Buttons.

**UI-Module**
- **Ability Grid** (Icon + Cooldown)
- **Synergy Hint** (z. B. „best vs Flyers“)

**Core-Mechaniken**
- **EMP**: disables projectiles/enemy abilities.
- **Shield Burst**: instant Shield-Refill.
- **Slow Field**: Crowd Control.
- **Overdrive**: kurzzeitige DPS/Speed-Boosts.

**Skill & Timing**
- Gute Spieler halten Fähigkeiten für Boss-Windows.
- Schlechte Spieler verbrauchen CDs ohne Effekt.

**Swap-Hilfen**
- Aktive CDs deutlich sichtbar, Tooltips für neue Spieler.

---

### 4.5 Seat 5 – Support (Repair / Scanner / Utility)

**Ziel**: Sichtbarkeit & Stabilität.

**Inputs**
- Scan Ping
- Repair
- Utility (z. B. Loot Magnet)
- Radar Toggle

**UI-Module**
- **Minimap/Radar** (zeigt kurz Spawnrichtungen)
- **Ping Cooldown**
- **Repair Meter**
- **Team Status**

**Core-Mechaniken**
- **Scan Ping**: enthüllt Gegner 2–3 Sekunden.
- **Repair**: langsame Hull-Heal.
- **Utility**: Loot / Debuff-Cleanse.

**Skill & Timing**
- Support entscheidet „wann“ Sicht entsteht.
- Rettet Runs durch Timing bei Repairs.

**Swap-Hilfen**
- Buttons groß und farblich eindeutig.

---

## 5) Seat Swap System (Modul)

### 5.1 Ziele
- Chaos + Humor + Team-Neuordnung.
- Fairness: keine unfairen Todesmomente.

### 5.2 Ablauf
1. **Random Interval**: 45–90 Sekunden (Server autoritativ).
2. **Warnphase**: 3 Sekunden (Countdown + Flash + Sound).
3. **Swap**: Panels wechseln + Overlay „Du bist jetzt …“.
4. **Grace Phase**: 2 Sekunden Damage Reduction + Autostabilisierung.

### 5.3 Anti-Frust Regeln
- Kein Swap bei Instant-Kill-Spikes.
- Autopilot/Freeze für Rollenwechsel.

---

## 6) Upgrade-System (Modul)

### 6.1 Grundprinzip
Upgrades sind **Seat-gebunden**, nicht Spieler-gebunden.

### 6.2 Upgrade-Typen
- **Seat-Direct**: „Pilot +20% Turn Rate“.
- **Cross-Seat Synergy**:
  - Marked Targets nehmen +25% Damage.
  - Excess Weapon Energy → Shields.
- **Mutatoren**:
  - Swap Surge: Overdrive nach Swap.
  - Dark Pact: mehr Damage, weniger Vision.

### 6.3 Auswahl-Logik
- Nach Welle oder Timer: 3 Karten.
- Entweder Team-Entscheidung oder Seat-spezifische Drops.

### 6.4 Skalierung
- Upgrades skalieren absurd, Gegner skalieren entsprechend.

---

## 7) Enemy-System (Modul)

### 7.1 Grundregel
Jeder Gegner stresst mindestens eine Station.

### 7.2 Standard-Feinde
- **Chaser**: Pilot + Gunner Druck.
- **Runner**: Support muss markieren.
- **Spitter**: Power/Systems reagieren.

### 7.3 Elites
- **Shroud Elite**: nur sichtbar durch Ping.
- **Sapper Elite**: Minen legen (Pilot/Support reagieren).
- **Overheat Elite**: Waffen heiß → Power/Systems relevant.

---

## 8) Boss-System (Modul)

### 8.1 Boss-Philosophie
Boss = **Koop-Check**. Jede Station wird getestet.

### 8.2 Beispiel-Kern-Mechaniken
- Weakspots für Gunner.
- Positionierung für Pilot.
- Preset-Wechsel für Power.
- Burst-Windows für Systems.
- Adds/Sicht für Support.

---

## 9) Procedural World & Darkness (Modul)

### 9.1 Arena-Generator
- Modular: Tiles/Segmente.
- Enthält Spawnpoints, Obstacles, Risk Nodes.

### 9.2 Darkness
- Sichtkegel vom Schiff.
- Sichtblitze durch Schüsse, Explosionen, Ping.
- Darkness = „Informations-Mechanik“.

---

## 10) Meta-Systeme (Modul)

### 10.1 Login
- Email/Passwort
- JWT Token
- Persistierte Daten: Bestscore, Total Runs, Last Run, Cosmetic Flags.

### 10.2 Matchmaking
- Room Code + Quick Play
- Rejoin 30s

### 10.3 Leaderboard
- Top 50 global
- Filter nach Teamgröße

---

## 11) Tech-Architektur (Modul)

### 11.1 Client
- Phaser 3 + Vite + TypeScript.
- Rendering: Sprites + Particles + Darkness Overlay.
- Network: send inputs, receive snapshots, interpolate.

### 11.2 Server
- Node + Colyseus.
- Authoritative Simulation, Tick 20 Hz.
- RNG deterministisch pro Room.

### 11.3 Bots
- Server-side Seat-Behavior Trees.

### 11.4 Persistence
- SQLite dev, Postgres später.

---

## 12) Asset-Pipeline (Modul)

### 12.1 UI (9-Slice)
- Transparent PNGs
- Panels 2048×2048
- Buttons 1024×1024

### 12.2 VFX Sprite Sheets
- MuzzleFlash, Impact, Boost (8x8 @ 2048)

### 12.3 Gameplay Sprites
- Ship, Enemies, Projectiles

---

## 13) UX, Feedback & Accessibility (Modul)

### 13.1 Feedback
- Jede Aktion = Audio + VFX + UI-Farbfeedback.

### 13.2 Lesbarkeit
- Kontrastreiche Farben, große UI-Elemente.

### 13.3 Accessibility
- Farbblindenfreundlich, Audio-Cues visuell dupliziert.

---

## 14) Balancing & Tuning (Modul)

### 14.1 Variablen
- Swap-Intervalle
- Enemy Spawn Rates
- Power Distribution Impact
- Vision Radius

### 14.2 Zielkurve
- Anfang: kontrollierbar
- Mitte: koordinationsintensiv
- Ende: absurd-chaotisch

---

## 15) Definition of Done

✅ Website + PWA
✅ Login + Account Stats
✅ Room Code + 1–5 Spieler
✅ Bots für fehlende Seats
✅ Shared Screen
✅ Seat Swap fair
✅ Prozedurale Arena + Waves + Upgrades + Score
✅ Assets (9-slice + sprite sheets)

---

## 16) Offene Fragen

- Finales UI-Layout (Panel-Positionen)
- Exaktes Balancing (Swap-Intervall, Enemy Count)
- Art-Style / Farbpalette
- Audio-Konzept

