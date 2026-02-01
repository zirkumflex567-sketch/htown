# Prompt 6 — Enemies v1 in 3D (Nav/Steering, Spawner, KI)

```text
Implementiere Enemies server-simulated (3D):
- BaseEnemy: id, type, hp, pos, rot, vel, flags
- 3 Typen:
  1) Chaser: verfolgt Vehicle und versucht Ram/side-hit (steering behavior)
  2) Runner: strafing/ circling in mittlerer Distanz, zwingt Gunner aim
  3) Spitter: hält Abstand, schießt projectiles/rays
- Spawner/Waves:
  - spawn in ring um Arena (außerhalb camera view distance)
  - difficulty scaling (count, spawn rate, elite chance)
- Hit/Collision:
  - server: collision volumes + projectile hit
  - client: VFX hooks (placeholder)

Akzeptanz:
- Wellen laufen, enemies bewegen sich plausibel in 3D.
- Vehicle nimmt Schaden durch Treffer/Ram.
```
