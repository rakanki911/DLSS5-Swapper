# Simplified Chinese localization

This change extends the existing `zh` locale. It does not promise that every
English string from every third-party component has been translated.

## Application and overlay UI

- Add the missing main-window strings, plus Chinese chat and community catalogs.
- Translate native file dialogs, diagnostics prompts, overlay themes, hotkey
  dialogs, previews, connection messages and live controls.
- Load `overlay-i18n.js` before the panel scripts in both the main window and
  standalone overlay surface. Pass the selected language to that surface and
  refresh it when the language changes.
- Use the existing ReShade font for the native on-screen status label; measure
  and draw the same Chinese text.

English and Arabic catalogs remain available. User-authored chat messages,
community comments, custom theme names, game names and hardware names are not
automatically translated or sent to an additional translation service.

## Installed shader UI

For an install requested with `language: 'zh'`, `game-ui-localization.js`:

1. Sets `OVERLAY.Language=zh-CN` in existing ReShade configuration files.
2. Finds managed `.fx` and `.fxh` files below the selected executable's
   `reshade-shaders/Shaders` directory.
3. Translates display strings after the original payload integrity checks.
4. Writes through the existing tracked-file writer and install recovery flow.

`shader-i18n.js` contains 378 translation entries for the bundled Feeder, VORT
and Lumenite shader families. Its tokenizer limits replacements to display
annotations/macros and user-visible preprocessor diagnostics. It also supplies
display labels for two known techniques without renaming their identifiers.
Unknown strings are left as they are. Shader identifiers, expressions, numeric
values, include paths, option order and option count are preserved.

Other application languages do not trigger these copied-file translations.
Changing the application language later does not automatically reverse a
previously translated game install. ReShade's existing global Vulkan ownership
and recoverable partial-install behavior are unchanged.

## Experimental native menu adapter

The native overlay can translate the Feeder and RenoDX menus for two exact
add-on files. This is a version-specific UI adapter, not a modification to
those add-ons' on-disk binaries or rendering algorithms.

| Add-on | Size | SHA-256 |
| --- | ---: | --- |
| Feeder 1.17.0 | 329728 | `6854d012eac307021cd31c978bafd42f1e22c5b7b2922c80e0a0010d428a3fd7` |
| RenoDX 6.5.3 | 878080 | `342341f669f1d64e0c70c8593a07a2fab5075e073dfae97c331c9a6776260a0a` |

- There are 299 explicit translations, with additional handling for known
  formatted status messages.
- The adapter checks the file hash, the pinned initialization instruction
  sequence, the writable table slot, and the original interface identity.
- It replaces only each verified add-on's private ImGui interface slot using
  compare/exchange. It never edits ReShade's shared interface table or chains
  an unrecognized replacement.
- Widget arguments, value pointers, ranges, flags, option order and option
  count are forwarded unchanged. Format-string conversions are checked for
  exact signature compatibility; displayed text is never used as an arbitrary
  format string.
- The existing RenoDX control scraper temporarily uses the original English
  interface so its field matching and saved setting keys remain unchanged.
- Ordinary translated widget labels have new, stable UI identities; existing
  `###` identities are retained. Fold/focus state may reset once when switching
  language. This does not reset the underlying effect settings.
- The wrapper module is pinned until process exit before any wrapper is
  published. Shutdown waits for the temporary capture table, restores owned
  slots, prevents late reinstallation and clears add-on identity caches.
- Unrecognized add-on versions and interface replacements are left untouched.
  Unsupported or unknown status text falls back to its original wording.

The native adapter follows ReShade's Chinese `OVERLAY.Language` setting. Its
translations are Simplified Chinese. It currently recognizes `zh`, `zh-*` and
`zh_*`, including Traditional Chinese ReShade locales; this is not full
Traditional Chinese localization. The pre-existing RenoDX v4.7 controls
bridge is retained, but v4.7 native menu translation is outside these pins.

ReShade's built-in Generic Depth and Effect Runtime Sync pages, add-on metadata,
third-party licenses, raw logs and technical identifiers remain in their
original language. The Swapper help tab includes Chinese explanations of the
built-in pages. The native overlay must be rebuilt to ship its new menu
translations; no generated DLL or payload is included in this source change.

## Validation and limits

Before submission:

- JavaScript syntax and English/Chinese catalog keys, value types and function
  arities were checked. The assembled main catalog has 303 entries in both
  English and Chinese.
- An offline audit of 34 shader files checked display-only changes, option
  counts, idempotence and unchanged non-display shader code.
- Isolated install checks covered English no-op behavior, Chinese tracked
  writes, and recovery from a deliberately failed file transaction.
- The native sources were built with MSVC C++17 against the existing pinned
  ReShade/ImGui SDK versions.
- An isolated DX11 host loaded the unmodified add-ons and rebuilt overlay,
  confirmed both add-ons used the translator's private interface table,
  captured a readable Chinese status label, and exited normally.
- The installed application's settings, community popup and overlay preview
  were visually checked in Chinese.

These checks are not a full game acceptance test. Real-game shader compilation,
all native menu layouts, interaction and saved-setting behavior still require
in-game validation. No rendering compatibility or visual-quality claim is made.
