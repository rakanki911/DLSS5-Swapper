'use strict';
// Every user-facing string lives here. The core modules emit codes; this file
// is the only place that turns them into sentences.
//
// Wrapped in an IIFE: classic scripts share one global scope, and a bare
// top-level `t` here would collide with the one renderer.js destructures.
(function () {

const STRINGS = {
  en: {
    dir: 'ltr',

    appTitle: 'DLSS 5 Swapper',
    appSubtitle: 'Pick a game folder. I handle the rest.',
    settings: 'Settings',
    author: 'by Rakan Alkhaldi',
    change: 'Change',
    useBundled: 'Use bundled',
    insideApp: 'Inside the app',
    bundled: 'Bundled with the app',

    sourceLabel: 'DLSS 5 files',
    reshadeLabel: 'ReShade Setup (Addon build)',
    reshadeMissing: 'Not found — pick it manually if ReShade needs installing',
    notSet: 'Not set',

    dropTitle: 'Drop a game folder here',
    or: 'or',
    pickGame: 'Choose game folder',
    lastGame: 'Last game:',

    exeLabel: 'Game executable',
    filesFound: (n) => `Files found in the game (${n})`,
    noFilesFound: 'No DLSS files inside the game folder — they will be added next to the executable.',

    tileCurrentDlss: 'DLSS in the game',
    tileNewDlss: 'New DLSS',
    tileReShade: 'ReShade',
    tileDetection: 'Detected via',
    tileAddon: 'DLSS 5 add-on',
    noDlssFile: 'No file — uses the NVIDIA driver',
    sourceIncomplete: 'Source incomplete',
    notInstalled: 'Not installed',
    installed: 'Installed',
    notPresent: 'Not present',
    withAddons: ' + add-ons',
    withoutAddons: ' — no add-on support',

    viaImports: 'the import table',
    viaStrings: 'the binary itself (dynamic loading)',
    viaModule: (dll) => dll,

    optReShade: 'Install ReShade automatically when missing',
    optAddDlss: 'Add DLSS files when the game has none',
    optStreamline: 'Copy all Streamline files (sl.*) even if the game does not use them',
    optUpgradeAsi: (file, from, to) => `Update ${file} from ${from} to ${to} (in place, no extra dxgi.dll)`,
    optUpgradeProxy: (from, to) => `Update ReShade from ${from} to ${to}`,

    apply: 'Install DLSS 5',
    applying: 'Installing…',
    restoreBtn: 'Restore originals',
    anotherGame: 'Another game',
    logTitle: 'Log',
    openGameFolder: 'Open game folder',

    // --- warnings ---
    warnNoAddonSupport: 'The installed ReShade <b>does not support add-ons</b>. An Addon build will be installed over it.',
    warnAsi: (file) => `ReShade runs here as <b>${file}</b> through an ASI loader (a mod). No dxgi.dll will be added, so you never end up with two ReShades running.`,
    warnOlderReShade: (version) => `The DLSS 5 add-on is built against <b>ReShade API 18</b>. You have ${version} — if the add-on does not show up under Add-ons, tick the update option above.`,
    warnDynamic: 'This game loads DirectX dynamically (protected build), so the API was read from inside the executable. Double-check it is right.',
    warnModule: (dll) => `The renderer lives in <b>${dll}</b>, not in the executable, so the API was read from there.`,
    warnNoSetup: 'No <b>ReShade Setup</b> found — download the Addon build and pick it in Settings, or ReShade installation will be skipped.',
    warnNotDx12: (label) => `The DLSS 5 add-on only works on <b>DirectX 12</b>. This game uses ${label}.`,
    warnManyExes: 'More than one executable found. Make sure the right one is selected above.',

    // --- scan failures ---
    scanFailedToast: 'No game found in that folder',
    installer: 'This is an installer folder, not an installed game — it has setup.exe and .bin files. Install the game first, then pick its folder.',
    'no-exe': 'There is no .exe file in this folder. Make sure you picked the game folder itself.',
    'no-graphics-exe': 'There are executables here but none of them touch DirectX or Vulkan. Either the folder is wrong, or the game sits in a deeper subfolder.',

    // --- source status ---
    sourceMissing: 'Folder not found',
    sourceEmpty: 'No nvngx_ or sl. files in this folder',
    sourceFiles: (n) => `${n} files`,
    sourceHasNr: 'nvngx_dlssnr.dll ✔',
    sourceNoNr: 'nvngx_dlssnr.dll missing ✖',
    sourceHasAddon: 'add-on ✔',
    sourceNoAddon: '.addon64 missing ✖',

    // --- log events ---
    scanning: (dir) => `Scanning: ${dir}`,
    gamePicked: (rel, api, count) => `Game: ${rel} (${api}) — ${count} candidate executable(s)`,
    applyStart: '--- installing ---',
    restoreStart: '--- restoring originals ---',
    skipSameVersion: (p) => `Skipped ${p.rel} — already ${p.version}`,
    replaced: (p) => `Replaced ${p.rel}: ${p.from || '?'} -> ${p.to}`,
    added: (p) => `Added ${p.rel} (${p.version})`,
    addonInstalled: (p) => `Installed add-on ${p.name}`,
    runningSetup: (p) => `Running: "${p.setup}" ${p.args}`,
    reshadeInstalled: (p) => `Installed ReShade ${p.version} as ${p.file} — add-ons supported`,
    reshadeNoAddonSupport: 'Warning: ReShade installed without add-on support — you need the Addon build.',
    reshadeSetupMissing: 'Warning: no ReShade Setup found, that step was skipped.',
    reshadeAlreadyThere: (p) =>
      `ReShade ${p.version} already present${p.kind === 'asi' ? ` (${p.file} via ASI loader)` : ` as ${p.file}`}${p.addonSupport ? ', add-ons supported' : ''}`,
    reshadeNewerAvailable: (p) => `Note: a newer build is available (${p.version}) — enable the update option if the add-on does not load.`,
    asiUpgraded: (p) => `Updated ${p.file}: ${p.from} -> ${p.to} (no second dxgi.dll added)`,
    proxyUpgraded: (p) => `Updated ReShade: ${p.from} -> ${p.to}`,
    addonEnabledInIni: 'Enabled the add-on in ReShade.ini',
    applyDone: 'Done. Launch the game, press Home and check the Add-ons tab.',
    restored: (p) => `Restored ${p.rel}${p.version ? ` to ${p.version}` : ''}`,
    deleted: (p) => `Deleted ${p.rel}`,
    restoreDone: 'Everything restored.',
    doneToast: (n) => `Done — ${n} file(s)`,
    restoreToast: 'Original files restored',

    // --- errors ---
    errNoWriteAccess: 'No write access to the game folder. Run this app as administrator.',
    errNoNeuralRuntime: 'nvngx_dlssnr.dll is missing from the source folder, and the add-on will not run without it.',
    errReShadeExtract: (p) => `Could not extract the new ReShade (exit ${p.exit}). ${p.output || ''}`.trim(),
    errReShadeUpgrade: (p) => `ReShade update failed (exit ${p.exit}). ${p.output || ''}`.trim(),
    errReShadeInstall: (p) => `ReShade installation failed (exit ${p.exit}). ${p.output || ''}`.trim(),
    errNoBackup: 'There is no backup for this game.'
  },

  ar: {
    dir: 'rtl',

    appTitle: 'مبدّل DLSS 5',
    appSubtitle: 'اختر مجلد اللعبة، والباقي عليّ.',
    settings: 'الإعدادات',
    author: 'بواسطة راكان الخالدي',
    change: 'تغيير',
    useBundled: 'استخدم المدمج',
    insideApp: 'داخل البرنامج',
    bundled: 'مدمج مع البرنامج',

    sourceLabel: 'ملفات DLSS 5',
    reshadeLabel: 'ReShade Setup (نسخة Addon)',
    reshadeMissing: 'غير موجود — حدده يدوياً إذا احتجت تثبيت ReShade',
    notSet: 'غير محدد',

    dropTitle: 'اسحب مجلد اللعبة هنا',
    or: 'أو',
    pickGame: 'اختر مجلد اللعبة',
    lastGame: 'آخر لعبة:',

    exeLabel: 'ملف تشغيل اللعبة',
    filesFound: (n) => `الملفات المكتشفة في اللعبة (${n})`,
    noFilesFound: 'ما فيه أي ملف DLSS داخل مجلد اللعبة — البرنامج بيضيفهم بجانب ملف التشغيل.',

    tileCurrentDlss: 'DLSS الحالي في اللعبة',
    tileNewDlss: 'DLSS الجديد',
    tileReShade: 'ReShade',
    tileDetection: 'طريقة الكشف',
    tileAddon: 'أدون DLSS 5',
    noDlssFile: 'ما فيه ملف — يستخدم درايفر NVIDIA',
    sourceIncomplete: 'المصدر ناقص',
    notInstalled: 'غير مثبت',
    installed: 'مركّب',
    notPresent: 'غير مركّب',
    withAddons: ' + أدونز',
    withoutAddons: ' — بدون أدونز',

    viaImports: 'جدول الاستيراد',
    viaStrings: 'داخل الملف نفسه (تحميل ديناميكي)',
    viaModule: (dll) => dll,

    optReShade: 'تثبيت ReShade تلقائياً إذا كان ناقص',
    optAddDlss: 'إضافة ملفات DLSS إذا اللعبة ما فيها أصلاً',
    optStreamline: 'نسخ ملفات Streamline كاملة (sl.*) حتى لو اللعبة ما تستخدمها',
    optUpgradeAsi: (file, from, to) => `حدّث ${file} من ${from} إلى ${to} (بمكانه، بدون dxgi.dll إضافي)`,
    optUpgradeProxy: (from, to) => `حدّث ReShade من ${from} إلى ${to}`,

    apply: 'ركّب DLSS 5',
    applying: 'جاري التركيب…',
    restoreBtn: 'رجّع الأصلي',
    anotherGame: 'لعبة ثانية',
    logTitle: 'السجل',
    openGameFolder: 'افتح مجلد اللعبة',

    warnNoAddonSupport: 'ReShade المثبت حالياً <b>ما يدعم الأدونز</b>. البرنامج بيثبت نسخة Addon فوقه.',
    warnAsi: (file) => `ReShade عندك يشتغل كـ <b>${file}</b> عن طريق ASI loader (مود). البرنامج <b>ما بيضيف dxgi.dll</b> عشان ما تصير نسختين شغالات.`,
    warnOlderReShade: (version) => `أدون DLSS 5 مبني على <b>ReShade API 18</b>. عندك ${version} — لو الأدون ما ظهر في تبويب Add-ons، فعّل خيار التحديث فوق.`,
    warnDynamic: 'هذي اللعبة تحمّل DirectX ديناميكياً (نسخة محمية)، فعرفت النوع من داخل الملف نفسه. تأكد إنه صحيح.',
    warnModule: (dll) => `المحرّك الرسومي في <b>${dll}</b> مو في ملف التشغيل، فعرفت النوع من هناك.`,
    warnNoSetup: 'ما لقيت <b>ReShade Setup</b> — نزّل نسخة Addon وحددها من الإعدادات، وإلا بيتم تخطي تثبيت ReShade.',
    warnNotDx12: (label) => `أدون DLSS 5 يشتغل على <b>DirectX 12</b> فقط. هذي اللعبة تستخدم ${label}.`,
    warnManyExes: 'فيه أكثر من ملف تشغيل. تأكد إنك اخترت الصح من القائمة فوق.',

    scanFailedToast: 'ما لقيت لعبة في هذا المجلد',
    installer: 'هذا مجلد تنصيب مو لعبة مثبتة — فيه setup.exe وملفات .bin. ثبّت اللعبة أول وبعدين اختر مجلدها.',
    'no-exe': 'ما فيه أي ملف .exe في هذا المجلد. تأكد إنك اخترت مجلد اللعبة نفسه.',
    'no-graphics-exe': 'فيه ملفات exe لكن ما فيها أي أثر لـDirectX أو Vulkan. غالباً المجلد غلط، أو اللعبة داخل مجلد فرعي أعمق.',

    sourceMissing: 'المجلد غير موجود',
    sourceEmpty: 'ما فيه ملفات nvngx_ أو sl. في هذا المجلد',
    sourceFiles: (n) => `${n} ملف`,
    sourceHasNr: 'فيه nvngx_dlssnr.dll ✔',
    sourceNoNr: 'ناقص nvngx_dlssnr.dll ✖',
    sourceHasAddon: 'فيه الأدون ✔',
    sourceNoAddon: 'ناقص ملف .addon64 ✖',

    scanning: (dir) => `فحص: ${dir}`,
    gamePicked: (rel, api, count) => `اللعبة: ${rel} (${api}) — ${count} ملف تشغيل محتمل`,
    applyStart: '--- بداية التركيب ---',
    restoreStart: '--- إرجاع الملفات الأصلية ---',
    skipSameVersion: (p) => `تخطي ${p.rel} — نفس الإصدار ${p.version}`,
    replaced: (p) => `تبديل ${p.rel}: ${p.from || '؟'} ← ${p.to}`,
    added: (p) => `إضافة ${p.rel} (${p.version})`,
    addonInstalled: (p) => `تركيب الأدون ${p.name}`,
    runningSetup: (p) => `تشغيل: "${p.setup}" ${p.args}`,
    reshadeInstalled: (p) => `تم تثبيت ReShade ${p.version} باسم ${p.file} — يدعم الأدونز`,
    reshadeNoAddonSupport: 'تحذير: ReShade مثبت بدون دعم الأدونز — لازم نسخة Addon من الموقع الرسمي.',
    reshadeSetupMissing: 'تحذير: ما لقيت ملف تثبيت ReShade، تم تخطي هذي الخطوة.',
    reshadeAlreadyThere: (p) =>
      `ReShade ${p.version} موجود مسبقاً${p.kind === 'asi' ? ` (${p.file} عبر ASI loader)` : ` باسم ${p.file}`}${p.addonSupport ? ' ويدعم الأدونز' : ''}`,
    reshadeNewerAvailable: (p) => `ملاحظة: فيه إصدار أحدث (${p.version}) — فعّل خيار التحديث إذا الأدون ما اشتغل.`,
    asiUpgraded: (p) => `تحديث ${p.file}: ${p.from} ← ${p.to} (بدون ما نضيف dxgi.dll ثاني)`,
    proxyUpgraded: (p) => `تحديث ReShade: ${p.from} ← ${p.to}`,
    addonEnabledInIni: 'تم تفعيل الأدون داخل ReShade.ini',
    applyDone: 'تم. شغل اللعبة واضغط Home ثم تبويب Add-ons للتأكد.',
    restored: (p) => `إرجاع ${p.rel}${p.version ? ` إلى ${p.version}` : ''}`,
    deleted: (p) => `حذف ${p.rel}`,
    restoreDone: 'تم الإرجاع بالكامل.',
    doneToast: (n) => `تم — ${n} ملف`,
    restoreToast: 'رجّعنا الملفات الأصلية',

    errNoWriteAccess: 'ما فيه صلاحية كتابة في مجلد اللعبة. شغّل البرنامج كمسؤول (Run as administrator).',
    errNoNeuralRuntime: 'ملف nvngx_dlssnr.dll غير موجود في مجلد المصدر، والأدون ما يشتغل بدونه.',
    errReShadeExtract: (p) => `فشل استخراج ReShade الجديد (رمز ${p.exit}). ${p.output || ''}`.trim(),
    errReShadeUpgrade: (p) => `فشل تحديث ReShade (رمز ${p.exit}). ${p.output || ''}`.trim(),
    errReShadeInstall: (p) => `فشل تثبيت ReShade (رمز ${p.exit}). ${p.output || ''}`.trim(),
    errNoBackup: 'ما فيه نسخة احتياطية لهذي اللعبة.'
  }
};

let current = 'en';

function setLang(lang) {
  current = STRINGS[lang] ? lang : 'en';
  return current;
}

function getLang() {
  return current;
}

// Looks up a key and, when the entry is a function, calls it with the rest of
// the arguments. Unknown keys fall back to the key itself so a missing string
// is visible rather than silently blank.
function t(key, ...args) {
  const entry = STRINGS[current][key];
  if (entry === undefined) return String(key);
  return typeof entry === 'function' ? entry(...args) : entry;
}

window.i18n = { t, setLang, getLang, STRINGS };
})();
