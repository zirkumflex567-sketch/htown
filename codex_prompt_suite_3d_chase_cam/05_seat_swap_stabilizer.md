# Prompt 5 — Seat Swap (3D Vehicle Stabilizer statt Top-Down Grace)

```text
Implementiere server-authoritative Seat Swap mit fairer 3D-Fahrzeug-Absicherung:

Ablauf:
1) 3s Warning Countdown (HUD + Sound hook)
2) Seat Permutation (server broadcast)
3) Grace 2s: Stabilizer pro System:
   - Pilot Wechsel: Server aktiviert "Drive Assist" für 1–2s:
     * hält current throttle/steer geglättet
     * yaw stabilization (dämpft Übersteuern)
     * limitiert maximale steer-rate für 1s
   - Power: setzt Balanced preset für 1–2s wenn neue Inputs fehlen
   - Gunner: aim smoothing + verhindert instant 180° snap für 0.5s
   - Systems/Support: cooldowns laufen normal, aber UI zeigt „You are now …“ + Controls hint

Swap Scheduling:
- random 45–90s
- verschiebe Swap, wenn Boss-Attack telegraph aktiv oder Vehicle extrem instabil (z.B. airborne/flip) -> delay wenige Sekunden

Akzeptanz:
- Swap fühlt sich nie nach „Instant Crash“ an.
- Vehicle bleibt kontrollierbar.
```
