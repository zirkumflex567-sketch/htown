Alles klar — hier kommt wieder eine ausführliche, “mit Herzblut” Beschreibung wie vorher, aber jetzt komplett auf Mobile + Browser (PWA/Web-App), ohne Unity, mit Login, Online-Coop 1–5, Bots, ein gemeinsamer Bildschirm mit allen Stationen gleichzeitig, plus Asset-Generierung (9-Slice + Sprite-Sheets).

---

Game Design Dokument (Browser/Mobile-PWA)

1) High Concept Pitch

Stell dir vor, du und bis zu vier andere Leute sitzen zusammen an einem einzigen Fahrzeug/Schiff, das sich wie ein gemeinsamer Körper anfühlt: jede Bewegung, jeder Treffer, jeder Boost ist Teamarbeit — aber nicht im “jeder hat sein eigenes Ding”-Coop, sondern im “wir teilen uns ein Gehirn”-Coop.

Die Welt ist dunkel, feindlich, prozedural, und ihr kämpft euch “an Gegnern entlang” durch Wellen, Events und Boss-Spikes. Das Spiel ist ein Endlos-Run: Es wird immer brutaler, die Upgrades werden immer absurder, und euer Score wird zur Trophäe.

Der Twist: In zufälligen Momenten werden die Rollen/Stationen zwangsweise durchgemischt. Das ist nicht nur Chaos — das ist das Herz: Du musst alles können, du musst lernen, dich blitzschnell umzustellen, du musst kommunizieren. Und genau daraus entstehen die besten Geschichten: “Ich war Gunner, dann plötzlich Pilot, dann Power — und das Ding hat trotzdem überlebt.”

Gefühl/Fantasie:

Team vs. Finsternis
Improvisation unter Druck
Skill wächst nicht durch Grinden, sondern durch gemeinsame Routine im Chaos
Die beste Art von Panik: die, über die man danach lacht

---

2) Kern-Loop

Sekunde-zu-Sekunde

Das Schiff bewegt sich inertia/arcade durch eine top-down Arena.

Gegner kommen in Wellen aus dem Dunkel, sichtbar durch:

- euren Lichtkegel / Ship-Glow
- Trefferblitze / Mündungsfeuer
- Scanner-Pings

Spieler drücken nicht “irgendwelche Skills”, sondern bedienen Stationen: Pilot lenkt, Gunner schießt, Power verteilt Energie, Systems zündet Fähigkeiten, Support scannt/repariert/utility.

Entscheidungen sind mikro-schnell:

“Boost jetzt?” – “Shields hoch!” – “Ping rechts!” – “Rockets für Elite sparen!”

Minute-zu-Minute

Welle läuft → Gegnerdruck steigt → Drops/Upgrades → kurze Entscheidung → nächste Welle.

Zwischendurch Events:

- Risk/Reward: “Signalquelle in der Dunkelheit” (Bonus, aber Spawn-Trigger)
- Mini-Boss spiked plötzlich

Seat Swap kann jederzeit passieren, aber fair (siehe unten).

Run-zu-Run

Jeder Run ist neu (prozedural, andere Upgrades).
Keine permanenten Power-Upgrades nötig, weil:

- Score + Rangliste treiben
- Mastery kommt durch Rollenkompetenz (Skill)

Meta: Account/Stats/Leaderboard, aber Gameplay bleibt “clean”.

---

3) Stations & Rollen (5 Seats)

Wichtig: Ein gemeinsamer Bildschirm zeigt alle Stationen gleichzeitig — jeder sieht die komplette Crew-Konsole. Nur die eigene Station ist interaktiv (die anderen sind sichtbar, aber gesperrt / read-only).

Seat 1: Pilot (Movement)

Job: Bewegung, Positionierung, Ausweichen, “Kampf-Tanz”.
Inputs: Touch-Stick links + Boost-Button (Mobile), WASD/Stick (Browser).
Skillcap: Hoch. Gute Piloten machen den Run leichter als 20% mehr Schaden.
Swap-Feeling: “Oh Gott ich lenk jetzt.” Der Moment ist Panik + Power.
UI: Steering-Ring, Boost-Cooldown, Danger-Indicator (Kollision/Incoming).

Seat 2: Gunner (Weapons)

Job: Ziele priorisieren, DPS, Crowd Control.
Inputs: Aim (rechter Stick / Swipe-Aim), Fire, Weapon-Switch.
Skillcap: Mittel–hoch. Zielpriorität schlägt pure Reflexe.
Swap-Feeling: Tunnelblick → plötzlich musst du Überblick haben, oder andersrum.
UI: Reticle, Ammo/Heat, Weapon selector, “Marked Targets” highlight.

Seat 3: Power (Energy Distribution)

Job: Energie zwischen Engines / Weapons / Shields verteilen.
Inputs: 3 Slider + Preset Buttons (“Attack / Defense / Speed”).
Skillcap: Hoch (strategisch + Timing).
Swap-Feeling: Du kommst rein, siehst 3 Slider und weißt: “Ich kann gerade alles retten – oder alles killen.”
UI: Energie-Budget, Overheat, Shield Regen, Engine thrust indicator.

Seat 4: Systems (Active Abilities)

Job: Skills/Module: EMP, Shield Burst, Slow Field, Overdrive etc.
Inputs: 3–4 große Buttons (Mobile friendly), Cooldown Management.
Skillcap: Mittel (Game Knowledge = Stärke).
Swap-Feeling: “Welche Fähigkeit ist ready?” → tooltip hilft.
UI: Ability Grid, Cooldowns, tooltips, synergy hints (“best vs flyers”).

Seat 5: Support (Repair / Scanner / Utility)

Job: Scan Ping (sichtbar machen), Repairs, Loot Magnet, Debuff Cleanse.
Inputs: 2–3 Utility Buttons + Mini-Radar Toggle.
Skillcap: Mittel (Timing + Übersicht).
Swap-Feeling: Du wirst zur “Crew-Mama” — du rettest Runs.
UI: Radar/minimap, Ping cooldown, repair meter, team status.

---

4) Seat Swap System (Chaos, aber fair)

Ziele

- Spannung + Humor + “Team neu sortieren”
- Kein “unfairer Tod wegen UI-Wechsel”
- Spieler lernen alle Rollen

Regeln

Server bestimmt Swap-Zeitpunkt (autoritativer Tick).
Random Intervall z. B. 45–90 Sekunden, aber:

- Kein Swap im “Instant-Kill Moment” (z. B. bei Crash-Spike)

Warnphase: 3 Sekunden Countdown
UI flash + Sound + “Swap incoming!”
Grace Phase: 2 Sekunden nach Swap
Damage Reduction + Autostabilisierung
Turret behält Zielrichtung kurz
Power setzt kurz Preset “Balanced”

Swap-Animation (ein Bildschirm)
Panels “slide” minimal, Labels ändern sich sichtbar
Große Anzeige: “DU BIST JETZT: POWER”
Mini-“How to” Tooltip 1–2 Zeilen (nicht nervig)

Anti-Frust: Assist

Pilot-Wechsel: Autopilot hält Kurs 1–2 Sekunden, bis neue Eingabe kommt.
Gunner-Wechsel: Turret aim freeze / soft tracking.
Power-Wechsel: Preset Buttons sind “One-tap save”.
Systems/Support: Buttons groß und klar, Icons eindeutig.

---

5) Upgrades & Progression (Run-basiert, seat-basiert)

Kerndesign: Upgrades gehören dem Seat, nicht dem Spieler.
Das heißt: Wenn “Gunner” +30% Feuerrate bekommt, ist das Gunner-System stärker — egal wer später Gunner ist.

Upgrade-Typen

Seat-Direct: “Pilot: +20% Turn Rate”

Cross-Seat Synergy:

- “Marked targets take +25% damage” (Support ↔ Gunner)
- “Excess weapon energy feeds shields” (Power ↔ Gunner ↔ Engineer)

Mutatoren (spicy):

- “Swap Surge”: Nach jedem Swap 5 Sekunden Overdrive
- “Dark Pact”: mehr Damage, weniger Vision radius

Auswahl-Mechanik

Alle X Sekunden oder nach Wellen: 3 Karten zur Auswahl
Team wählt gemeinsam, oder:
Drop ist seat-gebunden (z. B. Gunner-Chip erscheint, Gunner entscheidet)
UI: Upgrade-Cards groß, readable, mit Icon Socket (später)

Absurd Scaling

Je länger der Run, desto lächerlicher die Synergien:

Waffen schießen Kettenblitze, Ping markiert ganze Horden, Shields regen wie verrückt, Boost wird quasi permanent — aber Gegner skalieren genauso.

---

6) Enemies & Boss-Philosophie (Pressure pro Seat)

Grundregel: Jeder Gegner stresst mindestens einen Seat

Chaser (Standard): zwingt Pilot zu Movement, Gunner zu AoE.
Runner: zwingt Support zu Ping/Mark, Pilot zu Ausweichlinien.
Spitter: zwingt Power/Shields + Systems (Cleanse/Shieldburst).

Elite-Mechanik

Elites “brechen Routine”, z. B.:

- “Shroud Elite”: unsichtbar ohne Ping
- “Sapper Elite”: legt Minen (Pilot/Support)
- “Overheat Elite”: macht Waffen heiß (Power/Engineer reagiert)

Bosses (MVP später, aber Design jetzt)

Boss = Koop-Check:

- Pilot muss Position halten
- Gunner muss Weakspots treffen
- Power muss Timing & Presets managen
- Systems muss Burst windows erzeugen
- Support muss Adds & Visibility kontrollieren

Boss + Swap ist Peak-Fun: inszeniert mit Slowmo + gigantischem Audio Cue.

---

7) Prozedurale Welt + Darkness als Mechanik

Arena-Generator

Modular: Segmente/Rooms aus Tiles
Spawnpoints, Obstacles, “Risk Nodes”
Jede Arena hat:

- Base darkness level
- 1–2 Events
- Spawn pattern (flank / surround / funnel)

Darkness

Sicht = Gameplay.
Vision radius vom Ship + kurzzeitige Licht-Blitze bei:

- shooting
- explosions
- scanning

Support kann “Ping” setzen → kurz sichtbar.
Das gibt dem Spiel diesen “wir kämpfen uns durchs Nichts”-Vibe.

---

8) Meta Systems: Login, Leaderboard, Sessions

Login

Email/Passwort
Token-based (JWT)
Accounts speichern:

- Bestscore
- Total runs
- Last run details
- Cosmetic flags (optional)

Matchmaking

Room Code + Quick Play
Rejoin Window 30s (Mobile Reality)

Leaderboard

Top 50 global
Optional Filter nach Teamgröße (1–5)

Anti-cheat: nur server-authoritative Scores werden gespeichert.

---

Tech-Architektur (ohne Unity, Mobile+Browser)

Client

Phaser 3 + Vite + TypeScript
Touch-first UI:

- große Buttons
- sliders “fat finger safe”

Rendering:

- top-down sprites + particles
- darkness overlay (mask / blend)

Network:

- send inputs only
- receive snapshots
- interpolate on client

Server

Node + Colyseus (Rooms)
Authoritative simulation:

- tick 20Hz
- deterministic RNG per room

Bots:

server-side, seat-based behavior trees (simple)

Persistence:

SQLite in dev
Easy swap to Postgres later

---

Asset-Pipeline (9-Slice + Sprite Sheets)

Du wolltest: “9er sprites, die ich einzeln slice” → wir machen 9-Slice-freundliche Panels + Sprite Sheets für VFX.

A) 9-Slice PNGs (UI)

Allgemeine Regeln

Transparent PNG
2048×2048 für Panels, 1024×1024 für Buttons
Gerade Kanten, klare Ecken, innen viel “clean area”
Keine Texte

Prompts (Copy/Paste)

1. UI_Panel_Large_2048.png

“Large rectangular UI panel frame, scrap-tech wasteland, cel-shaded flat colors, hard light split, bold silhouette, clean straight edges and corner caps for 9-slice, inner padding area, subtle rivets and dents, NO TEXT, transparent background.”

2. UI_Seat_Pilot_2048.png

“Medium 9-slice panel frame with steering/handling motif (grip corners, reinforced left edge), cel-shaded scrap-tech, flat colors, hard lighting, NO TEXT, transparent PNG.”

3. UI_Seat_Gunner_2048.png

“Medium 9-slice panel frame with reticle/bracket motif, reinforced top edge, cel-shaded scrap-tech, NO TEXT, transparent.”

4. UI_Seat_Power_2048.png

“Medium 9-slice panel with cable/connector motifs, three subtle grooves for sliders, cel-shaded scrap-tech, NO TEXT, transparent.”

5. UI_Seat_Systems_2048.png

“Medium 9-slice panel with module-bay vent motif, cel-shaded scrap-tech, NO TEXT, transparent.”

6. UI_Seat_Support_2048.png

“Medium 9-slice panel with tool clamp motif, cel-shaded scrap-tech, NO TEXT, transparent.”

7. UI_Button_Primary_1024.png

“9-slice button frame, chunky scrap-metal, clean center, cel-shaded flat colors, NO TEXT, transparent.”

8. UI_SliderTrack_1024.png + UI_SliderKnob_512.png

“9-slice slider track, clean, scrap-tech, NO TEXT, transparent.”
“Slider knob: chunky hex cap, cel-shaded, NO TEXT, transparent.”

B) Sprite Sheets (VFX)

1. VFX_MuzzleFlash_8x8_2048.png

“Sprite sheet 8x8 frames: stylized muzzle flash, crisp shapes, minimal smoke, cel-shaded flat colors, NO TEXT, transparent, evenly spaced grid.”

2. VFX_Impact_Metal_8x8_2048.png

“Sprite sheet 8x8: metal hit sparks + shards, cel-shaded flat colors, NO TEXT, transparent.”

3. VFX_Boost_Thruster_8x8_2048.png

“Sprite sheet 8x8: thruster flame + smoke puff, cel-shaded, NO TEXT, transparent.”

C) Gameplay Sprites

SPR_Ship_1024.png

“Top-down ship/vehicle sprite, armored core, mount points, readable silhouette, cel-shaded flat colors, NO TEXT, transparent.”

SPR_Enemy_Chaser_512.png, Runner, Spitter

“Top-down enemy sprite, readable silhouette, cel-shaded, NO TEXT, transparent.”

SPR_Projectiles_256.png

bullet streak, rocket, acid blob.

---

Was du am Ende bekommst (Definition of Done)

✅ Spiel läuft als Website und als PWA auf Mobile
✅ Login + Account Stats
✅ Room Code + 1–5 echte Spieler gleichzeitig
✅ fehlende Seats werden von Bots gefüllt
✅ ein gemeinsamer Screen mit allen Stationen sichtbar
✅ Seat Swap funktioniert fair + lustig
✅ prozedurale Arena + Waves + Upgrades + Score + Leaderboard
✅ Assets: auto-download (free) + eigene generierte 9-slice + sprite sheets
