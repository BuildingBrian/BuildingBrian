# Vapor Strike source

The arcade game behind the PRESS START button on [github.com/BuildingBrian](https://github.com/BuildingBrian).
It is served from [`docs/`](../docs/) by GitHub Pages: <https://buildingbrian.github.io/BuildingBrian/>

Plain canvas and WebAudio, no dependencies and no build tools beyond a shell script.

| Path | What it is |
|---|---|
| [`js/01_core.js`](js/01_core.js) | Constants, seeded RNG, pixel drawing helpers, and the WebAudio synth (every sound, including the coin drop, is generated in code) |
| [`js/02_world.js`](js/02_world.js) | Sprite loading and the scrolling backdrop: sky, striped sun, mountains, skyline, perspective grid |
| [`js/03_play.js`](js/03_play.js) | Player, weapons, enemies, the boss, projectiles and collisions |
| [`js/04_main.js`](js/04_main.js) | Stage script, attract-mode pilot, input, game modes, HUD and the main loop |
| [`build.sh`](build.sh) | Concatenates the four parts into `docs/vs.js` |
| [`key_sprites.py`](key_sprites.py) | Green-screen keying, slicing and downscaling for the sprite art |
| [`capture.sh`](capture.sh) | Renders deterministic frames with headless Chrome (`?shot=T&scene=demo`), used for the README preview |

```bash
./game-src/build.sh                       # rebuild docs/vs.js
python3 -m http.server -d docs 8000       # then open http://localhost:8000
```

The player carries the real AH-64 loadout: 1,200 rounds of 30mm, 38 rockets and 8 Hellfires. The chain gun
slews to the nearest target inside its arc, and a Hellfire will not leave the rail without a lock.

Controls: arrows or WASD to fly, Z for the 30mm, X for rockets, C for Hellfire, Enter to start, P to pause, M to mute.
A gamepad works too, and touch devices get an on-screen stick and buttons.
