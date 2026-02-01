# Prompt 3 — Chase Camera (Spring Arm, Collision, Smooth, Kein „falsch“)

```text
Implementiere eine robuste 3D Chase Camera:
- Kamera folgt dem Vehicle mit Spring-Arm (follow distance), smoothing (critically damped / lerp).
- Kamera richtet sich an Vehicle forward + optional look-ahead basierend auf velocity.
- Kamera-Kollision: Raycast/ShapeCast gegen World, um Clipping zu vermeiden (Camera zieht näher ran).
- Zoom/FOV:
  - Mausrad: distance oder FOV
  - Touch pinch: distance/FOV
- Optional: "free look" (hold middle mouse / right stick) ohne Vehicle steering zu beeinflussen.
- Netzwerk: renderTransform wird interpoliert; Kamera folgt renderTransform, nicht serverTransform.

Debug:
- Zeige: vehicle server pose vs render pose, camera distance, camera collision state.

Akzeptanz:
- Kamera bleibt stabil bei harten Richtungswechseln.
- Kein Jitter bei Netzwerk-Snapshots.
- Keine Kamera durch Wände.
```
