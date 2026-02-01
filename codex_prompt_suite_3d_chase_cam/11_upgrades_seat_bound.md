# Prompt 11 — Upgrades (seat-bound) für 3D Vehicle & Turret

```text
Implementiere Upgrades (server), seat-bound:
- Upgrades bleiben am Seat, nicht am Spieler.
- Nach jeder Wave: 3 Karten Offer.
- Wähle eine Entscheidungslogik:
  A) Team Vote majority
  oder
  B) Seat Owner entscheidet (empfohlen für Tempo)
Implementiere sauber (inkl. timeout fallback).

Upgrade Beispiele:
- Pilot: +accel, +maxSpeed, +traction, +airControl, +boostDuration
- Gunner: +fireRate, +crit, +projectileSpeed, +splashRadius
- Power: +totalEnergy, +regenRate, +presetSwapSpeed
- Systems: -cooldowns, +radius, +duration
- Support: +markDuration, +repairSpeed, +radarRange

Synergien (2):
- Marked targets take +% damage
- Excess weapons energy converts to shield regen

Client:
- Upgrade Card UI, mobile-friendly, klarer 1-Satz Effekt.

Akzeptanz:
- Jede Wave -> Auswahl -> Effekt sichtbar.
- Seat swap ändert nicht Upgrades.
```
