# Prompt 12 — Bots (3D-fähige Controller pro Seat)

```text
Implementiere Bots server-side:
- Fehlen Seats => BotController übernimmt Input Generierung.
- PilotBot:
  - follow safe path: avoid clusters, keep speed, reduce oversteer
  - if enemy close: evasive steering, handbrake turn optional
- GunnerBot:
  - aim at marked/nearest, lead shots (basic)
  - fire discipline (heat/cooldown)
- PowerBot:
  - defense wenn shields low, attack wenn many enemies, speed wenn kiting
- SystemsBot:
  - EMP when swarm, shield burst at low shield, overdrive on elites/boss
- SupportBot:
  - ping on cooldown when enemies present
  - repair when hull < threshold

Akzeptanz:
- Solo-Run mit Bots ist spielbar.
```
