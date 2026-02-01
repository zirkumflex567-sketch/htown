# Prompt 16 — Polish Pass (3D VFX, PostFX, Performance)

```text
Polish/Perf für 3D:
- Visibility/Darkness:
  - optional fog + vignette + headlight cone / vehicle glow radius
  - ping temporarily increases outlines / visibility
- VFX Hooks:
  - muzzle flash, hit sparks, explosion decals, repair sparks, seat swap flash
- Performance:
  - pooling für projectiles/enemies
  - server tick stable (z.B. 20Hz), client interpolation
  - optional: client-side prediction nur für local pilot (mit server reconciliation)
- Debug overlay: FPS, entity count, net RTT, server tick drift.

Akzeptanz:
- Solide FPS mit moderaten Waves.
- Kein entity leak.
```
