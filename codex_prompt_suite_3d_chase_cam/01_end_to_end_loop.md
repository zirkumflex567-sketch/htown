# Prompt 1 — End-to-End 3D Loop (Vehicle + Snapshots + Render)

```text
Implementiere/überprüfe einen minimalen stabilen End-to-End Loop (3D):
- Client joint eine Room, erhält initialen World-State (Vehicle, Players/Seats, ggf. Arena).
- Client sendet pro Tick Inputs (seat-abhängig) an Server.
- Server simuliert Vehicle movement (Pilot-Input) in 3D (position, rotation/yaw, velocity).
- Client rendert Vehicle 3D + eine einfache Debug HUD (Seat, FPS, RTT, Tickrate, serverPos vs renderPos).
- Snapshot/Interpolation: Client rendert weich (interpoliert), server bleibt autoritativ.

Akzeptanz:
- 1 Spieler: Vehicle fährt/lenkt sichtbar.
- 2 Spieler: nur Pilot bewegt, andere sehen korrekt.
- Keine Kamera/Movement Jumps (Interpolation vorhanden).
```
