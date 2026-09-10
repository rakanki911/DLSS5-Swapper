'use strict';
(()=>{
const $=id=>document.getElementById(id),text=(en,ar)=>document.documentElement.lang==='ar'?ar:en;
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const builtInThemes=[['green','Emerald','الأخضر'],['blue','Azure','الأزرق'],['purple','Amethyst','البنفسجي']];
// The saved custom theme sits alongside the built-in three; its label is
// whatever the person typed, in either language.
const themeList=()=>prefs&&prefs.custom
  ? [...builtInThemes,['custom',prefs.custom.name,prefs.custom.name]]
  : builtInThemes;
let prefs,busy=false,generation=0,observer,draft;
const keyName=k=>k>=112?`F${k-111}`:({32:'Space',33:'PageUp',34:'PageDown',35:'End',37:'Left',38:'Up',39:'Right',40:'Down',45:'Insert',46:'Delete'}[k]||String.fromCharCode(k));
const keyLabel=h=>[h.mods&1?'Ctrl':'',h.mods&2?'Alt':'',h.mods&4?'Shift':'',keyName(h.key)].filter(Boolean).join(' + ');
const button=(action,id,label)=>`<button class="ghost sm" data-ol-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
function dispose(){observer?.disconnect();document.querySelectorAll('.ol-static-panel').forEach(e=>e._overlayDispose?.());}
function preview(id){const root=$('olPreview');root._overlayDispose?.();window.applyOverlayTheme(root,{theme:id,custom:prefs&&prefs.custom});window.mountOverlayLive(root,{designOnly:true});$('olPreviewLabel').textContent=text('Interactive demo · no game changes','معاينة تفاعلية · لا تغيّر اللعبة');$('olPreviewDialog').showModal();}
async function save(patch){if(busy)return false;busy=true;try{const r=await window.lab.saveOverlayPreferences(patch);if(!r.ok)throw Error(r.error);prefs=r.value;$('olStatus').textContent=text('Saved.','تم الحفظ.');return true;}catch(e){$('olStatus').textContent=e.message;return false;}finally{busy=false;await render();}}
async function render(){
 const run=++generation,[r,s]=await Promise.all([window.lab.overlays(),window.lab.overlayPreferences()]);if(run!==generation)return;
 if(!r.ok||!s.ok){$('olStatus').textContent=r.error||s.error;return;}prefs=s.value;
 $('olSubtitle').textContent=text('Choose your style. Preview it, then make it yours.','اختر ثيمك، جرّبه في المعاينة، ثم حدده.');
 $('olEnabled').checked=prefs.enabled;$('olEnabledLabel').textContent=text('Install overlay with DLSS','تثبيت الأوفرلاي مع DLSS');$('olHotkey').textContent=`Hotkey · ${keyLabel(prefs.hotkey)}`;
 $('olAdd').textContent=text('＋ Add Overlay','＋ إضافة أوفرلاي');$('olSource').textContent=text('Developer files','ملفات المطورين');dispose();
 $('olThemeGallery').innerHTML=themeList().map(([id,en,ar])=>`<article class="ol-theme-card ${prefs.theme===id?'selected':''}" data-overlay-theme="${id}"><div class="ol-card-stage"><div class="ol-static-panel" inert aria-hidden="true"></div></div><div class="ol-theme-bottom"><h3>${text(en,ar)}</h3><div class="ol-actions"><button class="ol-select" data-ol-action="select" data-id="${id}" aria-pressed="${prefs.theme===id}">${prefs.theme===id?text('✓ Selected','✓ محدد'):text('Select','اختيار')}</button>${button('preview',id,text('◉ Preview','◉ معاينة'))}${id==='custom'?`<button class="drop" data-ol-action="delete-theme" data-id="custom" title="${text('Delete this theme','حذف هذا الثيم')}" aria-label="${text('Delete this theme','حذف هذا الثيم')}"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>`:''}</div></div></article>`).join('');
 for(const root of document.querySelectorAll('.ol-static-panel')){window.mountOverlayLive(root,{designOnly:true});root.querySelectorAll('.ol-live-modes,.ol-preview-backend').forEach(e=>e.remove());root.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));root.querySelectorAll('[for]').forEach(e=>e.removeAttribute('for'));}
 observer=new ResizeObserver(entries=>{for(const {target} of entries){const width=target.clientWidth;if(target.dataset.width===String(width))continue;target.dataset.width=width;requestAnimationFrame(()=>{if(!target.isConnected)return;const scale=width/534;target.firstElementChild.style.transform=`scale(${scale})`;target.style.height=`${target.firstElementChild.scrollHeight*scale}px`;});}});document.querySelectorAll('.ol-card-stage').forEach(e=>observer.observe(e));
 for(const card of $('olThemeGallery').querySelectorAll('[data-overlay-theme=custom]'))
   window.applyOverlayTheme(card,{theme:'custom',custom:prefs.custom});
 $('olLibrary').innerHTML=r.value.overlays.filter(e=>!e.builtin).map(e=>`<article class="ol-card"><h3>${esc(e.name)}</h3><p>${text('Custom native overlay: browser preview unavailable. Only test trusted files.','أوفرلاي خارجي لا يدعم معاينة المتصفح. اختبر الملفات الموثوقة فقط.')}</p><div class="ol-actions">${button('install',e.id,text('Install separately','تثبيت منفصل'))}${button('remove',e.id,text('Remove','إزالة'))}</div></article>`).join('');
 const builtinName=(r.value.overlays.find(o=>o.id==='builtin')||{}).name;
 $('olInstalls').innerHTML=r.value.installations.length?`<details><summary>${text('Existing installations','التثبيتات الحالية')} (${r.value.installations.length})</summary>${r.value.installations.map(e=>`<article class="ol-card"><b>${esc(e.overlayId==='builtin'&&builtinName?builtinName:e.name)}</b><p>${esc(e.directory)}</p>${button('uninstall',e.id,text('Remove overlay only','إزالة الأوفرلاي فقط'))}</article>`).join('')}</details>`:'';
 if(r.value.errors.length)$('olStatus').textContent=r.value.errors.join('\n');
 await showBridge();
}
// The panel in the game says it is waiting; this says what for. Without it
// there is no way to tell a service that never started from a game that has
// not attached yet.
async function showBridge(){
 const box=$('olBridge'); if(!box)return;
 let state=null;
 try{const r=await window.lab.overlayBridge(); if(r&&r.ok)state=r.value;}catch{}
 // A missing add-on outranks anything about the service: it is the reason no
 // game will ever attach, and it used to leave the page saying "ready".
 if(state&&state.addon===false){
  box.dataset.state='off';
  box.textContent=text(
   `The overlay add-on is missing from this app, so no game can load it: ${state.addonFile||''}. Antivirus software removes this file - restore it from your antivirus quarantine and add an exclusion, or reinstall DLSS 5 Swapper.`,
   `ملف الأوفرلاي مفقود من البرنامج، فلا تستطيع أي لعبة تحميله: ${state.addonFile||''}. برامج الحماية تحذف هذا الملف - استعده من الحجر الصحي وأضف استثناءً، أو أعد تثبيت البرنامج.`);
  return;
 }
 if(!state||!state.listening){
  box.dataset.state='off';
  box.textContent=text('Overlay service is not running. Restart DLSS 5 Swapper, then press the hotkey in game.',
   'خدمة الأوفرلاي لا تعمل. أعد تشغيل البرنامج ثم اضغط زر الاختصار داخل اللعبة.');
  return;
 }
 if(state.connected){
  box.dataset.state='on';
  box.textContent=text('Overlay service connected to a running game.','خدمة الأوفرلاي متصلة بلعبة تعمل الآن.');
  return;
 }
 box.dataset.state='ready';
 box.textContent=text('Overlay service ready, waiting for a game. Keep DLSS 5 Swapper open and press the hotkey in game.',
  'خدمة الأوفرلاي جاهزة وتنتظر لعبة. أبقِ البرنامج مفتوحاً واضغط زر الاختصار داخل اللعبة.');
}
async function action(name,id){if(busy)return;if(name==='preview'){preview(id);return;}if(name==='select'){await save({theme:id});return;}if(name==='delete-theme'){await save({custom:null,theme:prefs.theme==='custom'?'green':prefs.theme});return;}busy=true;try{const r=await({add:window.lab.overlayAdd,remove:window.lab.overlayRemove,install:window.lab.overlayInstall,uninstall:window.lab.overlayUninstall,source:window.lab.overlaySource})[name](id);$('olStatus').textContent=r.ok?text('Done.','تم.'):r.error;}catch(e){$('olStatus').textContent=e.message;}finally{busy=false;await render();}}
$('olAdd').onclick=()=>action('add');$('olSource').onclick=()=>action('source');$('olEnabled').onchange=()=>save({enabled:$('olEnabled').checked});
$('olPreviewClose').onclick=()=>$('olPreviewDialog').close();$('olPreviewDialog').addEventListener('close',()=>{$('olPreview')._overlayDispose?.();$('olPreview').replaceChildren();});
// Create-a-theme dialog. The preview repaints on every colour change so the
// choice is judged on the real panel, not on a swatch.
function paintCustomPreview(){
  const root=$('olCustomPreview');root._overlayDispose?.();
  window.applyOverlayTheme(root,{theme:'custom',custom:{accent:$('olCustomColour').value,name:'x'}});
  window.mountOverlayLive(root,{designOnly:true});
}
$('olCustom').onclick=()=>{
  $('olCustomColour').value=(prefs.custom&&prefs.custom.accent)||'#ff7a00';
  $('olCustomName').value=(prefs.custom&&prefs.custom.name)||text('My theme','ثيمي');
  $('olCustomError').textContent='';
  $('olCustomTitle').textContent=text('Create a theme','إنشاء ثيم');
  $('olCustomHelp').textContent=text("Pick an accent colour. The panel's other shades are derived from it.",
    'اختر اللون الأساسي، وبقية درجات اللوحة تُشتق منه.');
  $('olCustomColourLabel').textContent=text('Colour','اللون');
  $('olCustomNameLabel').textContent=text('Name','الاسم');
  $('olCustomCancel').textContent=text('Cancel','إلغاء');
  $('olCustomSave').textContent=text('Save','حفظ');
  $('olCustomDialog').showModal();paintCustomPreview();
};
$('olCustomColour').oninput=paintCustomPreview;
$('olCustomCancel').onclick=()=>$('olCustomDialog').close();
$('olCustomDialog').addEventListener('close',()=>{$('olCustomPreview')._overlayDispose?.();$('olCustomPreview').replaceChildren();});
$('olCustomSave').onclick=async()=>{
  const name=$('olCustomName').value.trim();
  if(!name){$('olCustomError').textContent=text('Give the theme a name.','أعطِ الثيم اسماً.');return;}
  // Saved and selected together: creating a theme you then have to go and pick
  // is a step nobody wants.
  if(await save({custom:{accent:$('olCustomColour').value,name},theme:'custom'})){$('olCustomDialog').close();render();}
  else $('olCustomError').textContent=$('olStatus').textContent;
};
$('olHotkey').onclick=()=>{draft={...prefs.hotkey};$('olKeyCapture').textContent=keyLabel(draft);$('olKeyError').textContent='';$('olHotkeyDialog').showModal();$('olKeyCapture').focus();};
$('olKeyCapture').onkeydown=e=>{if(e.key==='Tab'||e.key==='Escape')return;e.preventDefault();e.stopPropagation();
 const key=/^Key[A-Z]$/.test(e.code)?e.code.charCodeAt(3):/^Digit[0-9]$/.test(e.code)?e.code.charCodeAt(5):/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)?111+Number(e.code.slice(1)):({Space:32,PageUp:33,PageDown:34,End:35,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,Insert:45,Delete:46}[e.code]);
 if(!key||e.metaKey){$('olKeyError').textContent=text('Reserved / unsupported key. Try F9 or Ctrl + Shift + O.','زر محجوز أو غير مدعوم. جرّب F9 أو Ctrl + Shift + O.');return;}
 draft={key,mods:(e.ctrlKey?1:0)|(e.altKey?2:0)|(e.shiftKey?4:0)};$('olKeyCapture').textContent=keyLabel(draft);$('olKeyError').textContent='';};
$('olKeyCancel').onclick=()=>$('olHotkeyDialog').close();$('olKeySave').onclick=async()=>{if(await save({hotkey:draft}))$('olHotkeyDialog').close();};
$('view-overlays').addEventListener('click',e=>{const b=e.target.closest('[data-ol-action]');if(b)action(b.dataset.olAction,b.dataset.id);});window.overlayLab={render};
})();
