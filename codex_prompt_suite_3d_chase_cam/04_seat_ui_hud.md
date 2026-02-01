# Prompt 4 — Seat UI in 3D (HUD + Panels), nur eigene Station interaktiv

```text
Baue Crew-Console UI als HUD Overlay (2D UI über 3D View):
- Alle 5 Stationen sichtbar (Panels am Rand).
- Nur eigener Seat interaktiv; andere disabled/readonly.
- Anzeigen:
  Pilot: speed, gear/reverse state, boost cooldown, traction/handbrake state
  Gunner: weapon, heat/ammo, reticle state, target lock info
  Power: 3 energy bars + preset
  Systems: ability cooldowns
  Support: ping cd, repair meter, radar status

Seat-Assignment:
- Server weist Seats zu; Client zeigt Seat + Playername.
- Wenn <5 Spieler: Bots füllen Seats; UI zeigt BOT.

Akzeptanz:
- Panels sind immer sichtbar.
- Interaktion nur im eigenen Seat möglich.
```
