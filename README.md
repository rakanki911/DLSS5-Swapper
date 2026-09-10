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
  <img src="https://img.shields.io/badge/languages-38-8fd400" alt="38 languages">
  <a href="https://buymeacoffee.com/rakanki911"><img src="https://img.shields.io/badge/support-555" alt="Support"></a>
  <a href="https://buymeacoffee.com/rakanki911"><img height="20" src="https://cdn.buymeacoffee.com/buttons/v2/lato-yellow.png" alt="Buy me a coffee"></a>
</p>

## Download

[**Windows Installer**](https://github.com/rakanki911/DLSS5-Swapper/releases/latest) ·
[**Portable**](https://github.com/rakanki911/DLSS5-Swapper/releases/latest) ·
[Checksums](https://github.com/rakanki911/DLSS5-Swapper/releases/latest)

Both are on the latest release page, with `SHA256SUMS.txt` beside them.

<p align="center">
  <img src="https://raw.githubusercontent.com/rakanki911/DLSS5-Swapper/7415065e5c5437441d0e0b0a0362d0ada6d86e15/docs/screenshots/01-home.png" alt="Home" width="100%">
</p>

## Features

- **Easy installation:** native DLSS games, or compatible non-DLSS games through DLSS5-Feeder.
- **Your library:** Steam, Epic, GOG, modern Xbox Game Pass folders, and manually added games/emulators.
- **Search and filters:** combine title, graphics API, DLSS status/version and add-ons; click counters to filter.
- **Flexible layout:** group by store or show everything in one list, with game artwork and light/dark themes.
- **Controlled scanning:** full-drive scanning is **off by default**. Added folders still scan normally; enable all-drive discovery or remove scan folders in Settings.
- **Right-click shortcuts:** open/copy folder, rescan, change cover, restore originals or hide a game.
- **Backups and History:** restore original files, keep installation records, and copy History/activity/install logs.
- **Save diagnostics:** one file with the install log, the game’s own ReShade and Feeder logs, the manifest and your driver - shown to you before it is written, and ready to attach to a report.
- **In-game overlay:** press **F8** to open the app's own panel over the running game and move the real DLSS Neural Rendering sliders while you play. Supports the **DLSS5-Feeder** and **RenoDX v4.7** routes only. Drag the grip in its bottom right corner to resize it; each game remembers its own size.
- **Rendering API override:** optional, per game, with **Automatic** as the default; detection is never overwritten.
- **Custom add-ons:** the Add-ons page remains available alongside the integrated installation routes.
- **Multipass neural rendering:** an installation route that runs the neural pass up to ten times per frame, on DX12, DX11 and 64-bit DX9 - including games with no DLSS of their own.
- **Community (BETA):** read what worked for other people on the games you own, leave your own report, and talk it over underneath it. Opt-in, and everything you leave can be edited, deleted or withdrawn.

## New in 2.2.5

A fourth installation route that runs the neural pass more than once per frame, and nine faults fixed at the cause.

### ⭐ Multipass — the RenoDX DLSS Tool route

The neural pass has always run once. This route runs it **up to ten times**, each pass working on the output of the one before it, and it is the most-asked-for thing on the tracker ([#251](https://github.com/rakanki911/DLSS5-Swapper/issues/251)).

It is a route, not a switch. Pick it under **Installation route** and the app installs ShortFuse's DLSS Tool build in place of the ordinary neural consumer — the two cannot be loaded together, and choosing one route instead of the other is what keeps that honest, rather than a warning nobody reads.

- **Games with no DLSS of their own are the point.** The tool hooks `Present` rather than riding on the game's own DLSS, so it reaches titles the native route never could.
- **DirectX 12, DirectX 11 and 64-bit DirectX 9.** Not a guess: the add-on says so itself — *"Present supports D3D9, D3D11, and D3D12 presentation. D3D9 and D3D11 use a same-adapter, device-only D3D12 endpoint."* Its own known-issues list rules out 32-bit DX9, OpenGL and Vulkan, and so does this app.
- **Pass Count, and everything else, from the tool's own page** — press **Home** in game. The compact F8 panel does not drive this route; that was tried and it did not work, and half-driving it was worse than not.
- **The add-on is shipped exactly as its author built it.** This app writes nothing into its configuration. Every value set from the outside turned out worse than the one the tool chose for itself.

**It costs frames.** Ten passes is ten times the neural work. Two or three is where people report the picture changing without the frame rate falling apart — start there.

### The rest of what is new

| | |
|---|---|
| **Keep running in the tray** | Closing the window hides it instead of quitting, so the overlay keeps answering the game you are still playing. On by default, switchable in Settings ([#255]) |
| **On-screen DLSS 5 status** | A card over the game saying **On** or **Off**, for anyone recording a comparison — the picture alone cannot show which half is which. Drag it, resize it, and it stays where you left it, per game |
| **A driver you cannot run this on now asks** | 616.64 and newer fault inside NVIDIA's own neural runtime. The app knew and said so in one line of a log followed by fifty saying "done". It asks once per driver version now, and still lets you install ([#229], [#258], [#104]) |
| **DirectDraw** | Gens, Kega Fusion and the other pre-Direct3D emulators are recognised at last. dgVoodoo, which this app already downloads for DX8 and DX9, translates DirectDraw too — it simply was never asked ([#150]) |
| **An older OptiScaler, per game** | 0.2.0-patch1 broke a game that 0.1.1.5 runs. Both are pinned by URL and digest, and a game may name either ([#238]) |
| **Feeder 0.15.1** | Including its HDR10 bridge, with both of its controls in the F8 panel. An HDR10 swapchain carries PQ BT.2020, which the consumer used to compose as if it were sRGB — which is where blown highlights came from |

### And nine things that were wrong

| | |
|---|---|
| **Every Feeder slider in the overlay was dead** | The panel pins the Feeder by size and digest before it will drive it, and that pin had been left behind by an earlier upgrade. Nothing failed and nothing was logged — the sliders simply did nothing. A check in the build refuses to produce that state again |
| **"No 3D executable found" said nothing useful** | It came out both for a folder with no game in it and for engines that load their renderer with `LoadLibrary` — X-Ray, Source, Source 2 — whose executables import no Direct3D. Those are recognised now, and the message says which case it is ([#232], [#199], [#217]) |
| **Adding one game's folder added its insides** | An Unreal game folder became two entries called "Engine" and "Binaries", and "Engine" then matched the artwork for Wallpaper Engine. A game folder is added as that game now ([#253]) |
| **A read-only ReShade.ini needed a reinstall** | 2.2.2 fixed the cause but only during an install, so anyone who updated and simply launched the game still met the error banner. Opening the game clears it ([#155]) |
| **"run npm run payload" reached people with no npm** | It named the wrong cause too: antivirus quarantine for an installed copy, and a half-finished self-extraction for the portable one. It says which, in words, and it says it at launch rather than at the moment you press Install ([#220]) |
| **The overlay panel could not be resized** | The grip lit up on hover and did nothing: one large invisible button covering the panel took the press first, and ImGui then refused the grip as a later item over an active one |
| **The panel closed itself during play** | Games that tear down a D3D12 device and build another took the panel's open state with them. One WinGDK title does that five times in 1.2 seconds |
| **The panel's own message appeared over the game** | ReShade shows log lines on screen, and the add-on wrote one every time it registered |
| **The Games header scrolled away** | With thirty games, the moment you want "Add a game" is the moment it is furthest away ([#231]) |

[Full 2.2.5 notes →](https://github.com/rakanki911/DLSS5-Swapper/releases/tag/v2.2.5)

[#104]: https://github.com/rakanki911/DLSS5-Swapper/issues/104
[#150]: https://github.com/rakanki911/DLSS5-Swapper/issues/150
[#155]: https://github.com/rakanki911/DLSS5-Swapper/issues/155
[#199]: https://github.com/rakanki911/DLSS5-Swapper/issues/199
[#217]: https://github.com/rakanki911/DLSS5-Swapper/issues/217
[#220]: https://github.com/rakanki911/DLSS5-Swapper/issues/220
[#229]: https://github.com/rakanki911/DLSS5-Swapper/issues/229
[#231]: https://github.com/rakanki911/DLSS5-Swapper/issues/231
[#232]: https://github.com/rakanki911/DLSS5-Swapper/issues/232
[#238]: https://github.com/rakanki911/DLSS5-Swapper/issues/238
[#253]: https://github.com/rakanki911/DLSS5-Swapper/issues/253
[#255]: https://github.com/rakanki911/DLSS5-Swapper/issues/255
[#258]: https://github.com/rakanki911/DLSS5-Swapper/issues/258
## Earlier releases

Each one is written up in full - what broke, why, and what was changed.

| | |
|---|---|
| **2.2.4** | [The Community page](docs/releases/v2.2.4.md) - compare notes with everyone else, plus eight faults fixed at the cause |
| **2.2.3** | [Six reported faults, fixed at the cause](docs/releases/v2.2.3.md) - OptiScaler on older cards, a game's own stale shader compiler, the overlay on a scaled display |
| **2.2.2** | [The reports people sent](docs/releases/v2.2.2.md) - games it could not find, installs it refused, the overlay's own page |
| **2.2.1** | [The Overlay page](docs/releases/v2.2.1.md) - themes you can write yourself, and a preview that runs before you choose |
| **2.2.0** | [Optional OptiScaler and a smarter library](docs/releases/v2.2.0.md) |

Every release also carries its own notes and downloads on the
[releases page](https://github.com/rakanki911/DLSS5-Swapper/releases).

## Compatibility

| Category | Support |
| --- | --- |
| **System** | Windows 10/11 x64; compatible 32-bit and 64-bit games |
| **ReShade / Feeder GPUs** | RTX 20 / 30 / 40 / 50; older-series support is reported by the bundled modified runtime's author |
| **OptiScaler GPUs** | 64-bit games with native DLSS enabled. The bundled neural model runs on **Blackwell** (RTX 50 / RTX PRO Blackwell); an older card needs a modded `nvngx_dlssnr.dll` you supply, which is never overwritten. Driver **616.56** recommended |
| **DirectX 12** | Native DLSS, Feeder, or eligible OptiScaler games |
| **DirectX 11** | Feeder for 32/64-bit games; eligible OptiScaler games |
| **DirectX 9 / 8** | DX9: 32/64-bit; DX8: 32-bit, through dgVoodoo2 → DX11 → Feeder |
| **Vulkan / OpenGL** | ReShade/Feeder; eligible Vulkan games can also use OptiScaler |
| **DirectX 10** | Not directly supported by Feeder; choose DX11 when available |
| **In-game overlay** | 64-bit DirectX 11 / 12 games with ReShade add-on support; **DLSS5-Feeder and RenoDX v4.7 only** |

OptiScaler's DX11/Vulkan path uses a DX12 bridge with FSR output by default.
For Vulkan backend changes, **restore originals first**. OptiScaler is not the emulator/non-DLSS route.

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
<p><img src="docs/screenshots/07-overlay.png" alt="The Overlay page with the Emerald, Azure and Amethyst themes" width="100%"></p>

## Before installing

- **Anti-cheat:** red warning and optional confirmation, not a blanket block. Injection can cause crashes or account bans; the app never bypasses anti-cheat.
- **Requirements:** Feeder needs Visual C++ runtimes (x64, plus x86 for 32-bit games). Some components download on first use.
- **Compatibility is not guaranteed.** Keep backups; existing mods may conflict. Not every reported game crash is fixed.
- **Linux/Proton:** experimental community source only; no Linux binaries in this release.

## Community and privacy

- Opening the Community page downloads public game reports. A live connection
  count is held only in memory; no connection identifiers are stored.
- A report is sent only after you review and submit the fields shown in its
  dialog: game, route, rendering API, result, optional comment, GPU, driver,
  CPU, OS and app version.
- The app uses a random install ID to prevent duplicate votes. The server stores
  only its hash. **Remove my community activity** hides all your reports and
  replies and resets your public community profile.
- The owner-only administrator access code is verified by the community server
  and stored locally with Windows encrypted storage. It is never written to the
  public profile or the normal community settings file.

## Support

DLSS 5 Swapper is free and MIT licensed. If it saved you an evening of
fiddling, you can buy me a coffee.

<p><a href="https://buymeacoffee.com/rakanki911"><img height="44" src="https://cdn.buymeacoffee.com/buttons/v2/lato-yellow.png" alt="Buy me a coffee"></a></p>

---

Built by **Rakan Alkhaldi** · MIT · [Third-party credits and licences](THIRD_PARTY_NOTICES.md)
