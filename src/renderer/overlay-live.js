'use strict';
// The same connected-panel renderer powers the isolated preview. Sample
// edits stay in this closure and never call IPC or alter a game's settings.
window.mountOverlayLive = (root, { designOnly = false } = {}) => {
  const zhText=(en,zh)=>document.documentElement.lang==='zh'?zh:en;
  root._overlayDispose?.();
  const lifetime = new AbortController();
  const runtime = designOnly ? null : window.overlayRuntime;
  const sample = { epoch:1, nrAvailable:true, nrEnabled:true, effects:true, tools:[], nrTools:[
    ['Structure Intensity',0,1,0,2], ['Global Tone Intensity',0,1,0,2],
    ['Enable DLSS Neural Rendering',1,1,0,1], ['Automatic / Character Mask',1,1,0,1],
    ['Character/Skin Structure',0,1,-1,2], ['Overall Intensity',0,1,0,2],
    ['Local Tone Intensity',0,1,0,2], ['Diffuse White (nits)',0,203,80,500],
    ['Motion Scale X Multiplier',0,1,-2,2], ['Motion Scale Y Multiplier',0,1,-2,2],
    ['NR UI Correction',1,1,0,1], ['Enable Upscaling (WIP)',1,0,0,1],
    ['NR Preset',4,0,0,3,['Default','Preset #1','Preset #2','Preset #3']],
    ['NR Style',4,0,0,2,['Default','Natural','Cinematic']],
    ['Depth Convention',4,0,0,2,['Use game NGX flag','Force normal depth','Force inverted depth']]
  ].map(([name,kind,value,min,max,options],i)=>({id:101+i,name,kind,value,min,max,options,step:kind===0?.01:1,available:true,effect:'RenoDX v4.7'})) };
  let status = sample, epoch = 0, preview = true, connectedOnce = false, autoEpoch = 0;
  // Only reasons worth reading. While the bridge works the badge in the
  // header already says CONNECTED, so the line below it stays out of sight.
  const nrNote = () => !status ? zhText('Waiting for game connection','正在等待游戏连接')
    : status.nrAvailable ? '' : status.nrReason || zhText('RenoDX controls unavailable.','RenoDX 控件不可用。');
  const observer = new ResizeObserver(() => runtime?.resize(Math.ceil(root.getBoundingClientRect().height)));
  observer.observe(root);
  root._overlayDispose = () => { lifetime.abort(); observer.disconnect(); };
  const el = (tag, cls, text) => { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const send = (id, kind, value) => {
    if (status === sample) { const t=[...sample.nrTools,...(sample.feedTools||[])].find(t=>t.id===id);if(t&&value>=t.min&&value<=t.max){t.value=value;update();}return; }
    if (status) runtime?.setControl({ epoch: status.epoch, id, kind, value });
  };
  const closeChoices = except => root.querySelectorAll('.ol-dropdown').forEach(d => { if(d!==except) {d.querySelector('.ol-dropdown-menu').hidden=true;d.querySelector('.ol-dropdown-trigger').setAttribute('aria-expanded','false');} });
  document.addEventListener('pointerdown',e=>closeChoices(e.target.closest('.ol-dropdown')), {signal:lifetime.signal});
  root.addEventListener('scroll',e=>{if(!e.target.classList?.contains('ol-dropdown-menu'))closeChoices();},{capture:true,signal:lifetime.signal});
  function choice(t) {
    const box=el('div','ol-dropdown'), trigger=el('button','ol-dropdown-trigger'), menu=el('div','ol-dropdown-menu');
    trigger.type='button';trigger.dataset.liveId=t.id;trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',t.name);
    menu.hidden=true;menu.setAttribute('role','listbox');menu.setAttribute('aria-label',t.name);
    box.append(trigger,menu);
    const close=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');};
    trigger.updateChoice = tool => {
      const options=tool.options||t.options||[];
      trigger.textContent=options[tool.value-t.min]||zhText('Unavailable','不可用');
      if(JSON.stringify(options)!==menu.dataset.options) {
        menu.dataset.options=JSON.stringify(options);menu.replaceChildren(...options.map((text,i)=>{
          const option=el('button','ol-dropdown-option',text);option.type='button';option.dataset.value=i+t.min;option.setAttribute('role','option');
          option.onclick=()=>{send(t.id,t.kind,i+t.min);close();trigger.focus({preventScroll:true});};return option;
        }));
      }
      for(const o of menu.children)o.setAttribute('aria-selected',String(Number(o.dataset.value)===tool.value));
      if(trigger.disabled)close();
    };
    const open=()=>{
      if(trigger.disabled)return;closeChoices(box);menu.hidden=false;trigger.setAttribute('aria-expanded','true');
      const r=trigger.getBoundingClientRect(), height=Math.min(200,menu.scrollHeight), below=innerHeight-r.bottom-8;
      menu.style.width=`${r.width}px`;menu.style.left=`${r.left}px`;
      const upward=below<height&&r.top>below;
      menu.style.maxHeight=`${Math.max(40,Math.min(200,upward?r.top-8:below))}px`;
      menu.style.top=`${upward?Math.max(8,r.top-Math.min(height,r.top-8)):r.bottom+4}px`;
      (menu.querySelector('[aria-selected=true]')||menu.firstElementChild)?.focus({preventScroll:true});
    };
    trigger.onclick=()=>menu.hidden?open():close();
    trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}};
    box.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();trigger.focus();}
      if(e.key==='Tab')close();
      if(!menu.hidden&&menu.contains(e.target)&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
        e.preventDefault();const options=[...menu.children],index=options.indexOf(document.activeElement);
        options[e.key==='Home'?0:e.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,index+(e.key==='ArrowDown'?1:-1)))].focus({preventScroll:true});
      }
    });
    return box;
  }
  function editable(range) {
    const value = el('input', 'ol-number'); value.type = 'number'; value.dataset.liveId = range.dataset.liveId;
    value.setAttribute('aria-label', `${range.closest('label').querySelector('span').textContent} value`);
    range.nextElementSibling.replaceWith(value);
    range.addEventListener('input', () => { value.value = range.value; });
    const commit = () => {
      const t = status?.feedTools?.find(t => t.id === Number(value.dataset.liveId)) || status?.nrTools?.find(t => t.id === Number(value.dataset.liveId)) || status?.tools?.find(t => t.id === Number(value.dataset.liveId));
      if (t?.available && value.value !== '' && value.validity.valid) send(t.id, t.kind, Number(value.value));
      else if (t) value.value = t.value;
    };
    value.addEventListener('change', commit);
    value.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); value.blur(); } });
  }
  function addTool(target, t) {
    // Feeder's signed tri-state values use the same compact dropdown widget.
    const feedChoices={306:['Auto','Force SDR','Force HDR'],307:['Auto','Normal','Inverted'],308:['Bilinear','FSR 1','DLSS SR (experimental)'],309:['Auto','Off','On']};
    if(feedChoices[t.id])t={...t,options:feedChoices[t.id],name:{306:'HDR contract',307:'Depth convention',308:'Work upscale',309:'HDR10 bridge'}[t.id]};
    const isChoice=t.kind===4||!!t.options;
    const row = el(isChoice?'div':'label', isChoice?'ol-choice':t.kind===0?'ol-slider':'ol-check ol-live-toggle');
    row.title = `${t.effect || 'ReShade'} / ${t.name}`;
    if(isChoice){row.append(el('span','',t.name),choice(t));target.append(row);return;}
    const input = el('input', ''); input.dataset.liveId = t.id;
    if (t.kind === 0) {
      input.type = 'range'; input.min = t.min; input.max = t.max; input.step = t.step;
      row.append(el('span', '', t.name), input, el('output', '', ''));
      editable(input);
    } else { input.type = 'checkbox'; row.append(input, el('span', '', t.name)); }
    input.addEventListener('input', () => send(t.id, t.kind, [0, 4].includes(t.kind) ? Number(input.value) : Number(input.checked)));
    target.append(row);
  }
  function bindNr(panel) {
    for (const control of panel.querySelectorAll('input, button')) control.disabled = true;
    panel.querySelector('.ol-master small').textContent = status===sample?zhText('Preview only','仅预览'):status?.nrAvailable ? zhText('RenoDX live','RenoDX 实时') : zhText('Waiting for RenoDX','正在等待 RenoDX');
    const badgeNote = panel.querySelector('.ol-badge small');
    if (badgeNote) badgeNote.textContent = status===sample ? zhText('Preview only','仅预览') : zhText('Shows DLSS 5 On/Off over the game','在游戏画面上显示 DLSS 5 开/关状态');
    const masterLabel = panel.querySelector('.ol-master');
    for (const node of masterLabel.childNodes) if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('DLSS ON')) node.textContent = ` ${zhText('DLSS ON','DLSS 开')} `;
    const badgeLabel = panel.querySelector('.ol-badge');
    for (const node of badgeLabel.childNodes) if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('ON-SCREEN STATUS')) node.textContent = ` ${zhText('ON-SCREEN STATUS','屏幕状态')} `;
    panel.querySelector('.ol-prototype').textContent = status===sample?zhText('PREVIEW','预览'):status?.nrAvailable ? zhText('CONNECTED','已连接') : zhText('NOT CONNECTED','未连接');
    const mapping = [[panel.querySelector('#olStructure'), 101], [panel.querySelector('#olTone'), 102],
      [panel.querySelector('.ol-master input'), 103], [panel.querySelector('.ol-badge input'), 50],
      [panel.querySelector('.ol-muted input[type=checkbox]'), 104],
      [panel.querySelector('#olMaskStructure'), 105]];
    for (const [input, id] of mapping) {
      input.dataset.liveId = id;
      input.addEventListener('input', () => send(id, input.type === 'range' ? 0 : 1, input.type === 'range' ? Number(input.value) : Number(input.checked)));
      if (input.type === 'range') editable(input);
    }
    panel.querySelector('.ol-muted .ol-check small').textContent = zhText('RenoDX character mask','RenoDX 角色蒙版');
    const maskLabel = panel.querySelector('.ol-muted .ol-check');
    for (const node of maskLabel.childNodes) if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('MODEL AUTOMASK')) node.textContent = zhText(' CHARACTER MASK ',' 角色蒙版 ');
    panel.querySelector('.ol-muted').classList.toggle('ol-muted', !status?.nrAvailable);
    panel.querySelector('#olMaskStructure').previousElementSibling.textContent = 'Character/Skin Structure';
    const globalSection = panel.querySelector('.ol-group').parentElement.previousElementSibling;
    if (globalSection) { const h = globalSection.querySelector('h4'); if (h) h.textContent = zhText('GLOBAL CONTROLS','全局控件'); }
    const extra = panel.querySelector('.ol-group').parentElement;
    extra.replaceChildren(el('h4', '', zhText('MORE RENODX CONTROLS','更多 RENODX 控件')));
    const tools = el('div', 'ol-additional'); extra.append(tools);
    for (const t of status?.nrTools || []) if (![101, 102, 103, 104, 105, 114].includes(t.id)) addTool(tools, t);
    if (!status?.nrTools) tools.append(el('p', 'ol-live-note', zhText('Restart DLSS 5 Swapper and connect the updated overlay to load RenoDX controls.','请重启 DLSS 5 Swapper 并连接更新后的叠加层，以加载 RenoDX 控件。')));
    const models = panel.querySelector('.ol-models');
    models.parentElement.querySelector('h4').textContent = zhText('NR STYLE','NR 风格');
    for (const [i, model] of [...models.children].entries()) {
      model.textContent = `Model ${['A', 'B', 'C'][i]} · ${['Default', 'Natural', 'Cinematic'][i]}`;
      model.dataset.styleValue = i;
      model.onclick = () => send(114, 4, i);
      model.classList.remove('selected'); model.setAttribute('aria-pressed', 'false');
    }
    // The style buttons stay above the scrollable advanced controls.
    extra.before(models.parentElement);
    if(status?.feedPresent){
      const section=el('section','ol-feed-section');section.append(el('h4','',zhText('FEEDER CONTROLS','FEEDER 控件')));
      const feed=el('div','ol-additional');for(const t of status.feedTools||[])addTool(feed,t);
      section.append(feed,el('p','ol-live-note ol-feed-status',status.feedReason));
      extra.after(section);
      // Keep the compact panel bounded: choose a backend section instead of
      // stacking two tall scroll areas. NR remains accessible above.
      const toggle=el('button','ol-model',zhText('Show RenoDX extras','显示 RenoDX 额外项'));extra.before(toggle);extra.hidden=true;
      toggle.onclick=()=>{extra.hidden=!extra.hidden;section.hidden=!extra.hidden;toggle.textContent=extra.hidden?zhText('Show RenoDX extras','显示 RenoDX 额外项'):zhText('Show Feeder controls','显示 Feeder 控件');};
    }
    panel.querySelector('footer').textContent = status===sample?zhText('Interactive design preview only. Changes here do not affect a game. The installed overlay connects automatically to the verified RenoDX v4.7 build.','仅为交互式设计预览。这里的改动不会影响游戏。已安装的叠加层会自动连接到经过验证的 RenoDX v4.7 构建。'):status?.nrAvailable
      ? zhText('Live RenoDX v4.7 settings. A/B/C select NR Style, not AI models. Scroll More Controls; click a number to type. Home keeps the original tools available.','实时 RenoDX v4.7 设置。A/B/C 选择的是 NR 风格，不是 AI 模型。滚动到更多控件；点击数字即可输入。Home 键仍可打开原始工具。')
      : zhText('Waiting for the verified RenoDX v4.7 build. Connection is automatic; unsupported builds are refused. Original tools remain available.','正在等待经过验证的 RenoDX v4.7 构建。连接是自动的；不支持的构建会被拒绝。原有的工具窗口仍然可用。');
  }
  function build() {
    window.mountOverlayPanel(root);
    const panel = root.querySelector('.ol-panel');
    panel.classList.add('ol-connected');
    const modes = el('div', 'ol-models ol-live-modes');
    for (const [label, design] of [[zhText('Live tools','实时工具'), false], [zhText('DLSS controls','DLSS 控件'), true]]) {
      const b = el('button', `ol-model ${preview === design ? 'selected' : ''}`, label);
      b.onclick = () => { preview = design; build(); update(); }; modes.append(b);
    }
    // Preserve the requested panel itself; optional FX tools never replace it
    // automatically and are not presented as a RenoDX connection.
    panel.after(modes);
    if(designOnly){
      const backend=el('button','ol-preview-backend',sample.feedPresent?zhText('Preview: Feeder + RenoDX','预览：Feeder + RenoDX'):zhText('Preview: RenoDX','预览：RenoDX'));
      backend.onclick=()=>{
        sample.feedPresent=!sample.feedPresent;
        sample.feedReason=zhText('Design preview only. Feeder cfg controls; work resolution, filter and sharpness require DX11.','仅为设计预览。Feeder 配置项；工作分辨率、滤镜和锐化需要 DX11。');
        sample.badge=false;
        sample.feedTools=[['Feeder enabled (original panel)',1,1,0,1],['Work resolution (%)',0,100,50,100],['Work sharpness',0,.3,0,1],['Motion scale X',0,1,-2,2],['Motion scale Y',0,1,-2,2],['HDR contract',0,-1,-1,1],['Depth convention',0,-1,-1,1],['Work upscale',0,0,0,2],['HDR10 bridge',0,-1,-1,1],['HDR paper white (nits)',0,203,50,1000]].map(([name,kind,value,min,max],i)=>({id:301+i,name,kind,value,min,max,step:[0,1,5,6,7,8,9].includes(i)?1:.01,available:i!==0,effect:'Feeder 0.15.1'}));
        build();update();
      };
      modes.after(backend);
    }
    if(status!==sample){const note=el('p','ol-live-note ol-nr-status',nrNote());note.hidden=!note.textContent;modes.after(note);}
    if (preview) { bindNr(panel); return; }
    panel.querySelector('.ol-prototype').textContent = status ? zhText('LIVE RESHADE','ReShade 实时') : zhText('DISCONNECTED','未连接');
    panel.querySelector('.ol-eyebrow').textContent = zhText('DLSS 5 SWAPPER · INJECTED TOOLS','DLSS 5 SWAPPER · 注入工具');
    for (const element of [...panel.children]) if (element !== modes && element.tagName !== 'HEADER') element.remove();
    const info = el('p', 'ol-live-note', status===sample?zhText('Design preview; no game connection.','设计预览；未连接游戏。'):status?.nrAvailable ? zhText('RenoDX v4.7 controls use its original callback. FX controls below are separate. Experimental adapter; original tool windows remain available.','RenoDX v4.7 控件走它原本的回调。下方的 FX 控件是独立的。这是实验性适配层；原有的工具窗口仍然可用。') : zhText('Waiting for compatible RenoDX. FX controls do not control DLSS.','正在等待兼容的 RenoDX。FX 控件不会控制 DLSS。'));
    panel.append(info);
    const tools = el('div', 'ol-live-tools'); panel.append(tools);
    const add = t => addTool(tools, t);
    add({ id: 0, kind: 3, name: zhText('ReShade shader effects','ReShade 着色器效果') });
    let previousEffect = '';
    for (const t of [...(status?.nrAvailable ? status.nrTools : []), ...(status?.feedPresent ? status.feedTools : []), ...(status?.tools || [])]) {
      if (t.effect !== previousEffect) { tools.append(el('h4', 'ol-live-effect', t.effect)); previousEffect = t.effect; }
      add(t);
    }
    if (!status?.tools.length) tools.append(el('p', 'ol-live-note', zhText('No separate .fx shader controls found. RenoDX controls above do not require .fx shaders.','未找到独立的 .fx 着色器控件。上方的 RenoDX 控件不需要 .fx 着色器。')));
    panel.append(el('footer', 'ol-live-hotkey', `${root.dataset.overlayHotkey||'F8'}: ${zhText('show/hide','显示/隐藏')} · ${zhText('Drag header: move','拖动标题栏：移动')} · ${zhText('Esc: close','Esc：关闭')} · ${zhText('Home: original tools','Home：原始工具')}`));
  }
  function update() {
    const note = root.querySelector('.ol-nr-status'); if (note) { note.textContent = nrNote(); note.hidden = !note.textContent; }
    const feedNote=root.querySelector('.ol-feed-status');if(feedNote)feedNote.textContent=status?.feedReason||'';
    for (const input of root.querySelectorAll('[data-live-id]')) {
      const id = Number(input.dataset.liveId);
      const t = id >= 301 ? status?.feedPresent&&status.feedTools?.find(t=>t.id===id) : id === 0 ? { kind: 3, value: status?.effects ? 1 : 0, available: !!status } :
        // The on-screen status card is the add-on's own, so it is available
        // as soon as the overlay is connected - with or without a consumer.
        id === 50 ? { kind: 1, value: status?.badge ? 1 : 0, available: !!status, effect: 'DLSS 5 Swapper', name: zhText('On-screen status card','屏幕状态卡片') } :
        id >= 101 ? status?.nrAvailable && status.nrTools?.find(t => t.id === id) : status?.tools.find(t => t.id === id);
      input.disabled = !t?.available;
      if (!t || input.dataset.dragging || (document.activeElement === input && input.type === 'number')) continue;
      input.title = `${t.effect} / ${t.name}`;
      if (input.type === 'range' || input.type === 'number') { input.min = t.min; input.max = t.max; input.step = t.step; input.value = Number(t.value).toFixed(2); }
      else if(input.updateChoice) input.updateChoice(t);
      else input.checked = !!t.value;
    }
    const style = status?.nrAvailable && status.nrTools?.find(t => t.id === 114);
    const correctStyles = JSON.stringify(style?.options) === JSON.stringify(['Default', 'Natural', 'Cinematic']);
    for (const model of root.querySelectorAll('[data-style-value]')) {
      model.disabled = !style?.available || !correctStyles;
      const selected = !model.disabled && Number(model.dataset.styleValue) === style.value;
      model.classList.toggle('selected', selected); model.setAttribute('aria-pressed', String(selected));
    }
  }
  build(); update();
  runtime?.onStatus(value => {
    if (!value && !connectedOnce) return;
    const rebuild = !connectedOnce || epoch !== value?.epoch || status?.nrAvailable !== value?.nrAvailable || status?.nrEnabled !== value?.nrEnabled || !!status?.nrTools !== !!value?.nrTools || status?.feedPresent!==value?.feedPresent;
    status = value; epoch = value?.epoch || 0;
    connectedOnce = true;
    if(value?.nrTools&&!value.nrEnabled&&autoEpoch!==epoch){autoEpoch=epoch;send(200,1,1);}
    if (rebuild) build();
    update();
  });
};
