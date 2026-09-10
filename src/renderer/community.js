'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = {
    en: {
      title: 'Community-tested games', subtitle: 'Real results from DLSS 5 Swapper users.', refresh: 'Refresh', search: 'Search games', route: 'Route', api: 'Rendering API', result: 'Result',
      allRoutes: 'All routes', allApis: 'All APIs', allResults: 'All results', working: 'Working', issues: 'Works with issues', broken: 'Not working', mixed: 'Mixed', clear: 'Clear filters', loading: 'Loading community results…', empty: 'No matching community reports yet.', offline: 'Community service is unavailable. Check your connection and try again.',
      reports: n => `${n} report${n === 1 ? '' : 's'}`, comments: n => `${n} comment${n === 1 ? '' : 's'}`, noComments: 'No comments yet.', updated: 'Live updates are on while this card is open.',
      share: 'Share your result', shareHint: 'Share your result and help the community.', why: 'Your report helps improve compatibility for everyone.', routeUsed: 'Route used', choose: 'Choose…', unknown: 'No results yet', yourResult: 'Your result', optionalComment: 'Optional comment', sent: 'Data that will be sent', cancel: 'Cancel', submit: 'Submit report', submitting: 'Submitting…', chooseRoute: 'Choose the route you actually used.', chooseVerdict: 'Choose your result.', sentOk: 'Your report was added to the community.',
      profile: 'Community profile', profileHint: 'Your fixed avatar and display name appear beside your comments. A name can change once a week.', displayName: 'Display name', chooseIcon: 'Choose an avatar', save: 'Save profile', saved: 'Profile saved.', adminMode: 'Administrator mode', adminModeHint: 'Your replies are sent with your official name, avatar and ADMIN badge.', adminLogout: 'Sign out of administrator mode', adminLoggedOut: 'Administrator mode signed out.', unnamed: 'Anonymous', addGame: 'Add to community-tested games', reactionFailed: 'Could not save that reaction.',
      liveCount: 'The service keeps only a live connection count in memory; it stores no connection identifiers.', removeMine: 'Remove my community activity', removeConfirm: 'Hide all your reports and replies and reset your public community profile? This cannot be undone from the app.', removing: 'Removing…', removedMine: (reports, replies) => `Removed ${reports} report${reports === 1 ? '' : 's'} and ${replies} repl${replies === 1 ? 'y' : 'ies'} from public view.`,
      reply: 'Reply', back: 'Back to all results', noReplies: 'No replies yet. Be the first.',
      edit: 'Edit', remove: 'Delete', mine: 'You', saveEdit: 'Save', cancelEdit: 'Cancel',
      removeReport: 'Delete my report', editReport: 'Edit my report', shareAgain: 'Edit your result',
      removeReportTitle: 'Delete report?', removeReplyTitle: 'Delete reply?', removeMineTitle: 'Remove everything you have written?',
      removeReportAsk: 'Delete your report on this game? If nobody else has reported it, the game leaves the community list.',
      removeReplyAsk: 'Delete this reply?', removed: 'Deleted.', follow: 'Notify me about this game',
      unfollow: 'Stop notifying me', following: 'Notifications on', mention: 'Mention somebody',
      noticeReplied: (who, game) => `${who} replied to you on ${game}`,
      noticeMentioned: (who, game) => `${who} mentioned you on ${game}`,
      noticeOnGame: (who, game) => `${who} commented on ${game}`,
      noticeMany: n => `${n} new community messages`, noticeSomeone: 'Someone',
      sentTitle: 'Report sent', sentNote: 'Your result is on the community page for this game. Thank you.',
      sentGo: 'Go to my comment', sentStay: 'Done',
      failTitle: 'Not sent', failNote: 'Nothing was saved. Your text is still in the form, so you can try again.',
      failGo: 'Try again', failStay: 'Close', silentReport: 'No comment - only your result was sent.',
      replyingTo: 'Replying to',
      showing: (route, n) => `${route} · ${n} ${n === 1 ? 'result' : 'results'}`, showAll: 'Show all routes',
      replyPlaceholder: 'Reply to this result…', send: 'Send',
      pinnedAnnouncement: 'Pinned announcement', copyMessage: 'Copy message', replyMention: 'Reply with mention',
      hideMessage: 'Hide message', blockAuthor: 'Block author', copied: 'Message copied.', moderationDone: 'Moderation applied.',
      gameTotal: n => `${n.toLocaleString()} game${n === 1 ? '' : 's'}`,
      facts: { title: 'Game', route: 'Route', api: 'API', gpu: 'GPU', driver: 'Driver', cpu: 'CPU', os: 'OS', app: 'App version' }
    },
    ar: {
      title: 'ألعاب اختبرها المجتمع', subtitle: 'نتائج حقيقية من مستخدمي DLSS 5 Swapper.', refresh: 'تحديث', search: 'بحث عن لعبة', route: 'طريقة التثبيت', api: 'واجهة الرسوم', result: 'النتيجة',
      allRoutes: 'كل الطرق', allApis: 'كل الواجهات', allResults: 'كل النتائج', working: 'تعمل', issues: 'تعمل مع مشاكل', broken: 'لا تعمل', mixed: 'نتائج مختلطة', clear: 'مسح الفلاتر', loading: 'جاري تحميل نتائج المجتمع…', empty: 'لا توجد تقارير مطابقة حتى الآن.', offline: 'خدمة المجتمع غير متاحة. تحقق من اتصالك وحاول مجددًا.',
      reports: n => `${n} تقرير`, comments: n => `${n} تعليق`, noComments: 'لا توجد تعليقات بعد.', updated: 'التحديث المباشر يعمل أثناء فتح هذه البطاقة.',
      share: 'شارك نتيجتك', shareHint: 'شارك نتيجتك وساعد المجتمع.', why: 'بلاغك يحسّن التوافق للجميع.', routeUsed: 'طريقة التثبيت المستخدمة', choose: 'اختر…', unknown: 'لا نتائج بعد', yourResult: 'نتيجتك', optionalComment: 'تعليق اختياري', sent: 'البيانات التي سيتم إرسالها', cancel: 'إلغاء', submit: 'إرسال التقرير', submitting: 'جاري الإرسال…', chooseRoute: 'اختر طريقة التثبيت التي استخدمتها فعليًا.', chooseVerdict: 'اختر نتيجتك.', sentOk: 'تمت إضافة تقريرك إلى المجتمع.',
      profile: 'ملف المجتمع', profileHint: 'تظهر صورتك الثابتة واسمك بجانب تعليقاتك. يمكن تغيير الاسم مرة كل أسبوع.', displayName: 'اسم العرض', chooseIcon: 'اختر صورة', save: 'حفظ الملف', saved: 'تم حفظ الملف.', adminMode: 'وضع الإدارة', adminModeHint: 'ستُرسل ردودك باسمك وصورتك الرسمية مع شارة ADMIN.', adminLogout: 'تسجيل الخروج من وضع الإدارة', adminLoggedOut: 'تم تسجيل الخروج من وضع الإدارة.', unnamed: 'مجهول', addGame: 'إضافة إلى الألعاب المختبرة من المجتمع', reactionFailed: 'تعذر حفظ التفاعل.',
      liveCount: 'تحتفظ الخدمة بعدد الاتصالات المباشرة في الذاكرة فقط، ولا تخزن معرّفات الاتصال.', removeMine: 'إزالة نشاطي من المجتمع', removeConfirm: 'إخفاء جميع تقاريرك وردودك وإعادة ملفك العام للوضع الافتراضي؟ لا يمكن التراجع من داخل البرنامج.', removing: 'جاري الإزالة…', removedMine: (reports, replies) => `تم إخفاء ${reports} تقرير و${replies} رد من العرض العام.`,
      reply: 'رد', back: 'الرجوع إلى كل النتائج', noReplies: 'لا ردود بعد. كن أول من يرد.',
      edit: 'تعديل', remove: 'حذف', mine: 'أنت', saveEdit: 'حفظ', cancelEdit: 'إلغاء',
      removeReport: 'حذف تقييمي', editReport: 'تعديل تقييمي', shareAgain: 'تعديل نتيجتك',
      removeReportTitle: 'حذف التقييم؟', removeReplyTitle: 'حذف الرد؟', removeMineTitle: 'إزالة كل ما كتبته؟',
      removeReportAsk: 'حذف تقييمك لهذه اللعبة؟ إن لم يقيّمها أحد غيرك فستختفي من قائمة المجتمع.',
      removeReplyAsk: 'حذف هذا الرد؟', removed: 'تم الحذف.', follow: 'نبّهني عن هذه اللعبة',
      unfollow: 'إيقاف التنبيه', following: 'التنبيهات مفعّلة', mention: 'أشر إلى شخص',
      noticeReplied: (who, game) => `${who} ردّ عليك في ${game}`,
      noticeMentioned: (who, game) => `${who} أشار إليك في ${game}`,
      noticeOnGame: (who, game) => `${who} علّق على ${game}`,
      noticeMany: n => `${n} رسائل جديدة من المجتمع`, noticeSomeone: 'أحدهم',
      sentTitle: 'تم إرسال التقرير', sentNote: 'نتيجتك الآن في صفحة المجتمع لهذه اللعبة. شكرًا لك.',
      sentGo: 'اذهب إلى تعليقي', sentStay: 'تم',
      failTitle: 'لم يُرسل', failNote: 'لم يُحفظ شيء. نصّك ما زال في النموذج فيمكنك المحاولة مرة أخرى.',
      failGo: 'حاول مجددًا', failStay: 'إغلاق', silentReport: 'بلا تعليق — أُرسلت نتيجتك وحدها.',
      replyingTo: 'ردًّا على',
      showing: (route, n) => `${route} · ${n} نتيجة`, showAll: 'عرض كل الطرق',
      replyPlaceholder: 'ردّ على هذه النتيجة…', send: 'إرسال',
      pinnedAnnouncement: 'إعلان مثبّت', copyMessage: 'نسخ الرسالة', replyMention: 'رد مع منشن',
      hideMessage: 'إخفاء الرسالة', blockAuthor: 'حظر الكاتب', copied: 'تم نسخ الرسالة.', moderationDone: 'تم تنفيذ الإجراء.',
      gameTotal: n => `${n.toLocaleString('ar')} لعبة`,
      facts: { title: 'اللعبة', route: 'الطريقة', api: 'الواجهة', gpu: 'كرت الشاشة', driver: 'التعريف', cpu: 'المعالج', os: 'النظام', app: 'إصدار البرنامج' }
    }
  };
  const avatars = ['🎮','🚀','⚡','🛡️','🔥','⭐','🎯','🕹️','👾','🤖','🐉','🦊','🐺','🦁','🦅','🐙','🌌','🌙','☀️','💎','🔧','🧪','🏁','🎧'];
  // The heart first: it is the one people reach for. The rest keep the order
  // they have always had, so nobody's muscle memory moves.
  const REACTIONS = ['❤️', '👍', '🔥', '🎉', '😕'];
  const MINE_KEY = 'community-reactions';
  // Which reactions this install has pressed. Local because the card itself is
  // cached and shared; the server stays the authority on the counts, and a
  // stale entry here only costs one request it ignores.
  const readMine = () => { try { return JSON.parse(localStorage.getItem(MINE_KEY)) || {}; } catch { return {}; } };
  const state = { art: {}, thread: null, route: null, me: null, admin: null, watching: [], editing: null, mentions: [], cards: [], filters: { q: '', route: 'all', api: 'all', status: 'all' }, active: null, etag: null, timer: null, report: null, verdict: null, mine: readMine() };
  // A report can only be corrected from the game it was written about - the
  // dialog reads the folder to fill itself in. Which folder that was is
  // remembered here, keyed by the card the server filed it under.
  const OWN_KEY = 'community-my-reports';
  const readOwn = () => { try { return JSON.parse(localStorage.getItem(OWN_KEY)) || {}; } catch { return {}; } };
  let own = readOwn();
  const saveOwn = () => { try { localStorage.setItem(OWN_KEY, JSON.stringify(own)); } catch { /* storage off */ } };
  const mineFor = key => (key && own[key]) || null;
  const mineForDir = dir => Object.entries(own).find(([, value]) => value.dir === dir) || null;
  function rememberMine(key, dir, report) {
    if (!key || !dir) return;
    own[key] = { dir, report };
    saveOwn();
  }

  async function syncOwnReports() {
    const answer = await window.lab.communityMyReports();
    // Offline or an older server must not erase valid local state. Only a
    // successful authoritative answer is allowed to reconcile the shortcuts.
    if (!answer?.ok || !Array.isArray(answer.result?.reports)) return false;
    const live = new Set(answer.result.reports.map(item => String(item.id)));
    let changed = false;
    for (const [key, value] of Object.entries(own)) {
      if (value?.report == null || live.has(String(value.report))) continue;
      delete own[key];
      changed = true;
    }
    if (changed) saveOwn();
    return changed;
  }
  function forgetMine(key) {
    if (!key || !own[key]) return;
    delete own[key];
    saveOwn();
  }

  const saveMine = () => { try { localStorage.setItem(MINE_KEY, JSON.stringify(state.mine)); } catch { /* private window, or storage off */ } };
  const text = () => L[(window.i18n?.getLang?.() || 'en').startsWith('ar') ? 'ar' : 'en'];
  const totals = verdicts => Object.values(verdicts || {}).reduce((sum, row) => ({ green: sum.green + (row.green || 0), yellow: sum.yellow + (row.yellow || 0), red: sum.red + (row.red || 0) }), { green: 0, yellow: 0, red: 0 });
  const statusClass = status => ['working', 'mixed', 'broken'].includes(status) ? status : 'unknown';
  const statusText = status => status === 'working' ? text().working : status === 'broken' ? text().broken : status === 'mixed' ? text().mixed : text().unknown;
  // A stable colour per game, so a card without a poster is still recognisably
  // that game rather than one more grey rectangle.
  const hueOf = title => { let h = 0; for (const c of String(title)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  // Three numbers, read out of the game's own art in the main process. Without
  // art - or from a poster with no colour in it - the title still decides, so
  // every card is lit by something rather than by nothing.
  //
  // Saturation and lightness are pulled towards the middle: a poster that is
  // almost pure black or a screaming neon would otherwise make a sheet nobody
  // can read text on. The picture chooses the colour; the app chooses how loud.
  function tintOf(title, palette) {
    if (!palette || typeof palette.hue !== 'number') {
      return { hue: hueOf(title), sat: 46, light: 24 };
    }
    // A floor so a nearly-grey poster still says something, and a ceiling so a
    // neon one does not shout the text down. Everything the stylesheet builds
    // scales these further, up for an accent and far down for a surface.
    return {
      hue: Math.round(palette.hue),
      sat: Math.round(Math.min(0.88, Math.max(0.34, palette.sat)) * 100),
      light: Math.round(Math.min(0.40, Math.max(0.16, palette.light)) * 100)
    };
  }

  // The custom properties are registered in the stylesheet, so writing them
  // animates rather than jumps; one card fades into the next.
  function paintTint(node, title, palette) {
    if (!node) return;
    const tint = tintOf(title, palette);
    node.style.setProperty('--card-hue', `${tint.hue}deg`);
    node.style.setProperty('--card-sat', `${tint.sat}%`);
    node.style.setProperty('--card-light', `${tint.light}%`);
  }

  async function paletteFromImage(image) {
    if (!image || !image.complete || !image.naturalWidth) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 12; canvas.height = 12;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, 12, 12);
      return await window.lab.communityPalette(Array.from(context.getImageData(0, 0, 12, 12).data));
    } catch { return null; }
  }

  // Read the pixels from pictures the browser has already loaded. The images
  // come from our CORS-enabled API, so this restores the poster-driven colour
  // without downloading Steam artwork again on every desktop.
  function wirePalette(card, nodes, painted = []) {
    const images = [...nodes].filter(Boolean);
    const apply = async () => {
      if (!images.every(image => image.complete)) return;
      const palette = await window.lab.communityMergePalettes(await Promise.all(images.map(paletteFromImage)));
      if (!palette) return;
      const art = state.art[card.key] || (state.art[card.key] = {});
      art.palette = palette;
      for (const node of painted) paintTint(node, card.title, palette);
    };
    for (const image of images) if (!image.complete) image.addEventListener('load', apply, { once: true });
    apply();
  }
  const initialsOf = title => String(title || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  // Posters are fetched one at a time after the grid is already on screen: the
  // page must never wait on a picture, and Steam's store is rate limited.
  async function fetchArt(cards) {
    for (const card of cards) {
      if (state.art[card.key] !== undefined) continue;
      state.art[card.key] = null;
      let answer = null;
      try { answer = await window.lab.communityArt(card.key, card.title); } catch { /* offline */ }
      state.art[card.key] = answer && answer.cover ? answer : null;
      if (answer && answer.cover && state.cards.some(item => item.key === card.key)) paintCards();
    }
  }

  // One shape per route, so the eye tells them apart before it reads them.
  // Every glyph in the report dialog, drawn rather than shipped so they take
  // the theme with them and cost no load.
  const ICON = {
    route: '<path d="M12 2a5 5 0 0 1 5 5c0 3.5-5 13-5 13S7 10.5 7 7a5 5 0 0 1 5-5z"/><circle cx="12" cy="7" r="2"/>',
    api: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-2.9-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.1-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.2V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11h.2a2 2 0 1 1 0 4z"/>',
    result: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    comment: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z"/>',
    game: '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v3m-1.5-1.5h3M16 12h.01M18.5 14h.01"/>',
    gpu: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 18v2M17 18v2M8 10h8v4H8z"/>',
    cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3"/>',
    driver: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    os: '<path d="M3 5.5 10.5 4.4v7.1H3zM12.5 4.1 21 3v8.5h-8.5zM3 12.5h7.5v7.1L3 18.5zM12.5 12.5H21V21l-8.5-1.1z"/>',
    app: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
    player: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    tag: '<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
    sent: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    send: '<path d="m4 12 16-8-6 8 6 8z"/><path d="M4 12h10"/>',
    check: '<path d="m5 13 4 4L19 7"/>'
  };
  const icon = (name, cls = '') =>
    `<svg class="c-icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ''}</svg>`;

  const ROUTE_MARK = {
    feeder: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 1 8 8"/><path d="m8 16-4 4 4 4" transform="translate(0 -8)"/></svg>',
    renodx: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
    optiscaler: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 15V9h3a3 3 0 0 1 0 6z"/></svg>'
  };

  // "3 days ago" rather than a timestamp: on a page of opinions, how old one is
  // matters more than when exactly it was written.
  function ago(at) {
    const when = Number(at);
    if (!Number.isFinite(when) || when <= 0) return '';
    const seconds = Math.round((when - Date.now()) / 1000);
    const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
    let value = seconds, unit = 'second';
    for (const [size, name] of steps) {
      if (Math.abs(value) < size) { unit = name; break; }
      value /= size; unit = name;
    }
    try { return new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', { numeric: 'auto' }).format(Math.round(value), unit); }
    catch { return ''; }
  }

  // A comment is mine when its tag is mine. The tag comes from the one call
  // that is about this install alone, so it is right even for somebody who has
  // never set a name.
  const isMine = by => Boolean(state.me?.tag) && by?.tag === state.me.tag && !by?.admin;
  const isAdminMine = by => Boolean(state.admin?.id) && by?.admin === true && by?.id === state.admin.id;
  const watchingNow = key => state.watching.includes(key);

  async function loadMe() {
    const [answer, profile] = await Promise.all([window.lab.communityNotices(), window.lab.communityProfile()]);
    state.admin = profile?.admin || null;
    if (!answer?.ok || !answer.result) return;
    state.me = answer.result.me || null;
    state.watching = answer.result.watching || [];
  }

  const avatar = by => by?.avatar
    ? `<img class="community-admin-avatar" src="${esc(by.avatar)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="community-avatar" aria-hidden="true">${avatars[Number(by?.icon) || 0] || avatars[0]}</span>`;
  const identity = by => `<b>${esc(by?.name || text().unnamed)}</b>${by?.admin
    ? '<span class="community-admin-badge">ADMIN</span>'
    : `<small>#${esc(by?.tag || '----')}</small>`}`;

  function applyLanguage() {
    const s = text();
    const values = { communityTitle: s.title, communitySubtitle: s.subtitle, communityRefresh: s.refresh, communitySearchLabel: s.search, communityRouteLabel: s.route, communityApiLabel: s.api, communityStatusLabel: s.result, communityClear: s.clear, communityReportRouteLabel: s.routeUsed, communityReportApiLabel: s.api, communityVerdictLabel: s.yourResult, communityCommentLabel: s.optionalComment, communityPrivacyTitle: s.sent, communityWhy: s.why, communityReportCancel: s.cancel, communityReportSubmit: s.submit };
    for (const [id, value] of Object.entries(values)) if ($(id)) $(id).textContent = value;
    const setOption = (id, value, label) => { const option = $(id)?.querySelector(`option[value="${value}"]`); if (option) option.textContent = label; };
    setOption('communityRoute', 'all', s.allRoutes); setOption('communityApi', 'all', s.allApis); setOption('communityStatus', 'all', s.allResults);
    setOption('communityStatus', 'working', s.working); setOption('communityStatus', 'mixed', s.mixed); setOption('communityStatus', 'broken', s.broken);
    setOption('communityReportRoute', '', s.choose); setOption('communityReportApi', '', s.choose);
    const verdictLabels = [s.working, s.issues, s.broken];
    document.querySelectorAll('.community-verdicts button span').forEach((node, index) => { node.textContent = verdictLabels[index]; });
  }

  function cardMarkup(card) {
    const count = totals(card.verdicts);
    // The poster is the card. Until one arrives - or when a game has none - the
    // initials stand in on a colour derived from the title, so the grid never
    // shows a hole where a picture will be.
    const art = state.art[card.key];
    const cover = art && art.cover;
    const tint = tintOf(card.title, art && art.palette);
    return `<button class="community-card${cover ? ' has-art' : ''}" data-community-card="${esc(card.key)}" type="button"
      style="--card-hue:${tint.hue}deg;--card-sat:${tint.sat}%;--card-light:${tint.light}%">
      ${cover ? `<img class="community-art" src="${esc(cover)}" alt="" loading="lazy" crossorigin="anonymous">`
              : `<span class="community-initials" aria-hidden="true">${esc(initialsOf(card.title))}</span>`}
      <span class="community-veil"></span>
      <span class="community-pill ${statusClass(card.status)}"><i class="community-dot ${statusClass(card.status)}"></i>${esc(statusText(card.status))}</span>
      <span class="community-kind">${esc(card.kind)}</span>
      <span class="community-card-body">
        <span class="community-title">${esc(card.title)}</span>
        <span class="community-counts">
          <span class="green"><i class="community-dot green"></i>${count.green}</span>
          <span class="yellow"><i class="community-dot yellow"></i>${count.yellow}</span>
          <span class="red"><i class="community-dot red"></i>${count.red}</span>
        </span>
        <span class="community-card-foot">
          <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>${esc(text().reports(card.reports || 0))}</span>
          <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z"/></svg>${esc(text().comments(card.comments || 0))}</span>
        </span>
      </span>
      <span class="community-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span>
    </button>`;
  }

  const paintCards = () => {
    const grid = $('communityCards');
    grid.innerHTML = state.cards.map(cardMarkup).join('');
    for (const card of state.cards) {
      const node = grid.querySelector(`[data-community-card="${CSS.escape(card.key)}"]`);
      if (node) wirePalette(card, [node.querySelector('.community-art')], [node]);
    }
  };

  // The list is cached at the edge, but the person who just wrote already
  // knows one message was added or removed. Keep their card counter honest
  // immediately; the next fresh list read replaces it with the server total.
  const bumpCardComments = (key, amount) => {
    const card = state.cards.find(item => item.key === key);
    if (!card) return;
    card.comments = Math.max(0, (Number(card.comments) || 0) + amount);
    paintCards();
  };

  async function render({ fresh = false } = {}) {
    applyLanguage();
    $('communityNotice').textContent = text().loading;
    $('communityRefresh').disabled = true;
    const [response] = await Promise.all([
      window.lab.communityCards({ ...state.filters, fresh: fresh || undefined }),
      syncOwnReports().catch(() => false)
    ]);
    $('communityRefresh').disabled = false;
    if (!response?.ok) {
      $('communityCards').innerHTML = '';
      // A count from the last successful load would be a claim about a list
      // that is no longer on screen.
      $('communityGameTotal').textContent = '';
      $('communityNotice').textContent = response?.message || text().offline;
      return;
    }
    state.cards = response.cards || [];
    // Artwork is prepared once by the community server. Populate the whole
    // grid from that response so cards arrive complete instead of making every
    // desktop fetch Steam images one after another.
    for (const card of state.cards) {
      state.art[card.key] = card.art ? {
        cover: card.art.hero || card.art.poster,
        poster: card.art.poster || card.art.hero,
        palette: null
      } : null;
    }
    $('communityGameTotal').textContent = text().gameTotal(Number(response.total) || 0);
    $('communityNotice').textContent = state.cards.length ? '' : text().empty;
    paintCards();
  }

  function routeCounts(verdicts) {
    return ['feeder', 'renodx', 'optiscaler'].filter(route => verdicts?.[route]).map(route => {
      const row = verdicts[route];
      const name = route === 'optiscaler' ? 'OptiScaler' : route === 'renodx' ? 'RenoDX' : 'Feeder';
      const on = state.route === route;
      return `<button type="button" class="community-route-count ${route}${on ? ' on' : ''}"
        data-route="${route}" aria-pressed="${on}">
        <span class="community-route-tile" aria-hidden="true">${ROUTE_MARK[route]}</span>
        <span class="community-route-copy"><b>${name}</b>
          <span class="community-counts">
            <span class="green"><i class="community-dot green"></i>${row.green || 0}</span>
            <span class="yellow"><i class="community-dot yellow"></i>${row.yellow || 0}</span>
            <span class="red"><i class="community-dot red"></i>${row.red || 0}</span>
          </span></span>
        <svg class="community-route-go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
      </button>`;
    }).join('');
  }

  // A small celebration inside the card you pressed, and nowhere else. It is
  // drawn locally and never sent anywhere: the person who pressed the button is
  // the only one who sees it, which is what makes it feel like a reply to them
  // rather than an announcement.
  const BURST = 16;
  function burst(card, emoji) {
    if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('span');
    layer.className = 'community-burst';
    const random = (low, high) => low + Math.random() * (high - low);
    let longest = 0;
    for (let i = 0; i < BURST; i++) {
      const piece = document.createElement('span');
      piece.textContent = emoji;
      // A few come at the camera - big, fast, straight up - while the rest
      // drift like something falling upward past you.
      const near = i % 5 === 0;
      const life = random(near ? 900 : 1200, near ? 1300 : 2000);
      const delay = random(0, 420);
      longest = Math.max(longest, life + delay);
      piece.style.cssText = `left:${random(4, 92)}%;` +
        `--size:${near ? random(20, 30) : random(11, 20)}px;` +
        `--dx:${random(-38, 38)}px;--dy:${random(-96, -168)}px;` +
        `--scale:${near ? random(1.9, 2.7) : random(.7, 1.25)};` +
        `--spin:${random(-40, 40)}deg;--life:${life}ms;--delay:${delay}ms;`;
      layer.appendChild(piece);
    }
    card.appendChild(layer);
    setTimeout(() => layer.remove(), longest + 260);
  }

  // Only ever drawn on something of your own, and the same two words in both
  // places, so there is one thing to learn rather than two.
  const ownActions = (kind, id, canEdit = true) => `<div class="community-own">
    ${canEdit ? `<button type="button" data-own="edit" data-kind="${kind}" data-id="${esc(String(id))}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="m14 6 4 4"/></svg>${esc(text().edit)}</button>` : ''}
    <button type="button" class="danger" data-own="remove" data-kind="${kind}" data-id="${esc(String(id))}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>${esc(text().remove)}</button>
  </div>`;

  function commentMarkup(comment) {
    const by = comment.by || {};
    // Which of these this install has pressed is remembered here rather than
    // asked of the server: the card is cached for everyone alike, and one
    // person's own reactions have no business in a shared response.
    const reactions = REACTIONS.map(emoji => {
      const on = state.mine[`${comment.id}:${emoji}`] === true;
      return `<button type="button" class="${on ? 'on' : ''}" data-reaction="${emoji}" data-report="${comment.id}"
        aria-pressed="${on}">${emoji}<span>${comment.reactions?.[emoji] || ''}</span></button>`;
    }).join('');
    return `<article class="community-comment-card" data-message-kind="report" data-message-id="${esc(String(comment.id))}">
      <span class="community-sheen" aria-hidden="true"></span>
      <span class="community-avatar-tile">${avatar(by)}</span>
      <div class="community-comment-main">
        <header>
          ${identity(by)}
          <span class="community-when">${esc(ago(comment.at))}</span>
          <i class="community-dot ${comment.verdict}" title="${esc(comment.route || '')}"></i>
        </header>
        ${comment.comment ? `<p>${esc(comment.comment)}</p>` : ''}
        <div class="community-tags">${(comment.tags || []).map(tag => `<span>${esc(tag)}</span>`).join('')}</div>
        ${isMine(by) ? ownActions('report', comment.id, Boolean(mineFor(state.active?.key))) : ''}
        <div class="community-reactions">${reactions}
          <button type="button" class="community-open-thread" data-thread="${comment.id}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z"/></svg>
            ${comment.replies ? `<span>${comment.replies}</span>` : ''}${esc(text().reply)}
          </button>
        </div>
      </div>
    </article>`;
  }

  // One comment and everything said under it. It replaces the list rather than
  // opening a second window, so there is one thing on screen at a time and one
  // way back.
  async function openThread(reportId) {
    const comment = (state.active?.comments || []).find(item => String(item.id) === String(reportId));
    if (!comment) return;
    state.thread = { id: reportId, comment };
    $('communityCardBody').innerHTML = `<p class="community-empty">${esc(text().loading)}</p>`;
    await paintThread();
  }

  async function paintThread({ fresh = false } = {}) {
    if (!state.thread) return;
    const { id, comment } = state.thread;
    const answer = await window.lab.communityReplies(id, fresh);
    const replies = answer?.ok ? answer.thread.replies : [];
    state.thread.replies = replies;
    $('communityCardBody').innerHTML = `
      <div class="community-thread">
        <button type="button" class="community-back" id="communityThreadBack">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>${esc(text().back)}
        </button>
        ${threadRoot(comment)}
        <div class="community-replies">${replies.length
          ? replies.map(replyMarkup).join('')
          : `<p class="community-empty">${esc(text().noReplies)}</p>`}</div>
        <form class="community-composer" id="communityReplyForm">
          <textarea id="communityReplyBody" rows="2" maxlength="1200" placeholder="${esc(text().replyPlaceholder)}"></textarea>
          <button type="submit" aria-label="${esc(text().send)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 16-8-6 8 6 8z"/><path d="M4 12h10"/></svg>
            <span>${esc(text().send)}</span>
          </button>
        </form>
      </div>`;
    $('communityThreadBack').onclick = () => { state.thread = null; state.editing = null; paintCard(state.active); };
    // Who may be named here: the people already in this conversation, which the
    // thread hands over with the replies themselves.
    wireMentions($('communityReplyBody'), (answer?.ok && answer.thread.people) || []);
    $('communityReplyForm').onsubmit = async event => {
      event.preventDefault();
      const box = $('communityReplyBody'), said = box.value.trim();
      if (!said) return;
      const button = event.target.querySelector('button');
      button.disabled = true;
      const answer = await window.lab.communityReply(id, said, mentionTags(said));
      button.disabled = false;
      if (!answer?.ok) { $('communityNotice').textContent = answer?.message || text().reactionFailed; return; }
      box.value = '';
      state.mentions = [];
      comment.replies = (Number(comment.replies) || 0) + 1;
      bumpCardComments(answer.reply?.card || state.active?.key, 1);
      await paintThread({ fresh: true });
    };
  }

  // What the thread is about, said once and small: who, what they found, and on
  // what. Everything else - the tags in full, the reactions, the way in - lives
  // on the list, and repeating it here buried the conversation under it.
  const routeName = route => route === 'optiscaler' ? 'OptiScaler' : route === 'renodx' ? 'RenoDX' : 'Feeder';

  function threadRoot(comment) {
    const by = comment.by || {};
    const about = [comment.route, (comment.api || '').toUpperCase(), ...(comment.tags || []).slice(0, 2)]
      .filter(Boolean).join(' · ');
    return `<div class="community-thread-root" data-message-kind="report" data-message-id="${esc(String(comment.id))}">
      <span class="community-thread-label">${esc(text().replyingTo)}</span>
      <div class="community-quote">
        <span class="community-avatar-tile small">${avatar(by)}</span>
        <div>
          <header>${identity(by)}
            <span class="community-when">${esc(ago(comment.at))}</span>
            <i class="community-dot ${esc(comment.verdict || '')}"></i></header>
          ${comment.comment ? `<p>${esc(comment.comment)}</p>` : ''}
          ${about ? `<span class="community-about">${esc(about)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }

  function replyMarkup(item) {
    const by = item.by || {};
    const mine = isMine(by) || isAdminMine(by);
    if (state.editing && state.editing.kind === 'reply' && String(state.editing.id) === String(item.id)) {
      return `<article class="community-reply editing">
        <span class="community-avatar-tile small">${avatar(by)}</span>
        <div>
          <header>${identity(by)}</header>
          <textarea id="communityEditBox" maxlength="1200" rows="3">${esc(item.body)}</textarea>
          <div class="community-own">
            <button type="button" data-own="save">${esc(text().saveEdit)}</button>
            <button type="button" data-own="cancel">${esc(text().cancelEdit)}</button>
          </div>
        </div>
      </article>`;
    }
    return `<article class="community-reply${mine ? ' own' : ''}" data-message-kind="${by.admin ? 'admin-reply' : 'reply'}" data-message-id="${esc(String(item.id))}"${mine ? ` data-mine="reply" data-id="${esc(String(item.id))}"` : ''}>
      <span class="community-avatar-tile small">${avatar(by)}</span>
      <div>
        <header>${identity(by)}
          <span class="community-when">${esc(ago(item.at))}</span></header>
        <p>${esc(item.body)}</p>
        ${mine ? ownActions('reply', item.id) : ''}
      </div>
    </article>`;
  }

  function announcementMarkup(item) {
    const by = item.by || {};
    return `<article class="community-announcement">
      <span class="community-avatar-tile">${avatar(by)}</span>
      <div><header>${identity(by)}<span class="community-pinned">${esc(text().pinnedAnnouncement)}</span>
        <span class="community-when">${esc(ago(item.at))}</span></header>
        <p>${esc(item.body)}</p></div>
    </article>`;
  }

  function paintCard(card) {
    state.active = card;
    // A live update arriving while a thread is open must not throw the reader
    // back to the list; the thread refreshes itself instead.
    if (state.thread) { paintThread(); return; }
    const art = state.art[card.key] || {};
    const head = $('communityCardHead');
    // The dialog, not only its header: the comment cards and the ground behind
    // them read the same three numbers.
    paintTint($('communityCardDialog'), card.title, art.palette);
    paintTint(head, card.title, art.palette);
    head.classList.toggle('has-art', Boolean(art.cover));
    head.innerHTML = `
      ${art.cover ? `<img class="community-head-art" src="${esc(art.cover)}" alt="" crossorigin="anonymous">` : ''}
      <span class="community-head-veil"></span>
      <span class="community-poster">${art.poster
        ? `<img src="${esc(art.poster)}" alt="" crossorigin="anonymous">`
        : `<span class="community-initials">${esc(initialsOf(card.title))}</span>`}</span>
      <span class="community-head-copy">
        <h3>${esc(card.title)}</h3>
        <p>${esc(text().updated)}</p>
        <span class="community-route-counts">${routeCounts(card.verdicts)}</span>
      </span>`;
    wirePalette(card, head.querySelectorAll('img'), [$('communityCardDialog'), head]);
    const shown = state.route
      ? (card.comments || []).filter(item => item.route === state.route)
      : (card.comments || []);
    $('communityCardBody').innerHTML = `
      ${state.route ? `<div class="community-route-filter">
        <span>${esc(text().showing(routeName(state.route), shown.length))}</span>
        <button type="button" id="communityRouteClear">${esc(text().showAll)}</button>
      </div>` : ''}
      <div class="community-comments">
        ${(card.announcements || []).map(announcementMarkup).join('')}
        ${shown.length
          ? shown.map(commentMarkup).join('')
          : `<p class="community-empty">${esc(text().noComments)}</p>`}
      </div>`;
    const clear = $('communityRouteClear');
    if (clear) clear.onclick = () => { state.route = null; paintCard(state.active); };
    paintFollow();
  }

  async function openCard(key) {
    stopPolling(); state.etag = null;
    const response = await window.lab.communityCard(key, null);
    if (!response?.ok || !response.card) { $('communityNotice').textContent = response?.message || text().offline; return; }
    state.etag = response.etag; paintCard(response.card);
    $('communityCardDialog').showModal();
    state.timer = setInterval(poll, 10_000);
  }

  async function poll() {
    if (!state.active || !$('communityCardDialog').open) return stopPolling();
    const result = await window.lab.communityUpdates(state.active.key, state.active.version, state.etag);
    if (!result?.ok || result.notModified) return;
    // The updates endpoint is never cached, so reaching here is proof that the
    // edge's copy of this card is out of date. Asking for it anyway would
    // repaint the card with numbers older than the ones already on screen -
    // which is what made a pressed emoji lose its count ten seconds later.
    const latest = await window.lab.communityCard(state.active.key, null, true);
    if (latest?.ok && latest.card) { state.etag = latest.etag; paintCard(latest.card); render(); }
  }
  function stopPolling() { if (state.timer) clearInterval(state.timer); state.timer = null; }
  function closeCard() { stopPolling(); state.active = null; state.thread = null; state.route = null; $('communityCardDialog').close(); }

  // Selecting a value the list does not offer empties the box; the placeholder
  // is better than a blank, so it is what an unknown answer falls back to.
  function setChoice(id, value) {
    const select = $(id);
    select.value = value || '';
    if (select.selectedIndex < 0) select.value = '';
  }

  function privacyRows(prefill) {
    const facts = { title: prefill.title, route: $('communityReportRoute').value || '—', api: $('communityReportApi').value || '—', gpu: prefill.gpu, driver: prefill.driver, cpu: prefill.cpu, os: prefill.os, app: prefill.app };
    const glyph = { title: 'game', route: 'route', api: 'api', gpu: 'gpu', driver: 'driver', cpu: 'cpu', os: 'os', app: 'app' };
    return Object.entries(facts).map(([key, value]) =>
      `<div>${icon(glyph[key] || 'info')}<span>${esc(text().facts[key])}</span><b>${esc(value || '—')}</b></div>`).join('');
  }
  function updatePrivacy() { if (state.report) $('communityPrivacyData').innerHTML = privacyRows(state.report); }

  // The same header the opened card has: the game's own art behind it and its
  // poster beside the title, so it is obvious which game is being reported on.
  // "win32 10.0.26200" is what the platform calls itself; nobody says that.
  const platformName = value => /^win/i.test(String(value || '')) ? 'Windows'
    : /^darwin/i.test(String(value || '')) ? 'macOS' : /^linux/i.test(String(value || '')) ? 'Linux' : (value || '');

  // Each label says which glyph belongs to it; this puts them there.
  function paintLabelIcons() {
    for (const label of document.querySelectorAll('#communityReportDialog [data-icon]')) {
      if (label.querySelector('.c-icon')) continue;
      label.insertAdjacentHTML('afterbegin', icon(label.dataset.icon));
    }
  }

  function countComment() {
    const box = $('communityReportComment'), out = $('communityCommentCount');
    if (!box || !out) return;
    out.textContent = `${box.value.length}/${box.maxLength}`;
    out.classList.toggle('near', box.value.length > box.maxLength * 0.9);
  }

  async function paintReportHead() {
    const report = state.report;
    if (!report) return;
    const head = $('communityReportHead');
    const key = report.game?.store && report.game?.storeId ? `${report.game.store}:${report.game.storeId}` : null;
    // The colour of the pictures this dialog shows - the library's hero and
    // poster, read in the main process - and only if those are missing does the
    // community art's colour stand in.
    const known = key ? state.art[key] : null;
    const palette = report.palette || (known && known.palette) || null;
    paintTint(head, report.title, palette);
    paintTint($('communityReportDialog'), report.title, palette);
    const paint = wide => {
      head.innerHTML = `
        ${wide ? `<img class="community-head-art" src="${esc(wide)}" alt="">` : ''}
        <span class="community-head-veil"></span>
        <span class="community-poster">${report.poster
          ? `<img src="${esc(report.poster)}" alt="">`
          : `<span class="community-initials">${esc(initialsOf(report.title))}</span>`}</span>
        <span class="community-head-copy">
          ${report.kicker ? `<span class="community-kicker">${esc(report.kicker)}</span>` : ''}
          <h3>${esc(report.title)}</h3>
          <p>${esc(text().shareHint)}</p>
          <span class="community-head-chips">
            <span class="community-chip">${icon('os')}${esc(platformName(report.os))}</span>
            ${report.api ? `<span class="community-chip">${icon('api')}${esc(report.api.toUpperCase())}</span>` : ''}
            <span class="community-chip">${icon('tag')}v${esc(report.app || '')}</span>
          </span>
        </span>`;
    };
    paint(report.hero || (key && state.art[key]?.cover) || null);
    // The wide art may not be here yet; the header is drawn either way and
    // fills in behind, rather than holding the dialog closed while it loads.
    if (!report.hero && key && state.art[key] === undefined) {
      state.art[key] = null;
      try {
        const answer = await window.lab.communityArt(key, report.title);
        if (!answer?.cover) return;
        state.art[key] = answer;
        if (state.report !== report) return;
        paintTint(head, report.title, answer.palette);
        paintTint($('communityReportDialog'), report.title, answer.palette);
        paint(answer.cover);
      } catch { /* offline: the gradient stands in */ }
    }
  }

  async function openReport(dir, previous) {
    const response = await window.lab.communityPrefill(dir);
    if (!response?.ok) { $('communityNotice').textContent = response?.message || text().offline; return; }
    state.report = { ...response.prefill, dir };
    state.verdict = previous?.verdict || null;
    state.mentions = [];
    applyLanguage();
    paintReportHead();
    paintLabelIcons();
    // Correcting a result starts from the result: what was chosen last time is
    // already selected, so a change of mind is one click rather than a retype.
    setChoice('communityReportRoute', previous?.route || state.report.route);
    setChoice('communityReportApi', previous?.api || state.report.api);
    $('communityReportComment').value = previous?.comment || '';
    countComment();
    $('communityReportError').textContent = '';
    document.querySelectorAll('.community-verdicts button').forEach(button =>
      button.classList.toggle('selected', Boolean(state.verdict) && button.dataset.verdict === state.verdict));
    $('communityReportSubmit').textContent = previous ? text().saveEdit : text().submit;
    updatePrivacy(); $('communityReportDialog').showModal();
  }
  function closeReport() { state.report = null; state.verdict = null; $('communityReportDialog').close(); }

  async function submitReport(event) {
    event.preventDefault();
    const route = $('communityReportRoute').value;
    if (!route) { $('communityReportError').textContent = text().chooseRoute; return; }
    if (!state.verdict) { $('communityReportError').textContent = text().chooseVerdict; return; }
    const button = $('communityReportSubmit'); button.disabled = true; button.textContent = text().submitting;
    const p = state.report;
    const report = { game: p.game, route, verdict: state.verdict, api: $('communityReportApi').value || null, comment: $('communityReportComment').value || null, gpu: p.gpu, driver: p.driver, cpu: p.cpu, os: p.os, app: p.app };
    const response = await window.lab.communityReport(report);
    button.disabled = false; button.textContent = text().submit;

    // Nothing was saved: the dialog stays open with everything still in it, and
    // the reason is said out loud rather than left in a line under the form.
    if (!response?.ok) {
      $('communityReportError').textContent = response?.message || text().offline;
      const again = await window.cheer.show({
        tone: 'bad', kicker: text().failTitle, title: p.title || '',
        note: `${response?.message || text().offline}\n${text().failNote}`,
        hero: p.hero, poster: p.poster,
        actions: [{ id: 'retry', label: text().failGo }, { id: 'close', label: text().failStay }]
      });
      if (again === 'close') closeReport();
      return;
    }

    rememberMine(response.result?.card, p.dir, response.result?.report);
    closeReport();
    // The sheet that opened this dialog now has a report to edit, not one to add.
    if (typeof window.refreshSheet === 'function') window.refreshSheet(p.dir);
    await render({ fresh: true });

    const said = report.comment && report.comment.trim();
    const where = await window.cheer.show({
      tone: 'ok', kicker: text().sentTitle, title: p.title || '',
      note: text().sentNote, hero: p.hero, poster: p.poster,
      verdict: state.verdict, comment: said || text().silentReport,
      tags: [routeName(route), (report.api || '').toUpperCase(), p.gpu].filter(Boolean),
      actions: [{ id: 'go', label: text().sentGo }, { id: 'close', label: text().sentStay }]
    });
    $('communityNotice').textContent = text().sentOk;
    // Straight to the thing they just wrote, opened on its own thread.
    if (where === 'go' && response.result?.card) {
      await openCard(response.result.card);
      if (response.result.report) await openThread(response.result.report);
    }
  }

  async function renderProfile(container) {
    const profile = await window.lab.communityProfile();
    const section = document.createElement('section'); section.className = 'community-profile';
    if (profile?.admin) {
      const admin = profile.admin;
      state.admin = admin;
      section.classList.add('admin-session');
      section.innerHTML = `<div class="community-profile-copy"><div class="k">${esc(text().adminMode)}</div><div class="v">${esc(text().adminModeHint)}</div><div class="community-admin-identity"><span class="community-avatar-tile">${avatar(admin)}</span><strong>${identity(admin)}</strong></div><div class="community-profile-status" id="communityProfileStatus"></div><button class="community-remove-me" id="communityAdminLogout" type="button">${esc(text().adminLogout)}</button></div>`;
      container.prepend(section);
      $('communityAdminLogout').onclick = async () => {
        const button = $('communityAdminLogout'); button.disabled = true;
        const response = await window.lab.communityAdminLogout();
        if (!response?.ok) { button.disabled = false; $('communityProfileStatus').textContent = response?.message || text().offline; return; }
        state.admin = null;
        section.remove();
        await renderProfile(container);
        const status = $('communityProfileStatus'); if (status) status.textContent = text().adminLoggedOut;
      };
      return;
    }
    state.admin = null;
    section.innerHTML = `<div class="community-profile-copy"><div class="k">${esc(text().profile)}</div><div class="v">${esc(text().profileHint)}</div><label>${esc(text().displayName)}<input id="communityProfileName" maxlength="96" value="${esc(profile?.name || '')}"></label><div class="community-profile-status" id="communityProfileStatus"></div><p class="community-live-privacy">${esc(text().liveCount)}</p><button class="community-remove-me" id="communityRemoveMe" type="button">${esc(text().removeMine)}</button></div><div class="community-profile-picker"><span>${esc(text().chooseIcon)}</span><div>${avatars.map((item, index) => `<button type="button" data-community-icon="${index}" class="${index === (Number(profile?.icon) || 0) ? 'selected' : ''}">${item}</button>`).join('')}</div><button class="glass-btn sm" id="communityProfileSave">${esc(text().save)}</button></div>`;
    container.prepend(section);
    let icon = Number(profile?.icon) || 0;
    section.onclick = event => {
      const pick = event.target.closest('[data-community-icon]');
      if (!pick) return;
      icon = Number(pick.dataset.communityIcon);
      section.querySelectorAll('[data-community-icon]').forEach(button => button.classList.toggle('selected', button === pick));
    };
    $('communityProfileSave').onclick = async () => {
      const button = $('communityProfileSave'); button.disabled = true; $('communityProfileStatus').textContent = '';
      const response = await window.lab.communitySaveProfile({ name: $('communityProfileName').value, icon });
      button.disabled = false;
      if (response?.ok && response.profile?.admin) {
        section.remove();
        await renderProfile(container);
        return;
      }
      $('communityProfileStatus').textContent = response?.ok ? text().saved : (response?.message || text().offline);
    };
    $('communityRemoveMe').onclick = async () => {
      if (!await ask({
        icon: 'trash', title: text().removeMineTitle, body: text().removeConfirm,
        confirm: text().removeMine, cancel: text().cancelEdit
      })) return;
      const button = $('communityRemoveMe');
      button.disabled = true; button.textContent = text().removing; $('communityProfileStatus').textContent = '';
      const response = await window.lab.communityDeleteMe();
      button.disabled = false; button.textContent = text().removeMine;
      if (!response?.ok) { $('communityProfileStatus').textContent = response?.message || text().offline; return; }
      $('communityProfileName').value = ''; icon = 0;
      section.querySelectorAll('[data-community-icon]').forEach(pick => pick.classList.toggle('selected', pick.dataset.communityIcon === '0'));
      const result = response.result || {};
      const message = text().removedMine(Number(result.reports) || 0, Number(result.replies) || 0);
      await render();
      $('communityNotice').textContent = message;
    };
  }

  // ------------------------------------------------------------- own words

  // Deleting a report can take the whole game with it, and says so first: when
  // nobody else has reported it there is nothing left to be a card.
  async function removeReport(id) {
    if (!await ask({
      icon: 'trash', title: text().removeReportTitle, body: text().removeReportAsk,
      confirm: text().removeReport, cancel: text().cancelEdit
    })) return;
    const answer = await window.lab.communityWithdraw(id);
    if (!answer?.ok) { $('communityNotice').textContent = answer?.message || text().offline; return; }
    forgetMine(state.active?.key);
    const key = state.active?.key;
    closeCard();
    await render({ fresh: true });
    // The card may not exist any more; only reopen one that survived.
    if (key && state.cards.some(card => card.key === key)) await openCard(key);
    $('communityNotice').textContent = text().removed;
  }

  async function removeReply(id) {
    if (!await ask({
      icon: 'trash', title: text().removeReplyTitle, body: text().removeReplyAsk,
      confirm: text().remove, cancel: text().cancelEdit
    })) return;
    const answer = await window.lab.communityWithdrawReply(id);
    if (!answer?.ok) { $('communityNotice').textContent = answer?.message || text().offline; return; }
    if (state.thread?.comment) state.thread.comment.replies = Math.max(0, (Number(state.thread.comment.replies) || 0) - 1);
    bumpCardComments(state.active?.key, -1);
    await paintThread({ fresh: true });
  }

  async function saveEdit() {
    const box = $('communityEditBox');
    if (!box || !state.editing) return;
    const said = box.value.trim();
    if (!said) return;
    const answer = await window.lab.communityEditReply(state.editing.id, said);
    if (!answer?.ok) { $('communityNotice').textContent = answer?.message || text().offline; return; }
    state.editing = null;
    await paintThread({ fresh: true });
  }

  // Editing a report is filing it again - the server replaces rather than adds.
  // It needs the folder the report was written about, which is why the dialog
  // is only offered where that is known.
  async function editReport(comment) {
    const record = mineFor(state.active?.key);
    if (!record) return;
    closeCard();
    await openReport(record.dir, comment);
  }

  // ------------------------------------------------------------- following

  // The bell answers the press, not the network: a button that waits for a
  // round trip before moving feels broken on a slow connection. If the server
  // refuses, it goes back to where it was and says why.
  async function toggleFollow() {
    const key = state.active?.key;
    if (!key) return;
    const was = state.watching;
    const on = !watchingNow(key);
    state.watching = on ? [...was, key] : was.filter(item => item !== key);
    paintFollow();
    ringBell(on);

    const answer = await window.lab.communityFollow(key, on);
    if (answer?.ok) return;
    state.watching = was;
    paintFollow();
    $('communityNotice').textContent = answer?.message || text().offline;
  }

  function ringBell(on) {
    const button = $('communityFollow');
    if (!button) return;
    button.classList.remove('ringing', 'hushing');
    void button.offsetWidth;   // so a second press starts the animation again
    button.classList.add(on ? 'ringing' : 'hushing');
    button.addEventListener('animationend', () => button.classList.remove('ringing', 'hushing'), { once: true });
  }

  function paintFollow() {
    const button = $('communityFollow');
    if (!button || !state.active) return;
    const on = watchingNow(state.active.key);
    button.classList.toggle('on', on);
    button.title = on ? text().unfollow : text().follow;
    button.setAttribute('aria-pressed', String(on));
  }

  // ------------------------------------------------------------- mentions

  // The list only ever holds people already on this card, and a name is turned
  // into a tag at the moment it is picked - so what is sent is never guessed
  // from the text afterwards.
  function wireMentions(box, people) {
    if (!box || !people?.length || !window.mentions) return;
    const menu = document.createElement('div');
    menu.className = 'community-mentions hidden';
    box.parentElement.appendChild(menu);
    const close = () => { menu.classList.add('hidden'); menu.innerHTML = ''; };

    const offer = () => {
      const where = window.mentions.mentionQuery(box.value, box.selectionStart);
      if (!where) return close();
      const matches = window.mentions.matchNames(people, where.query);
      if (!matches.length) return close();
      menu.innerHTML = matches.map((person, index) =>
        `<button type="button" data-pick="${index}">${esc(person.name)}<small>#${esc(person.tag)}</small></button>`).join('');
      menu.classList.remove('hidden');
      menu.onmousedown = event => event.preventDefault();  // keep the caret
      menu.onclick = event => {
        const pick = event.target.closest('[data-pick]');
        if (!pick) return;
        const person = matches[Number(pick.dataset.pick)];
        const put = window.mentions.insertMention(box.value, box.selectionStart, where.start, person.name);
        box.value = put.value;
        box.setSelectionRange(put.caret, put.caret);
        if (!state.mentions.some(item => item.tag === person.tag)) state.mentions.push(person);
        close();
        box.focus();
      };
    };
    box.addEventListener('input', offer);
    box.addEventListener('click', offer);
    box.addEventListener('blur', () => setTimeout(close, 160));
  }

  const mentionTags = said => window.mentions
    ? window.mentions.stillNamed(said, state.mentions)
    : [];

  // ------------------------------------------------------- being told about it

  // The main process finds out; this page decides what it says, because the
  // community feature speaks two languages and the installer speaks thirty-eight.
  function wireNotices() {
    if (!window.lab.onCommunityNotices) return;
    window.lab.onCommunityNotices(async list => {
      const s = text();
      const spoken = list.map(notice => {
        const who = notice.actor || s.noticeSomeone;
        const where = notice.title || '';
        const title = notice.kind === 'mention' ? s.noticeMentioned(who, where)
          : notice.kind === 'watch' ? s.noticeOnGame(who, where)
            : s.noticeReplied(who, where);
        return { title, body: notice.body || '', card: notice.card, report: notice.report };
      });
      const shown = spoken.length > 3
        ? [{ title: s.noticeMany(spoken.length), body: spoken.map(item => item.title).join(' · ').slice(0, 200) }]
        : spoken;
      await window.lab.communityNotify(shown);
      await window.lab.communityNoticesRead();
    });
    if (window.lab.onCommunityOpen) {
      window.lab.onCommunityOpen(async notice => {
        if (!notice?.card) return;
        document.querySelector('[data-view="community"]')?.click();
        await render();
        await openCard(notice.card);
        if (notice.report) await openThread(notice.report);
      });
    }
  }

  // ------------------------------------------------------- message menu

  let messageMenu = null;
  function closeMessageMenu() {
    if (messageMenu) {
      try { if (messageMenu.matches(':popover-open')) messageMenu.hidePopover(); } catch { /* already closed */ }
      messageMenu.remove();
    }
    messageMenu = null;
  }

  function messageFrom(node) {
    const kind = node?.dataset.messageKind;
    const id = node?.dataset.messageId;
    if (!kind || !id) return null;
    if (kind === 'report') {
      const item = (state.active?.comments || []).find(row => String(row.id) === String(id));
      return item ? { kind, id, body: item.comment || '', by: item.by || {}, item } : null;
    }
    const item = (state.thread?.replies || []).find(row => String(row.id) === String(id));
    return item ? { kind, id, body: item.body || '', by: item.by || {}, item } : null;
  }

  async function startMentionReply(message) {
    if (message.kind === 'report' && String(state.thread?.id) !== String(message.id)) await openThread(message.id);
    const box = $('communityReplyBody');
    if (!box) return;
    const name = String(message.by?.name || text().unnamed).trim();
    const prefix = `@${name} `;
    if (!box.value.startsWith(prefix)) box.value = prefix + box.value;
    if (!message.by?.admin && message.by?.tag && !state.mentions.some(item => item.tag === message.by.tag)) {
      state.mentions.push({ name, tag: message.by.tag, icon: message.by.icon });
    }
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }

  async function moderateMessage(message, action) {
    const label = action === 'block' ? text().blockAuthor : text().hideMessage;
    if (!await ask({ icon: action === 'block' ? 'shield' : 'hide', title: label, body: `${label}?`, confirm: label, cancel: text().cancelEdit })) return;
    const answer = await window.lab.communityAdminModerate(message.kind, message.id, action);
    if (!answer?.ok) { $('communityNotice').textContent = answer?.message || text().offline; return; }
    $('communityNotice').textContent = text().moderationDone;
    if (action === 'block' || message.kind === 'report') {
      closeCard();
      await render({ fresh: true });
      return;
    }
    if (state.thread?.comment) state.thread.comment.replies = Math.max(0, (Number(state.thread.comment.replies) || 0) - 1);
    bumpCardComments(state.active?.key, -1);
    await paintThread({ fresh: true });
  }

  function openMessageMenu(event, message) {
    closeMessageMenu();
    const mine = isMine(message.by) || isAdminMine(message.by);
    const actions = [
      ['copy', text().copyMessage],
      ['reply', text().replyMention]
    ];
    if (mine) actions.push(['edit', text().edit], ['remove', text().remove]);
    if (state.admin && !mine) {
      actions.push(['hide', text().hideMessage]);
      if (!message.by?.admin) actions.push(['block', text().blockAuthor]);
    }
    const menu = document.createElement('div');
    menu.className = 'community-message-menu';
    menu.setAttribute('role', 'menu');
    // A modal dialog lives in the browser's top layer. A large z-index on an
    // ordinary body child can never cross that boundary, so the menu is a
    // popover owned by the dialog and enters the top layer after it.
    menu.setAttribute('popover', 'manual');
    for (const [action, label] of actions) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.action = action; button.textContent = label;
      if (action === 'remove' || action === 'block') button.className = 'danger';
      menu.appendChild(button);
    }
    $('communityCardDialog').appendChild(menu);
    messageMenu = menu;
    menu.showPopover();
    const box = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(event.clientX, innerWidth - box.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, innerHeight - box.height - 8))}px`;
    menu.onclick = async click => {
      const button = click.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      closeMessageMenu();
      if (action === 'copy') { await window.lab.copyText(message.body); $('communityNotice').textContent = text().copied; return; }
      if (action === 'reply') return void startMentionReply(message);
      if (action === 'hide' || action === 'block') return void moderateMessage(message, action);
      if (action === 'remove') return void (message.kind === 'report' ? removeReport(message.id) : removeReply(message.id));
      if (action === 'edit' && message.kind === 'report') return void editReport(message.item);
      if (action === 'edit') {
        state.editing = { kind: 'reply', id: message.id };
        await paintThread();
        $('communityEditBox')?.focus();
      }
    };
  }

  function bind() {
    document.addEventListener('pointerdown', event => { if (messageMenu && !messageMenu.contains(event.target)) closeMessageMenu(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMessageMenu(); });
    window.addEventListener('blur', closeMessageMenu);
    window.addEventListener('resize', closeMessageMenu);
    for (const [id, key] of [['communitySearch','q'],['communityRoute','route'],['communityApi','api'],['communityStatus','status']]) {
      $(id).addEventListener(id === 'communitySearch' ? 'input' : 'change', event => { state.filters[key] = event.target.value; clearTimeout(bind.wait); bind.wait = setTimeout(render, id === 'communitySearch' ? 250 : 0); });
    }
    $('communityRefresh').onclick = render;
    $('communityClear').onclick = () => { state.filters = { q: '', route: 'all', api: 'all', status: 'all' }; for (const id of ['communitySearch','communityRoute','communityApi','communityStatus']) $(id).value = id === 'communitySearch' ? '' : 'all'; render(); };
    $('communityCards').onclick = event => { const card = event.target.closest('[data-community-card]'); if (card) openCard(card.dataset.communityCard); };
    // Where the pointer is inside a comment card, handed to CSS so the gold rim
    // lights the edge nearest it. One listener for the whole list, and the work
    // is deferred to the next frame so a fast sweep cannot queue up a hundred
    // style writes.
    let pointerFrame = 0, pointerCard = null, pointerX = 0, pointerY = 0;
    $('communityCardBody').addEventListener('pointermove', event => {
      const card = event.target.closest('.community-comment-card');
      if (!card) return;
      const box = card.getBoundingClientRect();
      pointerCard = card;
      pointerX = event.clientX - box.left;
      pointerY = event.clientY - box.top;
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!pointerCard) return;
        pointerCard.style.setProperty('--mx', `${pointerX}px`);
        pointerCard.style.setProperty('--my', `${pointerY}px`);
      });
    });
    // Leaving takes the light with it rather than freezing it mid-card.
    $('communityCardBody').addEventListener('pointerout', event => {
      const card = event.target.closest('.community-comment-card');
      if (card && !card.contains(event.relatedTarget)) { card.style.removeProperty('--mx'); card.style.removeProperty('--my'); }
    });

    $('communityCardHead').onclick = event => {
      const chip = event.target.closest('[data-route]');
      if (!chip || !state.active) return;
      // Pressing the chip that is already on takes the filter off again.
      state.route = state.route === chip.dataset.route ? null : chip.dataset.route;
      state.thread = null;
      paintCard(state.active);
    };
    $('communityFollow').onclick = toggleFollow;
    $('communityCardClose').onclick = closeCard; $('communityCardDialog').addEventListener('cancel', event => { event.preventDefault(); closeCard(); });
    $('communityCardBody').addEventListener('contextmenu', event => {
      const node = event.target.closest('[data-message-kind]');
      const message = messageFrom(node);
      if (!message) return;
      event.preventDefault();
      openMessageMenu(event, message);
    });
    $('communityCardBody').onclick = async event => {
      // Your own words first: edit, delete, and the two buttons an open editor
      // puts in their place.
      const own = event.target.closest('[data-own]');
      if (own) {
        const { own: what, kind, id } = own.dataset;
        if (what === 'save') return void saveEdit();
        if (what === 'cancel') { state.editing = null; return void (state.thread ? paintThread() : paintCard(state.active)); }
        if (what === 'remove') return void (kind === 'reply' ? removeReply(id) : removeReport(id));
        if (what === 'edit' && kind === 'reply') {
          state.editing = { kind: 'reply', id };
          await paintThread();
          $('communityEditBox')?.focus();
          return;
        }
        if (what === 'edit') {
          const comment = (state.active?.comments || []).find(item => String(item.id) === String(id));
          return void editReport(comment);
        }
        return;
      }
      const thread = event.target.closest('[data-thread]');
      if (thread) return void openThread(thread.dataset.thread);
      const button = event.target.closest('[data-reaction]');
      if (!button) return;
      const report = button.dataset.report, emoji = button.dataset.reaction;
      const key = `${report}:${emoji}`;
      const on = state.mine[key] !== true;

      button.disabled = true;
      const response = await window.lab.communityReaction(report, emoji, on);
      button.disabled = false;
      if (!response?.ok) { $('communityNotice').textContent = response?.message || text().reactionFailed; return; }

      if (on) state.mine[key] = true; else delete state.mine[key];
      saveMine();

      // The counts come back with the write itself. Reading the card again
      // would go through the edge cache and return the numbers from before the
      // press, which is why the tally used to sit still for up to a minute.
      // Against a server too old to answer with them, the one press that just
      // succeeded is counted here instead - the poll reconciles either way.
      const comment = (state.active.comments || []).find(item => String(item.id) === String(report));
      if (comment) {
        const counts = response.result && response.result.reactions;
        if (counts) comment.reactions = counts;
        else {
          const now = { ...(comment.reactions || {}) };
          const next = (now[emoji] || 0) + (on ? 1 : -1);
          if (next > 0) now[emoji] = next; else delete now[emoji];
          comment.reactions = now;
        }
      }

      // Repaint first. It replaces every comment in the list, so anything added
      // to the old card - the celebration included - goes with it; the card to
      // celebrate in is the new one, found again by the report it belongs to.
      paintCard(state.active);
      if (!on) return;
      const painted = $('communityCardBody').querySelector(`[data-reaction][data-report="${CSS.escape(report)}"]`);
      burst(painted && painted.closest('.community-comment-card'), emoji);
    };
    $('communityReportClose').onclick = closeReport; $('communityReportCancel').onclick = closeReport; $('communityReportDialog').addEventListener('cancel', event => { event.preventDefault(); closeReport(); });
    $('communityReportRoute').onchange = updatePrivacy; $('communityReportApi').onchange = updatePrivacy;
    $('communityReportComment').oninput = countComment;
    document.querySelector('.community-verdicts').onclick = event => { const button = event.target.closest('[data-verdict]'); if (!button) return; state.verdict = button.dataset.verdict; document.querySelectorAll('.community-verdicts button').forEach(item => item.classList.toggle('selected', item === button)); };
    $('communityReportForm').onsubmit = submitReport;
  }
  bind(); applyLanguage(); wireNotices();
  // Who this install is, and what it follows. Asked for once at start rather
  // than on every card, and quietly - being offline is not an error here.
  loadMe().catch(() => {});
  window.communityUi = {
    render, renderProfile, openReport, applyLanguage, stopPolling, syncOwnReports,
    // The games view asks these: whether this install already reported a game,
    // and how to take that report back from outside the community page.
    reportFor: dir => { const found = mineForDir(dir); return found ? { key: found[0], ...found[1] } : null; },
    removeReportFor: async dir => {
      const found = mineForDir(dir);
      if (!found) return false;
      if (!await ask({
        icon: 'trash', title: text().removeReportTitle, body: text().removeReportAsk,
        confirm: text().removeReport, cancel: text().cancelEdit
      })) return false;
      const answer = await window.lab.communityWithdraw(found[1].report);
      if (!answer?.ok) return false;
      forgetMine(found[0]);
      return true;
    },
    words: () => text()
  };
})();
