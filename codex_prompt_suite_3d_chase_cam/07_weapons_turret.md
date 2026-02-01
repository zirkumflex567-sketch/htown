# Prompt 7 — Weapons in 3D (Turret, Aim, Hitscan/Projectile)

```text
Implementiere Weapons für Gunner Seat (3D):
- Gunner steuert aimYaw/aimPitch oder aimRay (camera-relative).
- Turret mount auf Vehicle: muzzle transforms folgen turret rotation.
- 2 Waffen:
  1) MG (projectile oder hitscan, spread, heat)
  2) Cannon (slow projectile, splash)
- Server:
  - cooldown/heat, spawn projectile, raycast hit, damage
- Client:
  - reticle aligned with aim, tracer/muzzle flash, hit sparks, optional camera shake

Akzeptanz:
- Gunner kann enemies zuverlässig treffen und töten.
- Aim fühlt sich stabil an (pointer lock, smoothing).
```
