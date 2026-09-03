<p align="center">
  <img src="docs/banner.png" alt="DLSS 5 Swapper" width="100%">
</p>

<h1 align="center">DLSS 5 Swapper</h1>

<p align="center">
  Install and manage DLSS 5 Neural Rendering for compatible games and emulators.
</p>

<p align="center">
  <a href="https://github.com/rakanki911/DLSS5-Swapper/releases/latest"><img src="https://img.shields.io/github/v/release/rakanki911/DLSS5-Swapper?color=8fd400&label=release" alt="Latest release"></a>
  <a href="https://github.com/rakanki911/DLSS5-Swapper/releases"><img src="https://img.shields.io/github/downloads/rakanki911/DLSS5-Swapper/total?color=8fd400&label=downloads&cacheSeconds=300" alt="Total downloads"></a>
  <img src="https://img.shields.io/badge/Windows-10%20%2F%2011-8fd400" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/Linux-Proton%20%2F%20Wine-8fd400" alt="Linux via Proton or Wine">
  <img src="https://img.shields.io/badge/languages-38-8fd400" alt="38 languages">
</p>

## Download 2.2.0

[**Windows Installer**](https://github.com/rakanki911/DLSS5-Swapper/releases/download/v2.2.0/DLSS5-Swapper-Setup-2.2.0.exe) ·
[**Portable**](https://github.com/rakanki911/DLSS5-Swapper/releases/download/v2.2.0/DLSS5-Swapper-2.2.0-portable.exe) ·
[Checksums](https://github.com/rakanki911/DLSS5-Swapper/releases/download/v2.2.0/SHA256SUMS.txt)

<p align="center">
  <img src="https://raw.githubusercontent.com/rakanki911/DLSS5-Swapper/7415065e5c5437441d0e0b0a0362d0ada6d86e15/docs/screenshots/01-home.png" alt="Home" width="100%">
</p>

## Features

- **Easy installation:** native DLSS games, or compatible non-DLSS games through DLSS5-Feeder.
- **Your library:** Steam, Epic, GOG, modern Xbox Game Pass folders, and manually added games/emulators. On Linux: Steam Play, Heroic and Lutris.
- **Search and filters:** combine title, graphics API, DLSS status/version and add-ons; click counters to filter.
- **Flexible layout:** group by store or show everything in one list, with game artwork and light/dark themes.
- **Controlled scanning:** full-drive scanning is **off by default**. Added folders still scan normally; enable all-drive discovery or remove scan folders in Settings.
- **Right-click shortcuts:** open/copy folder, rescan, change cover, restore originals or hide a game.
- **Backups and History:** restore original files, keep installation records, and copy History/activity/install logs.
- **Custom add-ons:** the Add-ons page remains available alongside the integrated installation routes.

## New in 2.2.0

- **⭐ Optional [OptiScaler DLSS-NR](https://github.com/Dagherbou/OptiScaler_DLSSNR/releases):** choose it in the game page instead of ReShade. Apply the change with the game closed; switch back when wanted. Settings are kept separately.
- **SWTOR / DX9:** correct Feeder selection instead of the native-only route; adds 32-bit DX8 installation.
- **Feeder repairs:** matching 0.12.0 components, corrected shader/preset settings, and missing Visual C++ runtime checks.
- **Better detection:** small/nested executables and Cyberpunk 2077 / Phantom Liberty library entries.
- **Safer installs/restores:** preserve native Streamline/FG files, protect backups during repeat installs and backend switches, and restore even when the executable is missing.
- **History and translations:** fixes missing installation history; search, filters and installation warnings now cover all 38 languages.

[Full fixes and known limitations →](docs/releases/v2.2.0.md)

## Compatibility

| Category | Support |
| --- | --- |
| **System** | Windows 10/11 x64; compatible 32-bit and 64-bit games. Linux: Windows games run through Proton or Wine — see [Linux](#linux) |
| **ReShade / Feeder GPUs** | RTX 20 / 30 / 40 / 50; older-series support is reported by the bundled modified runtime's author |
| **OptiScaler GPUs** | RTX 50 only, NVIDIA driver **616.56+**, 64-bit games with native DLSS enabled |
| **DirectX 12** | Native DLSS, Feeder, or eligible OptiScaler games |
| **DirectX 11** | Feeder for 32/64-bit games; eligible OptiScaler games |
| **DirectX 9 / 8** | DX9: 32/64-bit; DX8: 32-bit, through dgVoodoo2 → DX11 → Feeder |
| **Vulkan / OpenGL** | ReShade/Feeder; eligible Vulkan games can also use OptiScaler. On Linux, Vulkan is OptiScaler only |
| **DirectX 10** | Not directly supported by Feeder; choose DX11 when available |

OptiScaler's DX11/Vulkan path uses a DX12 bridge with FSR output by default.
For Vulkan backend changes, **restore originals first**. OptiScaler is not the emulator/non-DLSS route.

## Linux

Windows games launched through Proton or Wine. A Linux-native build of a game cannot load the
Windows DLSS payload and is skipped.

**What is found**

| Launcher | Notes |
| --- | --- |
| **Steam Play** | Native, and the Flatpak install. The game's own `compatdata` prefix is used |
| **Heroic** | Epic, GOG, Amazon and sideloaded games; native and Flatpak |
| **Lutris** | Wine games; native and Flatpak |

Full-drive scanning finds nothing here — it enumerates Windows drive letters. Add folders by hand
in Settings instead.

**What works**

- Swapping the DLSS runtime on a game that already has DLSS, and the OptiScaler route including
  its Vulkan path.
- ReShade Setup, run inside the prefix the game already uses — the Steam Play prefix, or the Wine
  prefix Heroic or Lutris made for it. Installs that never reach the setup do not need a prefix at
  all.
- The "close the game first" check, which reads `/proc` rather than asking PowerShell.

**What does not**

- **The Feeder route**, which is refused outright. It patched launchers rather than games and left
  Proton titles unable to start — found by [Febsho](https://github.com/Febsho/DLSS5-Swapper-Linux),
  who shipped Linux builds and watched them break. Vulkan never reached it here anyway: the Feeder
  registers ReShade as a Windows implicit layer, and Wine hands layer enumeration to the host
  Vulkan loader, which loads `.so` layers and never a Windows ReShade DLL. Use Native DLSS, or
  OptiScaler for Vulkan.
- **A game that already has a non-add-on ReShade.** The existing proxy may belong to another mod or
  loader, and replacing it crashed otherwise healthy games. Same source.
- **Lutris games on a Proton runner**, which is launched through umu, and **Heroic CrossOver
  bottles**. Both are found and can still take a plain DLL swap; only the ReShade Setup step is
  unavailable.
- **Emulators**, in practice. The Linux builds people actually run are native, and the Windows
  builds that would work under Wine go through the Feeder, which is refused above.
- The OptiScaler GPU gate compares the NVIDIA driver against a Windows version number, and the
  Linux driver does not use the same numbering. That threshold has not been checked against the
  real DLSS 5 requirement.

**Running it**

There are no Linux binaries. Run from source (tested on Node 24):

```bash
npm install && npm start
```

Installing anything also needs the `payload/` folder — the DLSS 5 runtime, ReShade Setup and the
Feeder components. It is not in the repository and has to be supplied yourself; without it the app
starts and lists your games but cannot install. `npm run build:linux` needs it too. See
`scripts/collect-payload.js`.

> Partly tried against a real Steam Play game. What has run: the library finds it, the process
> guard reads `/proc`, and ReShade Setup executes inside the game's own Proton prefix and leaves a
> working add-on-capable `dxgi.dll` (6.8.0) that this app's own scanner accepts. What has not: the
> DLSS runtime swap and restore, which need the payload; Heroic and Lutris, whose file locations
> were read out of their own shipped code rather than tried against an install; and the OptiScaler
> route, which needs an RTX 50. Keep your backups.

## Emulators

Select the emulator folder and its active renderer, then use **ReShade/Feeder**.

<table>
  <tr><th colspan="3">Emulators</th></tr>
  <tr><td>DuckStation</td><td>PCSX2</td><td>RPCS3</td></tr>
  <tr><td>Dolphin</td><td>PPSSPP</td><td>Xenia</td></tr>
  <tr><td>Cemu</td><td>Ryujinx</td><td>yuzu / suyu / Eden / Citron / Sudachi</td></tr>
  <tr><td>shadPS4</td><td>Azahar / Citra / Lime3DS</td><td>melonDS</td></tr>
  <tr><td>Flycast</td><td>xemu</td><td>Vita3K</td></tr>
  <tr><td>RetroArch</td><td>mGBA</td><td>Snes9x</td></tr>
  <tr><td>Play!</td><td></td><td></td></tr>
</table>

Compatibility varies by renderer and game. Xenia HUD correction remains experimental.

## 38 languages

<table>
  <tr><th colspan="4">All 38 languages</th></tr>
  <tr><td>English</td><td>العربية</td><td>简体中文</td><td>繁體中文</td></tr>
  <tr><td>Español</td><td>Português</td><td>Русский</td><td>Deutsch</td></tr>
  <tr><td>Français</td><td>日本語</td><td>한국어</td><td>Italiano</td></tr>
  <tr><td>Türkçe</td><td>Polski</td><td>Українська</td><td>Nederlands</td></tr>
  <tr><td>Čeština</td><td>Magyar</td><td>Română</td><td>Ελληνικά</td></tr>
  <tr><td>Svenska</td><td>Dansk</td><td>Norsk</td><td>Suomi</td></tr>
  <tr><td>ไทย</td><td>Tiếng Việt</td><td>Bahasa Indonesia</td><td>Bahasa Melayu</td></tr>
  <tr><td>Filipino</td><td>हिन्दी</td><td>বাংলা</td><td>فارسی</td></tr>
  <tr><td>اردو</td><td>Български</td><td>Српски</td><td>Hrvatski</td></tr>
  <tr><td>Slovenčina</td><td>Català</td><td></td><td></td></tr>
</table>

**Arabic, Persian and Urdu support right-to-left layout.**

## Screenshots

<p><img src="https://raw.githubusercontent.com/rakanki911/DLSS5-Swapper/7415065e5c5437441d0e0b0a0362d0ada6d86e15/docs/screenshots/02-games.png" alt="Games" width="100%"></p>
<p><img src="https://raw.githubusercontent.com/rakanki911/DLSS5-Swapper/7415065e5c5437441d0e0b0a0362d0ada6d86e15/docs/screenshots/03-library.png" alt="Library" width="100%"></p>
<p><img src="https://raw.githubusercontent.com/rakanki911/DLSS5-Swapper/7415065e5c5437441d0e0b0a0362d0ada6d86e15/docs/screenshots/04-game.png" alt="Game details" width="100%"></p>

## Before installing

- **Anti-cheat:** red warning and optional confirmation, not a blanket block. Injection can cause crashes or account bans; the app never bypasses anti-cheat.
- **Requirements:** Feeder needs Visual C++ runtimes (x64, plus x86 for 32-bit games). Some components download on first use.
- **Compatibility is not guaranteed.** Keep backups; existing mods may conflict. Not every reported game crash is fixed.
- **Linux/Proton:** source only and untested against a real game — see [Linux](#linux).

---

Built by **Rakan Alkhaldi** · MIT · [Third-party credits and licences](THIRD_PARTY_NOTICES.md)
