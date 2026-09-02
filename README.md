<p align="center">
  <img src="docs/banner.png" alt="DLSS 5 Swapper" width="100%">
</p>

<h1 align="center">DLSS 5 Swapper for Linux</h1>

<p align="center">
  Find Steam Proton games and install DLSS 5 Neural Rendering in one click.
</p>

<p align="center">
  <a href="../../releases/latest"><img src="https://img.shields.io/github/v/release/Febsho/DLSS5-Swapper-Linux?style=flat-square&color=8fd400&label=release" alt="Release"></a>
  <a href="../../releases"><img src="https://img.shields.io/github/downloads/Febsho/DLSS5-Swapper-Linux/total?style=flat-square&color=8fd400&label=downloads" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/platform-Linux%20%2B%20Steam%20Proton-8fd400?style=flat-square" alt="Linux and Steam Proton">
  <img src="https://img.shields.io/badge/licence-MIT-8fd400?style=flat-square" alt="MIT">
</p>

<p align="center">
  <img src="docs/screenshots/01-home.png" alt="DLSS 5 Swapper home screen" width="100%">
</p>

---

## Download

Download the x86_64 AppImage from [Releases](../../releases).

| File | Platform | Use |
| --- | --- | --- |
| **DLSS5-Swapper-*-x86_64.AppImage** | Linux x86_64 | Portable desktop application |

Make it executable, then run it:

```bash
chmod +x DLSS5-Swapper-*-x86_64.AppImage
./DLSS5-Swapper-*-x86_64.AppImage
```

## Requirements

- A 64-bit Linux distribution and an NVIDIA RTX GPU.
- Steam installed normally or through Flatpak.
- A Windows game launched through **Steam Proton**. Start it once with a Proton
  compatibility tool selected so Steam creates its prefix.
- A bundled DLSS/ReShade payload. Preview builds made without `payload/` can
  test the interface and Steam discovery, but cannot install DLSS.

Native Linux games are not supported: the DLSS and ReShade components used by
this project are Windows DLLs. The Vulkan Feeder route is also unavailable on
Linux; use a DirectX renderer in the Proton game.

## Linux / Proton support

The app automatically discovers Steam libraries at the common native-Steam and
Flatpak locations. For a selected Steam Play game, it finds the associated
`compatdata` prefix and launches ReShade Setup through that game's Proton tool.
The setup therefore uses the same Wine environment as the game, rather than a
separate host Wine prefix.

The app backs up files before changing them. **Restore originals** restores
those files and removes files it added.

## Installing DLSS 5

<p align="center">
  <img src="docs/screenshots/04-game.png" alt="Game details" width="100%">
</p>

1. Open a Windows Steam game configured to use Proton.
2. Choose the game executable and its DirectX renderer, if the game exposes
   more than one.
3. Select **Native DLSS** for a game that already includes DLSS, or
   **DLSS5-Feeder** for a supported game without it.
4. Click **Install DLSS 5**. ReShade Setup runs in the game's Proton prefix.
5. Launch the game through Steam and open ReShade to verify the effect.

> ⚠️ Compatibility is experimental and varies by game. Keep the backup until
> you have confirmed that the game runs as expected.

## Your Steam library

<p align="center">
  <img src="docs/screenshots/03-library.png" alt="Game library" width="100%">
</p>

Steam libraries are detected automatically. You can also add a game folder for
inspection, but installation on Linux is limited to a Steam Proton title with
an existing compatibility prefix.

Each game card shows the detected renderer, architecture, installed DLSS
version, and ReShade status.

## Building from source

```bash
npm install
npm run payload -- /path/to/dlss5-payload
npm run build:linux
```

`npm run build:linux` produces an AppImage in `dist/`. The optional payload
must contain the DLSS files, add-ons, and ReShade Setup required by the
installer; it is not stored in this repository.

## Project layout

| File | Role |
| --- | --- |
| `src/core/proton.js` | Finds a game's Proton tool and runs Windows setup programs in its prefix |
| `src/core/scan.js` | Game and payload scanning, API detection, and ReShade detection |
| `src/core/apply.js` | Backup, swap, ReShade setup, and restore |
| `src/library.js` | Steam library discovery, including native Steam and Flatpak paths |
| `main.js` | Electron IPC, payload resolution, and Proton-aware installation |
| `src/renderer/` | Application interface and translations |

## Third-party components

DLSS5-Feeder, VORT shaders, dgVoodoo2, LumeniteFX, and the Vulkan/Feeder model
retain their respective licences. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
for included notices.

Built by **Rakan Alkhaldi** · Linux/Proton adaptation maintained in this fork ·
MIT licensed.
