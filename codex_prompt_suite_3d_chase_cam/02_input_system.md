# Prompt 2 — Input System (Vehicle Controls + Turret Aim + Touch)

```text
Baue ein zentrales Input-System im Client (Action Map), 3D-vehicle-kompatibel:

Actions (Beispiele):
- Pilot: throttle (0..1), brake (0..1), steer (-1..1), handbrake (bool), boost (bool)
- Gunner: aimYaw, aimPitch (oder aimRay), fire (bool), altFire (bool), swapWeapon (bool)
- Power: presetAttack/Defense/Speed/Balanced, sliders engines/weapons/shields (0..1)
- Systems: ability1..ability4
- Support: ping, repairHold, radarToggle

Unterstütze:
A) Desktop:
- WASD: W throttle, S brake/reverse, A/D steer, Space handbrake
- Shift boost
- Maus: Gunner aim (pointer lock), LMB fire, RMB altFire, Q/E weapon
B) Gamepad:
- RT throttle, LT brake, left stick steer, A handbrake, B boost
- Right stick aim, RB/LB weapon, RT (gunner seat) fire
C) Touch (Mobile):
- Links: virtual steering + throttle/brake slider (oder two-zone pedals)
- Rechts: aim swipe + fire button + altFire + weapon
- Große Buttons für boost/ping/repair/abilities, Power: 3 slider + presets

Seat-aware:
- Nur die Actions des eigenen Seats werden aktiv generiert.
- Debug Overlay zeigt live Actions + Werte.

Akzeptanz:
- In jedem Seat sehe ich die korrekten Actions im Debug HUD.
- Pointer lock für Gunner funktioniert (Desktop).
- Touch-Steuerung ist funktional (nicht hübsch, aber zuverlässig).
```
