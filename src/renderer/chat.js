'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const avatars = ['🎮','🚀','⚡','🛡️','🔥','⭐','🎯','🕹️','👾','🤖','🐉','🦊','🐺','🦁','🦅','🐙','🌌','🌙','☀️','💎','🔧','🧪','🏁','🎧'];
  const EMOJI = ['❤️', '👍', '🔥', '🎉', '😂', '😮'];
  const MAX_ORIGINAL = 15 * 1024 * 1024;
  const MAX_COMPRESSED = 2 * 1024 * 1024;
  const MAX_IMAGES = 4;
  const MINE_KEY = 'chat-reactions-v1';
  const DRAFT_KEY = 'chat-draft-v1';
  const L = {
    en: {
      nav: 'Chat', title: 'Community chat', subtitle: 'Share results, screenshots and game discoveries with everyone.',
      retention: 'Images expire after 24 hours', refresh: 'Refresh', older: 'Load earlier messages',
      emptyTitle: 'Start the conversation', emptyBody: 'Share a tip, screenshot, or game card.',
      placeholder: 'Message the community…', hint: 'Enter to send · Shift+Enter for a new line · paste or drop images',
      newMessages: 'New messages ↓', addTo: 'ADD TO MESSAGE', share: 'Share something', photos: 'Photos',
      photosSub: 'Up to 4 images', game: 'Game card', gameSub: 'Search community results', findGame: 'Find a game',
      findPlaceholder: 'Type a game name…', reports: n => `${n} report${n === 1 ? '' : 's'}`,
      comments: n => `${n} comment${n === 1 ? '' : 's'}`, working: 'WORKING', broken: 'NOT WORKING', mixed: 'MIXED', unknown: 'NO RESULTS',
      replying: 'Replying to', editing: 'Editing your message', imageExpired: 'This image expired after 24 hours.',
      edited: 'edited', reply: 'Reply with mention', copy: 'Copy message', edit: 'Edit message', remove: 'Delete message',
      saveImage: 'Save image', hide: 'Hide message', block: 'Block author', adminDelete: 'Delete permanently',
      deleteTitle: 'Delete this message?', deleteBody: 'It will disappear from the chat for everyone.',
      moderateTitle: 'Apply moderation?', cancel: 'Cancel', confirm: 'Confirm', compression: 'Optimizing images…',
      sending: 'Sending…', uploadFailed: 'The message was not sent. Your draft is still here.',
      tooMany: 'You can attach up to 4 images.', tooLarge: 'Each original image may be up to 15 MB.',
      badImage: 'That image could not be read.', profile: 'Choose a community name in Settings before using mentions.',
      noGames: 'No matching community games.', label: 'Add label', chooseLabel: 'Choose a label', clearLabel: 'No label', dlssOn: 'DLSS 5 ON', dlssOff: 'DLSS 5 OFF',
      fit: 'Fit', copied: 'Copied.', saved: 'Image saved.', online: 'Live updates connected',
      unnamed: 'Anonymous', unavailable: 'Message unavailable', photo: 'Photo', message: 'Message', more: 'More', admin: 'ADMIN',
      attach: 'Attach', send: 'Send', close: 'Close', attachment: 'Chat attachment',
      previousImage: 'Previous image', nextImage: 'Next image', zoomOut: 'Zoom out', zoomIn: 'Zoom in'
    },
    ar: {
      nav: 'الشات', title: 'شات المجتمع', subtitle: 'شارك النتائج والصور واكتشافات الألعاب مع الجميع.',
      retention: 'تُحذف الصور بعد 24 ساعة', refresh: 'تحديث', older: 'تحميل رسائل أقدم',
      emptyTitle: 'ابدأ المحادثة', emptyBody: 'شارك نصيحة أو صورة أو بطاقة لعبة.',
      placeholder: 'اكتب للمجتمع…', hint: 'Enter للإرسال · Shift+Enter لسطر جديد · يمكنك لصق الصور أو سحبها',
      newMessages: 'رسائل جديدة ↓', addTo: 'إضافة إلى الرسالة', share: 'ماذا تريد أن تشارك؟', photos: 'صور',
      photosSub: 'حتى 4 صور', game: 'بطاقة لعبة', gameSub: 'ابحث في نتائج المجتمع', findGame: 'ابحث عن لعبة',
      findPlaceholder: 'اكتب اسم اللعبة…', reports: n => `${n} تقرير`, comments: n => `${n} تعليق`,
      working: 'تعمل', broken: 'لا تعمل', mixed: 'نتائج مختلطة', unknown: 'بلا نتائج',
      replying: 'ردًّا على', editing: 'تعديل رسالتك', imageExpired: 'انتهت صلاحية هذه الصورة بعد 24 ساعة.',
      edited: 'معدلة', reply: 'رد مع منشن', copy: 'نسخ الرسالة', edit: 'تعديل الرسالة', remove: 'حذف الرسالة',
      saveImage: 'حفظ الصورة', hide: 'إخفاء الرسالة', block: 'حظر الكاتب', adminDelete: 'حذف نهائي',
      deleteTitle: 'حذف هذه الرسالة؟', deleteBody: 'ستختفي من الشات عند الجميع.',
      moderateTitle: 'تنفيذ إجراء الإدارة؟', cancel: 'إلغاء', confirm: 'تأكيد', compression: 'جاري تحسين الصور…',
      sending: 'جاري الإرسال…', uploadFailed: 'لم تُرسل الرسالة، ومسودتك ما زالت محفوظة.',
      tooMany: 'يمكنك إرفاق 4 صور كحد أقصى.', tooLarge: 'الحد الأقصى للصورة الأصلية 15 ميجابايت.',
      badImage: 'تعذر قراءة هذه الصورة.', profile: 'اختر اسمًا للمجتمع من الإعدادات لاستخدام المنشن.',
      noGames: 'لا توجد ألعاب مطابقة.', label: 'اكتب تاق', chooseLabel: 'اختر تاق للصورة', clearLabel: 'بدون تاق', dlssOn: 'DLSS 5 ON', dlssOff: 'DLSS 5 OFF',
      fit: 'ملاءمة', copied: 'تم النسخ.', saved: 'تم حفظ الصورة.', online: 'التحديث المباشر متصل',
      unnamed: 'Anonymous', unavailable: 'Message unavailable', photo: 'Photo', message: 'Message', more: 'More', admin: 'ADMIN',
      attach: 'Attach', send: 'Send', close: 'Close', attachment: 'Chat attachment',
      previousImage: 'Previous image', nextImage: 'Next image', zoomOut: 'Zoom out', zoomIn: 'Zoom in'
    }
  };
  const words = () => {
    const lang = window.i18n?.getLang?.() || 'en';
    if (lang.startsWith('ar')) return L.ar;
    if (lang === 'zh') return window.zhChat;
    return L.en;
  };
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  const state = {
    messages: [], etag: null, version: 0, hasMore: false, timer: null, busy: false, initial: true,
    people: [], picked: [], me: null, admin: null, reply: null, editing: null, attachments: [], game: null,
    unread: 0, mine: readJson(MINE_KEY, {}), gameTimer: null, suppressed: new Map(),
    viewer: { images: [], index: 0, message: null, scale: 1, base: 1, x: 0, y: 0, dragging: null }
  };

  const active = () => $('view-chat')?.classList.contains('active');
  const isMine = by => Boolean(state.me?.tag) && !by?.admin && by?.tag === state.me.tag;
  const isAdminMine = by => Boolean(state.admin?.id) && by?.admin && by?.id === state.admin.id;
  // Administrator mode is a separate public identity. A normal community
  // message from the same installation must still use moderation routes;
  // treating it as "mine" sends it to the admin-own-message endpoint and the
  // server correctly refuses it.
  const mine = by => state.admin ? isAdminMine(by) : isMine(by);
  const atBottom = () => $('chatRoom').scrollHeight - $('chatRoom').scrollTop - $('chatRoom').clientHeight < 90;
  const saveMine = () => { try { localStorage.setItem(MINE_KEY, JSON.stringify(state.mine)); } catch {} };
  const ago = at => {
    const seconds = Math.round((Number(at) - Date.now()) / 1000);
    const steps = [[60,'second'],[60,'minute'],[24,'hour'],[7,'day'],[4.35,'week'],[12,'month'],[Infinity,'year']];
    let value = seconds, unit = 'second';
    for (const [size, name] of steps) { if (Math.abs(value) < size) { unit = name; break; } value /= size; unit = name; }
    try { return new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', { numeric: 'auto' }).format(Math.round(value), unit); }
    catch { return ''; }
  };
  const dayKey = at => new Date(Number(at)).toLocaleDateString(document.documentElement.lang || 'en', { weekday: 'long', month: 'short', day: 'numeric' });
  const sameAuthor = (a, b) => a && b && a.by?.tag === b.by?.tag && a.by?.id === b.by?.id && Boolean(a.by?.admin) === Boolean(b.by?.admin) && b.at - a.at < 5 * 60 * 1000;

  function avatar(by) {
    return by?.avatar ? `<img src="${esc(by.avatar)}" alt="" referrerpolicy="no-referrer">`
      : esc(avatars[Number(by?.icon) || 0] || avatars[0]);
  }
  function richBody(body) {
    return esc(body || '').replace(/(^|\s)(@[\p{L}\p{N}_-]{2,24})/gu, '$1<span class="mention">$2</span>');
  }
  function gameStatus(game) {
    const status = ['working','mixed','broken'].includes(game?.status) ? game.status : 'unknown';
    return { status, label: words()[status] || words().unknown };
  }
  function gameCard(game) {
    if (!game) return '';
    const status = gameStatus(game);
    const art = game.art || {};
    const background = art.hero || art.poster;
    return `<button class="chat-game-card" data-chat-game="${esc(game.key)}" type="button">
      ${background ? `<img class="chat-game-art" src="${esc(background)}" alt="" referrerpolicy="no-referrer">` : ''}
      ${art.poster ? `<img class="chat-game-poster" src="${esc(art.poster)}" alt="" referrerpolicy="no-referrer">` : '<span></span>'}
      <span class="chat-game-info"><span class="chat-game-state ${status.status}"><i></i>${esc(status.label)}</span><b>${esc(game.title)}</b><span class="chat-game-counts"><span>▱ ${esc(words().reports(game.reports || 0))}</span><span>◯ ${esc(words().comments(game.comments || 0))}</span></span></span>
      <span class="chat-game-arrow">›</span></button>`;
  }
  function imagesHtml(message) {
    const images = message.images || [];
    if (!images.length) return '';
    return `<div class="chat-images count-${Math.min(images.length,4)}">${images.map((image, index) => image.expired || !image.url
      ? `<div class="chat-image-expired">${esc(words().imageExpired)}</div>`
      : `<button class="chat-image" style="--image-ratio:${Number(image.width) || 16}/${Number(image.height) || 9}" data-chat-image="${index}" type="button"><img src="${esc(image.url)}" alt="" loading="lazy" referrerpolicy="no-referrer">${image.label ? `<span class="chat-image-label">${esc(image.label)}</span>` : ''}</button>`).join('')}</div>`;
  }
  function messageHtml(message, previous) {
    const compact = sameAuthor(previous, message) && dayKey(previous.at) === dayKey(message.at);
    const by = message.by || {};
    const reactions = Object.entries(message.reactions || {}).filter(([, count]) => count > 0);
    const quote = message.reply ? `<div class="chat-quote" data-chat-jump="${esc(message.reply.id)}"><div><b>${esc(message.reply.by?.name || (message.reply.unavailable ? words().unavailable : words().unnamed))}</b><span>${esc(message.reply.body || (message.reply.hasImages ? '📷 ' + words().photo : words().unavailable))}</span></div></div>` : '';
    return `<article class="chat-message${compact ? ' compact' : ''}${by.admin ? ' admin' : ''}" data-chat-message="${message.id}">
      <span class="chat-avatar">${avatar(by)}</span><div class="chat-content">
      ${compact ? '' : `<div class="chat-message-head"><span class="chat-author">${esc(by.name || words().unnamed)}</span>${by.admin ? `<span class="chat-admin-tag">${esc(words().admin)}</span>` : `<span class="chat-tag">#${esc(by.tag || '----')}</span>`}<time class="chat-time">${esc(ago(message.at))}</time>${message.editedAt ? `<span class="chat-edited">· ${esc(words().edited)}</span>` : ''}</div>`}
      ${quote}${message.body ? `<div class="chat-body">${richBody(message.body)}</div>` : ''}${imagesHtml(message)}${gameCard(message.game)}
      <div class="chat-actions">${reactions.map(([emoji,count]) => `<button class="chat-reaction${state.mine[`${message.id}:${emoji}`] ? ' mine' : ''}" data-chat-react="${esc(emoji)}" type="button"><span>${esc(emoji)}</span><b>${count}</b></button>`).join('')}<button class="chat-react-add" data-chat-react="❤️" type="button">♡</button></div></div>
      <div class="chat-quick-actions">${EMOJI.map(emoji => `<button data-chat-react="${esc(emoji)}" title="${esc(emoji)}" type="button">${esc(emoji)}</button>`).join('')}<button data-chat-reply title="${esc(words().reply)}" type="button">↩</button><button data-chat-menu title="${esc(words().more)}" type="button">•••</button></div>
    </article>`;
  }

  function paintMessages({ stick = false } = {}) {
    const room = $('chatRoom');
    const wasBottom = atBottom();
    let html = '', day = null;
    state.messages.forEach((message, index) => {
      const nextDay = dayKey(message.at);
      if (nextDay !== day) { day = nextDay; html += `<div class="chat-day"><span>${esc(day)}</span></div>`; }
      html += messageHtml(message, state.messages[index - 1]);
    });
    $('chatMessages').innerHTML = html;
    $('chatEmpty').classList.toggle('hidden', state.messages.length > 0);
    $('chatOlder').classList.toggle('hidden', !state.hasMore);
    if (stick || wasBottom) requestAnimationFrame(() => { room.scrollTop = room.scrollHeight; });
  }

  function updateUnread(count) {
    state.unread = Math.max(0, count || 0);
    $('chatNew').classList.toggle('hidden', !state.unread);
    $('chatNew').textContent = state.unread > 1 ? `${state.unread} ${words().newMessages}` : words().newMessages;
    const badge = $('chatNavUnread');
    badge.textContent = state.unread > 99 ? '99+' : String(state.unread || '');
    badge.classList.toggle('hidden', !state.unread);
  }

  async function loadIdentity() {
    const answer = await window.lab.communityChatMe();
    if (!answer?.ok) return;
    state.me = answer.me || null;
    state.admin = answer.profile?.admin || null;
  }
  async function loadPeople() {
    const answer = await window.lab.communityChatPeople();
    if (answer?.ok) state.people = answer.people || [];
  }
  function mergeLatest(feed, first) {
    const now = Date.now();
    for (const [id, until] of state.suppressed) if (until <= now) state.suppressed.delete(id);
    const incoming = (feed.messages || []).filter(item => !state.suppressed.has(String(item.id)));
    const oldMax = Math.max(0, ...state.messages.map(item => Number(item.id)));
    const newCount = incoming.filter(item => Number(item.id) > oldMax).length;
    if (first) state.messages = incoming;
    else if (!incoming.length) state.messages = [];
    else {
      const floor = Number(incoming[0].id);
      const older = state.messages.filter(item => Number(item.id) < floor);
      state.messages = older.concat(incoming);
    }
    state.hasMore = Boolean(feed.hasMore) || state.messages.length > incoming.length;
    state.version = Number(feed.version) || state.version;
    return newCount;
  }
  async function refresh({ first = false, manual = false } = {}) {
    if (state.busy) return;
    state.busy = true;
    const bottom = atBottom();
    try {
      const answer = await window.lab.communityChatFeed({ limit: 50, etag: manual ? null : state.etag });
      if (!answer?.ok) throw new Error(answer?.message || words().uploadFailed);
      if (answer.notModified) return;
      state.etag = answer.etag || null;
      const count = mergeLatest(answer.feed || {}, first);
      paintMessages({ stick: first || bottom });
      if (!bottom && count) updateUnread(state.unread + count);
      else if (bottom) updateUnread(0);
    } catch (error) { if (manual || first) notice(error.message, true); }
    finally { state.busy = false; }
  }
  async function loadOlder() {
    if (!state.messages.length || state.busy) return;
    state.busy = true;
    const room = $('chatRoom'), oldHeight = room.scrollHeight;
    try {
      const answer = await window.lab.communityChatFeed({ before: state.messages[0].id, limit: 50 });
      if (!answer?.ok) throw new Error(answer?.message || words().uploadFailed);
      const known = new Set(state.messages.map(item => String(item.id)));
      state.messages = (answer.feed?.messages || []).filter(item => !known.has(String(item.id)) && !state.suppressed.has(String(item.id))).concat(state.messages);
      state.hasMore = Boolean(answer.feed?.hasMore);
      paintMessages();
      requestAnimationFrame(() => { room.scrollTop += room.scrollHeight - oldHeight; });
    } catch (error) { notice(error.message, true); }
    finally { state.busy = false; }
  }
  function startPolling() {
    stopPolling();
    state.timer = setInterval(() => { if (active() && !document.hidden) refresh(); }, 3000);
  }
  function stopPolling() { if (state.timer) clearInterval(state.timer); state.timer = null; }

  function notice(message, error = false) {
    const node = $('chatComposeHint');
    node.textContent = message;
    node.style.color = error ? '#e5535e' : 'var(--accent-2)';
    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => { node.textContent = words().hint; node.style.color = ''; }, 4200);
  }
  function fitInput() {
    const input = $('chatInput');
    input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 104)}px`;
    $('chatLimit').textContent = `${input.value.length}/2000`;
    try { localStorage.setItem(DRAFT_KEY, input.value); } catch {}
  }
  function clearReply() { state.reply = null; state.editing = null; paintDraft(); }
  function setReply(message) {
    state.editing = null; state.reply = message;
    const input = $('chatInput');
    if (!mine(message.by) && message.by?.name && !input.value.includes(`@${message.by.name}`)) input.value = `@${message.by.name} ${input.value}`;
    paintDraft(); fitInput(); input.focus(); input.setSelectionRange(input.value.length, input.value.length);
  }
  function startEdit(message) {
    state.reply = null; state.editing = message; $('chatInput').value = message.body || '';
    paintDraft(); fitInput(); $('chatInput').focus();
  }
  function paintDraft() {
    const reply = state.editing || state.reply;
    const preview = $('chatReplyPreview');
    preview.classList.toggle('hidden', !reply);
    if (reply) preview.innerHTML = `<b>${esc(state.editing ? words().editing : `${words().replying}: ${reply.by?.name || words().unnamed}`)}</b><span>${esc(reply.body || (reply.images?.length ? '📷 ' + words().photo : reply.game?.title || words().message))}</span><button type="button" data-chat-cancel-reply aria-label="${esc(words().cancel)}">✕</button>`;
    const strip = $('chatAttachments');
    const has = state.attachments.length || state.game;
    strip.classList.toggle('hidden', !has);
    strip.innerHTML = state.attachments.map((item, index) => `<div class="chat-draft-image"><img src="${esc(item.url)}" alt=""><button class="chat-draft-remove" data-remove-image="${index}" type="button" aria-label="${esc(words().remove)}">✕</button><div class="chat-draft-label-control"><input class="chat-draft-label" data-image-label="${index}" maxlength="32" value="${esc(item.label || '')}" placeholder="${esc(words().label)}"><button class="chat-draft-label-toggle" data-image-label-menu="${index}" type="button" aria-label="${esc(words().chooseLabel)}" aria-expanded="false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg></button></div></div>`).join('') + (state.game ? `<div class="chat-draft-game"><b>${esc(state.game.title)}</b><span>${esc(words().reports(state.game.reports || 0))}</span><button class="chat-draft-remove" data-remove-game type="button" aria-label="${esc(words().remove)}">✕</button></div>` : '');
  }

  const canvasBlob = (canvas, quality) => new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
  async function compress(file) {
    if (!file || !String(file.type).startsWith('image/')) throw new Error(words().badImage);
    if (file.size > MAX_ORIGINAL) throw new Error(words().tooLarge);
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { throw new Error(words().badImage); }
    let scale = Math.min(1, 2560 / bitmap.width, 1440 / bitmap.height);
    let width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
    let blob = null;
    for (let pass = 0; pass < 8; pass++) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#101318'; context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(bitmap, 0, 0, width, height);
      blob = await canvasBlob(canvas, pass < 2 ? .86 - pass * .08 : .72);
      if (blob && blob.size <= MAX_COMPRESSED) break;
      width = Math.max(640, Math.round(width * .84)); height = Math.max(360, Math.round(height * .84));
    }
    bitmap.close();
    if (!blob || blob.size > MAX_COMPRESSED) throw new Error(words().badImage);
    return { blob, width, height, bytes: blob.size, url: URL.createObjectURL(blob), label: '' };
  }
  async function addFiles(files) {
    const picked = [...files].filter(file => String(file.type).startsWith('image/'));
    if (!picked.length) return;
    if (state.attachments.length + picked.length > MAX_IMAGES) return notice(words().tooMany, true);
    notice(words().compression);
    try {
      const compressed = await Promise.all(picked.map(compress));
      state.attachments.push(...compressed); paintDraft(); notice(`${compressed.length} ✓`);
    } catch (error) { notice(error.message, true); }
  }
  function removeAttachment(index) {
    const [item] = state.attachments.splice(index, 1); if (item?.url) URL.revokeObjectURL(item.url); paintDraft();
  }
  function clearAttachments() { closeLabelMenu(); for (const item of state.attachments) if (item.url) URL.revokeObjectURL(item.url); state.attachments = []; state.game = null; paintDraft(); }

  function closeLabelMenu() {
    const menu = $('chatLabelMenu');
    if (!menu) return;
    if (typeof menu.hidePopover === 'function' && menu.matches(':popover-open')) menu.hidePopover();
    menu.classList.add('hidden');
    document.querySelectorAll('[data-image-label-menu][aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  }
  function openLabelMenu(button, index) {
    const menu = $('chatLabelMenu');
    if (!menu || !state.attachments[index]) return;
    const wasOpen = menu.dataset.index === String(index) && !menu.classList.contains('hidden');
    closeLabelMenu();
    if (wasOpen) return;
    menu.dataset.index = String(index);
    menu.innerHTML = `<button data-label-value="${esc(words().dlssOn)}" type="button"><i class="on"></i><span>${esc(words().dlssOn)}</span></button><button data-label-value="${esc(words().dlssOff)}" type="button"><i class="off"></i><span>${esc(words().dlssOff)}</span></button><button data-label-value="" type="button"><i class="none"></i><span>${esc(words().clearLabel)}</span></button>`;
    menu.classList.remove('hidden'); button.setAttribute('aria-expanded', 'true');
    if (typeof menu.showPopover === 'function' && !menu.matches(':popover-open')) menu.showPopover();
    const rect = button.getBoundingClientRect();
    const width = 190, height = menu.offsetHeight;
    menu.style.left = `${Math.max(8, Math.min(rect.right - width, innerWidth - width - 8))}px`;
    menu.style.top = `${Math.max(8, rect.top - height - 8)}px`;
  }
  function chooseLabel(value) {
    const menu = $('chatLabelMenu'), index = Number(menu?.dataset.index);
    if (state.attachments[index]) state.attachments[index].label = String(value || '').slice(0, 32);
    closeLabelMenu(); paintDraft();
    document.querySelector(`[data-image-label="${index}"]`)?.focus();
  }

  function mentionMenu() {
    const input = $('chatInput');
    const query = window.mentions.mentionQuery(input.value, input.selectionStart);
    const menu = $('chatMentions');
    if (!query) return menu.classList.add('hidden');
    const matches = window.mentions.matchNames(state.people, query.query, 7);
    menu.classList.toggle('hidden', !matches.length);
    menu.innerHTML = matches.map((person, index) => `<button data-mention="${index}" type="button"><i>${esc(avatars[Number(person.icon) || 0])}</i><span>${esc(person.name)}</span><small>#${esc(person.tag)}</small></button>`).join('');
    menu.dataset.start = query.start; menu._matches = matches;
  }
  function chooseMention(index) {
    const menu = $('chatMentions'), person = menu._matches?.[index]; if (!person) return;
    const input = $('chatInput');
    const next = window.mentions.insertMention(input.value, input.selectionStart, Number(menu.dataset.start), person.name);
    input.value = next.value; input.setSelectionRange(next.caret, next.caret); state.picked.push(person);
    menu.classList.add('hidden'); fitInput(); input.focus();
  }

  async function send() {
    if (state.busy) return;
    const input = $('chatInput'), body = input.value.trim();
    if (!body && !state.attachments.length && !state.game) return;
    state.busy = true; $('chatSend').disabled = true; notice(words().sending);
    try {
      if (state.editing) {
        const answer = await window.lab.communityChatEdit(state.editing.id, body);
        if (!answer?.ok) throw new Error(answer?.message || words().uploadFailed);
      } else {
        const uploads = await Promise.all(state.attachments.map(async item => {
          const bytes = await item.blob.arrayBuffer();
          const answer = await window.lab.communityChatUpload({ mime: 'image/webp', width: item.width, height: item.height, bytes: item.bytes, label: item.label || null }, bytes);
          if (!answer?.ok) throw new Error(answer?.message || words().uploadFailed);
          return answer.token;
        }));
        const mentions = window.mentions.stillNamed(body, state.picked);
        const answer = await window.lab.communityChatPost({ body, uploads, mentions, replyTo: state.reply?.id || null, gameKey: state.game?.key || null });
        if (!answer?.ok) throw new Error(answer?.message || words().uploadFailed);
      }
      input.value = ''; try { localStorage.removeItem(DRAFT_KEY); } catch {}
      state.reply = null; state.editing = null; state.picked = []; clearAttachments(); fitInput();
      state.etag = null; state.busy = false; await refresh({ manual: true });
    } catch (error) { notice(`${words().uploadFailed} ${error.message || ''}`, true); }
    finally { state.busy = false; $('chatSend').disabled = false; }
  }

  async function searchGames() {
    const query = $('chatGameSearch').value.trim();
    $('chatGameResults').innerHTML = '';
    const answer = await window.lab.communityCards({ q: query, limit: 12 });
    if (!answer?.ok) return;
    const cards = answer.cards || [];
    $('chatGameResults').innerHTML = cards.length ? cards.map((game, index) => `<button class="chat-game-result" data-pick-game="${index}" type="button">${game.art?.poster ? `<img src="${esc(game.art.poster)}" alt="" referrerpolicy="no-referrer">` : '<i>🎮</i>'}<span><b>${esc(game.title)}</b><span>${esc(words().reports(game.reports || 0))} · ${esc(words().comments(game.comments || 0))}</span></span><em>+</em></button>`).join('') : `<p class="chat-empty">${esc(words().noGames)}</p>`;
    $('chatGameResults')._cards = cards;
  }
  function openAttach() { $('chatGamePicker').classList.add('hidden'); $('chatAttachDialog').showModal(); }

  function viewerTransform() {
    const v = state.viewer;
    $('chatViewerImage').style.transform = `translate(${v.x}px,${v.y}px) scale(${v.scale})`;
    $('chatZoomValue').textContent = `${Math.round(v.scale / v.base * 100)}%`;
  }
  function resetViewer() {
    const image = $('chatViewerImage'), stage = $('chatViewerStage'), v = state.viewer;
    const width = image.naturalWidth || 1, height = image.naturalHeight || 1;
    v.base = Math.min((stage.clientWidth - 120) / width, (stage.clientHeight - 100) / height, 1);
    v.scale = v.base; v.x = -width * v.scale / 2; v.y = -height * v.scale / 2; viewerTransform();
  }
  function showViewer(index) {
    const v = state.viewer, item = v.images[index]; if (!item?.url) return;
    v.index = index; $('chatViewerImage').src = item.url;
    $('chatViewerCount').textContent = `${index + 1} / ${v.images.length}`;
    $('chatViewerLabel').textContent = item.label || '';
    $('chatViewerPrev').classList.toggle('hidden', v.images.length < 2);
    $('chatViewerNext').classList.toggle('hidden', v.images.length < 2);
    if ($('chatViewerImage').complete) resetViewer();
  }
  function openViewer(message, index) {
    state.viewer.images = (message.images || []).filter(item => item.url && !item.expired);
    state.viewer.message = message;
    const source = message.images[index]; const actual = state.viewer.images.indexOf(source);
    $('chatViewer').showModal(); showViewer(Math.max(0, actual));
  }
  function moveViewer(step) { const v = state.viewer; showViewer((v.index + step + v.images.length) % v.images.length); }
  function zoomViewer(factor, clientX, clientY) {
    const v = state.viewer, stage = $('chatViewerStage'), rect = stage.getBoundingClientRect();
    const px = (clientX == null ? rect.width / 2 : clientX - rect.left) - rect.width / 2;
    const py = (clientY == null ? rect.height / 2 : clientY - rect.top) - rect.height / 2;
    const next = Math.min(v.base * 8, Math.max(v.base, v.scale * factor));
    const wx = (px - v.x) / v.scale, wy = (py - v.y) / v.scale;
    v.x = px - wx * next; v.y = py - wy * next; v.scale = next; viewerTransform();
  }

  function messageByNode(node) { return state.messages.find(item => String(item.id) === node?.closest('[data-chat-message]')?.dataset.chatMessage); }
  async function confirmAction(title, body, confirm = words().confirm) {
    closeLabelMenu(); closeContext();
    const ask = window.ask || window.askDialog?.ask;
    if (typeof ask !== 'function') return false;
    return ask({ icon: 'trash', title, body, confirm, cancel: words().cancel, tone: 'danger' });
  }
  function suppressMessage(message, action = 'delete') {
    const blockedTag = action === 'block' && !message.by?.admin ? message.by?.tag : null;
    const removed = state.messages.filter(item => String(item.id) === String(message.id) || (blockedTag && item.by?.tag === blockedTag && !item.by?.admin));
    for (const item of removed) state.suppressed.set(String(item.id), Date.now() + 15_000);
    state.messages = state.messages.filter(item => !removed.includes(item));
    paintMessages();
  }
  async function deleteMessage(message) {
    if (!await confirmAction(words().deleteTitle, words().deleteBody, words().remove)) return;
    const answer = await window.lab.communityChatDelete(message.id);
    if (!answer?.ok) return notice(answer?.message || words().uploadFailed, true);
    suppressMessage(message); state.etag = null;
  }
  async function moderate(message, action) {
    if (!await confirmAction(words().moderateTitle, words()[action === 'delete' ? 'adminDelete' : action], words().confirm)) return;
    const answer = await window.lab.communityChatModerate(message.id, action);
    if (!answer?.ok) return notice(answer?.message || words().uploadFailed, true);
    suppressMessage(message, action); state.etag = null;
  }
  async function react(message, emoji) {
    const key = `${message.id}:${emoji}`, on = !state.mine[key];
    const answer = await window.lab.communityChatReaction(message.id, emoji, on);
    if (!answer?.ok) return notice(answer?.message || words().uploadFailed, true);
    if (on) state.mine[key] = true; else delete state.mine[key]; saveMine();
    message.reactions = answer.result?.reactions || message.reactions; paintMessages();
  }
  function contextMenu(event, message, image = null) {
    event.preventDefault();
    const menu = $('chatContext');
    const actions = [];
    if (image?.url) actions.push(['save', words().saveImage]);
    actions.push(['reply', words().reply]);
    if (message.body) actions.push(['copy', words().copy]);
    if (mine(message.by)) actions.push(['edit', words().edit], ['delete', words().remove, true]);
    if (state.admin && !mine(message.by)) actions.push(['hide', words().hide], ['delete-admin', words().adminDelete, true], ...(message.by?.admin ? [] : [['block', words().block, true]]));
    menu.innerHTML = actions.map(([action,label,danger]) => `<button class="${danger ? 'danger' : ''}" data-context-action="${action}" type="button">${esc(label)}</button>`).join('');
    menu._message = message; menu._image = image;
    const host = $('chatViewer').open ? $('chatViewer') : document.body;
    if (menu.parentElement !== host) host.appendChild(menu);
    menu.classList.remove('hidden');
    if (typeof menu.showPopover === 'function' && !menu.matches(':popover-open')) menu.showPopover();
    const width = 208, height = menu.offsetHeight;
    menu.style.left = `${Math.max(8, Math.min(event.clientX, innerWidth - width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, innerHeight - height - 8))}px`;
  }
  function closeContext() {
    const menu = $('chatContext');
    if (typeof menu.hidePopover === 'function' && menu.matches(':popover-open')) menu.hidePopover();
    menu.classList.add('hidden');
  }
  async function contextAction(action) {
    const menu = $('chatContext'), message = menu._message, image = menu._image; closeContext();
    if (!message) return;
    if (action === 'reply') setReply(message);
    else if (action === 'copy') { await window.lab.copyText(message.body || ''); notice(words().copied); }
    else if (action === 'edit') startEdit(message);
    else if (action === 'delete') deleteMessage(message);
    else if (action === 'hide') moderate(message, 'hide');
    else if (action === 'delete-admin') moderate(message, 'delete');
    else if (action === 'block') moderate(message, 'block');
    else if (action === 'save' && image?.url) {
      const answer = await window.lab.communityChatSaveImage(image.url, `chat-${message.id}-${(message.images || []).indexOf(image) + 1}`);
      notice(answer?.ok ? words().saved : answer?.message || words().uploadFailed, !answer?.ok);
    }
  }

  function bind() {
    $('chatRefresh').onclick = () => refresh({ manual: true }); $('chatOlder').onclick = loadOlder;
    $('chatNew').onclick = () => { $('chatRoom').scrollTop = $('chatRoom').scrollHeight; updateUnread(0); };
    $('chatPlus').onclick = openAttach; $('chatChoosePhotos').onclick = () => $('chatFile').click();
    $('chatChooseGame').onclick = () => { $('chatGamePicker').classList.remove('hidden'); $('chatGameSearch').focus(); searchGames(); };
    $('chatFile').onchange = event => { addFiles(event.target.files); event.target.value = ''; $('chatAttachDialog').close(); };
    $('chatGameSearch').oninput = () => { clearTimeout(state.gameTimer); state.gameTimer = setTimeout(searchGames, 180); };
    $('chatGameResults').onclick = event => {
      const pick = event.target.closest('[data-pick-game]'); if (!pick) return;
      state.game = $('chatGameResults')._cards?.[Number(pick.dataset.pickGame)] || null; paintDraft(); $('chatAttachDialog').close();
    };
    document.querySelectorAll('[data-chat-close]').forEach(button => button.onclick = () => $(button.dataset.chatClose).close());
    $('chatAttachments').oninput = event => { const index = event.target.dataset.imageLabel; if (index != null && state.attachments[index]) state.attachments[index].label = event.target.value.slice(0,32); };
    $('chatAttachments').onclick = event => {
      const remove = event.target.closest('[data-remove-image]');
      if (remove) { event.preventDefault(); event.stopPropagation(); closeLabelMenu(); removeAttachment(Number(remove.dataset.removeImage)); return; }
      if (event.target.closest('[data-remove-game]')) { event.preventDefault(); event.stopPropagation(); state.game = null; paintDraft(); return; }
      const label = event.target.closest('[data-image-label-menu]');
      if (label) { event.preventDefault(); event.stopPropagation(); openLabelMenu(label, Number(label.dataset.imageLabelMenu)); }
    };
    $('chatLabelMenu').onclick = event => { const option = event.target.closest('[data-label-value]'); if (option) chooseLabel(option.dataset.labelValue); };
    $('chatReplyPreview').onclick = event => { if (event.target.closest('[data-chat-cancel-reply]')) clearReply(); };
    $('chatInput').oninput = () => { fitInput(); mentionMenu(); };
    $('chatInput').onkeydown = event => {
      if (!$('chatMentions').classList.contains('hidden') && event.key === 'Escape') { $('chatMentions').classList.add('hidden'); return; }
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(); }
    };
    $('chatMentions').onclick = event => { const pick = event.target.closest('[data-mention]'); if (pick) chooseMention(Number(pick.dataset.mention)); };
    $('chatSend').onclick = send;
    $('chatDropZone').ondragover = event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; $('chatDropZone').classList.add('dragging'); };
    $('chatDropZone').ondragleave = () => $('chatDropZone').classList.remove('dragging');
    $('chatDropZone').ondrop = event => { event.preventDefault(); $('chatDropZone').classList.remove('dragging'); addFiles(event.dataTransfer.files); };
    $('chatInput').onpaste = event => {
      const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
      if (files.length) { event.preventDefault(); addFiles(files); }
    };
    $('chatRoom').onscroll = () => { if (atBottom()) updateUnread(0); };
    $('chatMessages').onclick = event => {
      const message = messageByNode(event.target); if (!message) return;
      const image = event.target.closest('[data-chat-image]'); if (image) return openViewer(message, Number(image.dataset.chatImage));
      const game = event.target.closest('[data-chat-game]'); if (game) return window.communityUi?.openCard?.(game.dataset.chatGame);
      const jump = event.target.closest('[data-chat-jump]'); if (jump) return document.querySelector(`[data-chat-message="${CSS.escape(jump.dataset.chatJump)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const reaction = event.target.closest('[data-chat-react]'); if (reaction) return react(message, reaction.dataset.chatReact);
      if (event.target.closest('[data-chat-reply]')) return setReply(message);
      if (event.target.closest('[data-chat-menu]')) {
        const box = event.target.closest('[data-chat-menu]').getBoundingClientRect();
        return contextMenu({ preventDefault(){}, clientX:box.right, clientY:box.bottom }, message);
      }
    };
    $('chatMessages').oncontextmenu = event => { const message = messageByNode(event.target); if (!message) return; const index = event.target.closest('[data-chat-image]')?.dataset.chatImage; contextMenu(event, message, index == null ? null : message.images?.[Number(index)]); };
    $('chatContext').onclick = event => { const button = event.target.closest('[data-context-action]'); if (button) contextAction(button.dataset.contextAction); };
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('#chatContext') && !event.target.closest('[data-chat-menu]')) closeContext();
      if (!event.target.closest('#chatLabelMenu') && !event.target.closest('[data-image-label-menu]')) closeLabelMenu();
    });
    $('chatViewerImage').onload = resetViewer; $('chatViewerClose').onclick = () => $('chatViewer').close();
    $('chatViewerPrev').onclick = () => moveViewer(-1); $('chatViewerNext').onclick = () => moveViewer(1);
    $('chatZoomIn').onclick = () => zoomViewer(1.25); $('chatZoomOut').onclick = () => zoomViewer(.8); $('chatZoomReset').onclick = resetViewer;
    $('chatViewerStage').onwheel = event => { event.preventDefault(); zoomViewer(event.deltaY < 0 ? 1.16 : .86, event.clientX, event.clientY); };
    $('chatViewerStage').onpointerdown = event => { const v = state.viewer; v.dragging = { x:event.clientX, y:event.clientY, ox:v.x, oy:v.y }; $('chatViewerStage').setPointerCapture(event.pointerId); $('chatViewerStage').classList.add('grabbing'); };
    $('chatViewerStage').onpointermove = event => { const drag = state.viewer.dragging; if (!drag) return; state.viewer.x = drag.ox + event.clientX - drag.x; state.viewer.y = drag.oy + event.clientY - drag.y; viewerTransform(); };
    $('chatViewerStage').onpointerup = () => { state.viewer.dragging = null; $('chatViewerStage').classList.remove('grabbing'); };
    $('chatViewer').oncontextmenu = event => { event.preventDefault(); const v = state.viewer; contextMenu(event, v.message, v.images[v.index]); };
    document.addEventListener('keydown', event => {
      if (!$('chatViewer').open) return;
      if (event.key === 'ArrowLeft') moveViewer(-1); else if (event.key === 'ArrowRight') moveViewer(1); else if (event.key === 'Escape') $('chatViewer').close(); else if (event.key === '+' || event.key === '=') zoomViewer(1.25); else if (event.key === '-') zoomViewer(.8);
    });
  }

  function applyLanguage() {
    const w = words();
    const map = { navChat:'nav',chatTitle:'title',chatSubtitle:'subtitle',chatRetention:'retention',chatRefresh:'refresh',chatOlder:'older',chatComposeHint:'hint',chatAttachTitle:'share',chatGameSearchLabel:'findGame' };
    for (const [id,key] of Object.entries(map)) if ($(id)) $(id).textContent = w[key];
    $('chatInput').placeholder = w.placeholder; $('chatGameSearch').placeholder = w.findPlaceholder;
    $('chatEmpty').innerHTML = `<i>💬</i><b>${esc(w.emptyTitle)}</b><span>${esc(w.emptyBody)}</span>`;
    $('chatChoosePhotos').querySelector('b').textContent = w.photos; $('chatChoosePhotos').querySelector('span').textContent = w.photosSub;
    $('chatChooseGame').querySelector('b').textContent = w.game; $('chatChooseGame').querySelector('span').textContent = w.gameSub;
    document.querySelector('.chat-dialog-kicker').textContent = w.addTo;
    const controls = { chatPlus: w.attach, chatSend: w.send, chatViewerClose: w.close, chatViewerPrev: w.previousImage, chatViewerNext: w.nextImage, chatZoomOut: w.zoomOut, chatZoomIn: w.zoomIn };
    for (const [id, label] of Object.entries(controls)) if ($(id)) { $(id).setAttribute('aria-label', label); $(id).title = label; }
    document.querySelectorAll('[data-chat-close]').forEach(button => { button.setAttribute('aria-label', w.close); button.title = w.close; });
    $('chatViewerImage').alt = w.attachment;
    $('chatZoomReset').textContent = w.fit; paintDraft(); if (state.messages.length) paintMessages();
  }
  async function render() {
    applyLanguage();
    if (state.initial) {
      state.initial = false;
      try { $('chatInput').value = localStorage.getItem(DRAFT_KEY) || ''; } catch { $('chatInput').value = ''; }
      fitInput();
      await Promise.allSettled([loadIdentity(), loadPeople(), refresh({ first: true })]);
      paintMessages();
    } else {
      // The administrator can sign in or out from Settings while Chat keeps
      // its renderer state alive. Reload the identity whenever Chat is opened
      // so its edit/delete/moderation menu cannot retain the previous role.
      await Promise.allSettled([loadIdentity(), loadPeople(), refresh()]);
      paintMessages();
    }
    startPolling();
  }

  // Opened from a notification: find that message once the page has loaded it,
  // bring it into view, and light it for a moment so the eye lands on it.
  async function focusMessage(id) {
    const selector = `[data-chat-message="${CSS.escape(String(id))}"]`;
    let node = null;
    for (let tries = 0; tries < 25 && !node; tries++) {
      node = document.querySelector(selector);
      if (!node) await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!node) return false;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('chat-flash');
    setTimeout(() => node.classList.remove('chat-flash'), 2600);
    return true;
  }

  bind(); applyLanguage();
  window.chatUi = { render, stopPolling, applyLanguage, focusMessage };
})();
