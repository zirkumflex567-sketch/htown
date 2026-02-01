# Prompt 14 — Settings (3D Kamera/Controls/Accessibility/Audio)

```text
Implementiere Settings-Menü (client), 3D-spezifisch:
- Audio: master/music/sfx
- Kamera:
  - follow distance, FOV, camera shake on/off, smoothing strength
  - invert Y for gunner aim
- Controls:
  - keybinds desktop
  - gamepad mapping view
  - touch layout scale + left/right handed
- Accessibility:
  - reticle size, outline thickness für marked targets, text size

Persistenz via localStorage. Änderungen wirken live.

Akzeptanz:
- Reload behält Settings.
- Kamera/Audio/Controls ändern sich sofort.
```
