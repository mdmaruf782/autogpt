(() => {
  if (window.__bpiLoaded) return;
  window.__bpiLoaded = true;

  // If ChatGPT's DOM changes, only these selectors need updating
  const CFG = {
    editor: ['#prompt-textarea', 'div.ProseMirror[contenteditable="true"]', 'textarea[name="prompt-textarea"]'],
    send: ['button[data-testid="send-button"]', 'button[aria-label="Send"]', 'button[aria-label="Send prompt"]', 'button[aria-label="Send message"]'],
    stop: ['button[data-testid="stop-button"]', 'button[aria-label="Stop"]', 'button[aria-label="Stop streaming"]', 'button[aria-label="Stop generating"]'],
    assistant: '[data-message-author-role="assistant"], [data-chatgpt-search-unit-key$=":assistant"]',
    user: '[data-message-author-role="user"], [data-user-message-bubble="true"]',
  };
  const LIMIT_RE = /(hit|reached).{0,60}limit|too many (requests|images)|try again (later|in)|rate limit/i;

  const DEFAULTS = { delay: 6, maxWaitMin: 8, autoDownload: true, pauseOnLimit: true, sound: true, serial: true, theme: 'dark', dest: 'downloads', dlRoot: 'ChatGPT-Bulk', projSub: true };
  let skipNow = false;
  const logs = [];
  let S = { projects: [], activeId: null, settings: { ...DEFAULTS }, run: { running: false } };
  let looping = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const q = (list) => { for (const s of list) { const e = document.querySelector(s); if (e) return e; } return null; };
  const qa = (sel) => [...document.querySelectorAll(sel)];
  const safe = (s) => String(s).replace(/[^\w\-. ]+/g, '_').trim().slice(0, 80) || 'untitled';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const proj = (id) => S.projects.find((p) => p.id === id);
  const active = () => proj(S.activeId);

  async function load() {
    const d = await chrome.storage.local.get(['bpi']);
    if (d.bpi) S = { ...S, ...d.bpi, settings: { ...DEFAULTS, ...(d.bpi.settings || {}) } };
    if (!active()) S.activeId = S.projects[0] ? S.projects[0].id : null;
  }
  async function save() { try { await chrome.storage.local.set({ bpi: S }); } catch (e) { /* ext reloaded */ } }

  // ---------- UI ----------
  const IC = {
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
    retry: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  };
  const ic = (n, sz = 14) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="${sz}" height="${sz}">${IC[n]}</svg>`;

  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:12px;bottom:12px;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
<style>
:host{all:initial}
*{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI","Noto Sans Bengali",sans-serif;-webkit-font-smoothing:antialiased}
:host{--cs:dark;--bg:#09090b;--fg:#fafafa;--card:#09090b;--muted:#27272a;--mfg:#a1a1aa;--border:#27272a;--ring:#d4d4d8;--pri:#fafafa;--prifg:#18181b;--sec:#27272a;--dest:#7f1d1d;--destfg:#fafafa;--ok:#14532d;--okfg:#86efac;--pre:#18181b;--cur:#18181b;--stbg:#0c0c0f;--err:#fca5a5;--shadow:#000c}
:host(.light){--cs:light;--bg:#ffffff;--fg:#09090b;--card:#ffffff;--muted:#f4f4f5;--mfg:#71717a;--border:#e4e4e7;--ring:#18181b;--pri:#18181b;--prifg:#fafafa;--sec:#f4f4f5;--dest:#dc2626;--destfg:#fafafa;--ok:#dcfce7;--okfg:#166534;--pre:#f4f4f5;--cur:#f4f4f5;--stbg:#fafafa;--err:#dc2626;--shadow:#00000033}
svg{flex:none}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border-radius:6px;border:1px solid transparent;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .15s,opacity .15s;background:transparent;color:var(--fg)}
.btn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--ring)}
.btn:disabled{opacity:.5;pointer-events:none}
.btn.default{background:var(--pri);color:var(--prifg)}.btn.default:hover{opacity:.9}
.btn.secondary{background:var(--sec);color:var(--fg)}.btn.secondary:hover{opacity:.85}
.btn.outline{border-color:var(--border);background:transparent}.btn.outline:hover{background:var(--muted)}
.btn.ghost:hover{background:var(--muted)}
.btn.destructive{background:var(--dest);color:var(--destfg)}.btn.destructive:hover{opacity:.9}
.btn.icon{width:32px;padding:0}.btn.xs{height:24px;width:24px;padding:0}
.input,select,textarea{width:100%;background:transparent;color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:0 10px;height:34px;font-size:12.5px;color-scheme:var(--cs)}
textarea{height:auto;padding:8px 10px;resize:vertical;line-height:1.45}
.input:focus,select:focus,textarea:focus{outline:none;box-shadow:0 0 0 1px var(--ring)}
input[type=file]{font-size:11.5px;color:var(--mfg);width:100%;padding:6px;height:auto;border:1px dashed var(--border);border-radius:6px}
label.l{display:block;font-size:12px;font-weight:500;margin:10px 0 5px}
.row{display:flex;gap:6px;align-items:center}.row>.input,.row>select{flex:1}
.hint{color:var(--mfg);font-size:11.5px;line-height:1.55}
code{background:var(--muted);padding:1px 5px;border-radius:4px;font-size:11px}
pre{background:var(--pre);border:1px solid var(--border);border-radius:6px;padding:8px;font:11px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;margin:8px 0;color:var(--fg)}

#fab{box-shadow:0 4px 14px #000a;border-radius:9999px;height:36px;padding:0 14px}
#panel{display:none;width:400px;max-height:88vh;flex-direction:column;background:var(--card);color:var(--fg);border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 40px var(--shadow);font-size:13px;overflow:hidden}
#panel.open{display:flex}
.hd{display:flex;align-items:flex-start;gap:10px;padding:14px 14px 10px}
.hd .t1{font-weight:600;font-size:14px;letter-spacing:-.01em}.hd .t2{color:var(--mfg);font-size:11.5px;margin-top:2px}.hd .sp{flex:1}.hd{align-items:flex-start}
.plat{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 14px 10px}
.pl{display:flex;align-items:center;justify-content:center;gap:6px;height:32px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--mfg);font-size:12px;font-weight:500;cursor:pointer}
.pl.on{background:var(--pri);color:var(--prifg);border-color:var(--pri)}
.pl:disabled{opacity:.6;cursor:not-allowed}.pl .badge{font-size:9.5px;padding:0 6px;color:var(--mfg)}
.tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:2px;margin:0 14px;padding:3px;background:var(--muted);border-radius:8px}
.tt{height:28px;border:0;border-radius:6px;background:transparent;color:var(--mfg);font-size:11.5px;font-weight:500;cursor:pointer}
.tt.on{background:var(--bg);color:var(--fg);box-shadow:0 1px 3px #0003}
.body{padding:12px 14px;overflow:auto;flex:1}
.tp[hidden]{display:none}
.prog{margin-bottom:10px}.prog .top{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mfg);margin-bottom:5px}
.bar{height:8px;background:var(--muted);border-radius:9999px;overflow:hidden}.bar>i{display:block;height:100%;width:0;background:var(--pri);border-radius:9999px;transition:width .3s}
.ctl{display:flex;flex-wrap:wrap;gap:6px}
#mon{margin:10px 0;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:11.5px;line-height:1.7;color:var(--mfg);font-variant-numeric:tabular-nums}
.sep{height:1px;background:var(--border);margin:10px 0}
.it{border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px}
.it.cur{border-color:var(--ring);background:var(--cur)}
.itm{display:flex;align-items:center;gap:8px}.itm b{font-size:12.5px}.itm .sp{flex:1}
.it .t{color:var(--mfg);font-size:11.5px;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.it .m{color:var(--err);font-size:11px;margin-top:4px}
.badge{display:inline-flex;align-items:center;border-radius:9999px;padding:1px 8px;font-size:10.5px;font-weight:600;border:1px solid var(--border);color:var(--fg)}
.b-sending{background:var(--sec)}.b-done{background:var(--ok);color:var(--okfg);border-color:transparent}.b-error{background:var(--dest);border-color:transparent}.b-pending{color:var(--mfg)}
.empty{color:var(--mfg);text-align:center;padding:22px 0;font-size:12px}
.sw{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)}
.sw span{font-size:12.5px}.sw small{display:block;color:var(--mfg);font-size:11px;margin-top:2px}
input[type=checkbox]{appearance:none;-webkit-appearance:none;flex:none;width:36px;height:20px;border-radius:9999px;background:var(--muted);position:relative;cursor:pointer;margin:0;transition:background .15s}
input[type=checkbox]::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--mfg);transition:transform .15s,background .15s}
input[type=checkbox]:checked{background:var(--pri)}input[type=checkbox]:checked::after{transform:translateX(16px);background:var(--prifg)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#log{max-height:120px;overflow:auto}
#status{display:flex;align-items:center;gap:8px;padding:9px 14px;border-top:1px solid var(--border);font-size:11.5px;color:var(--mfg);background:var(--stbg)}
#status:before{content:"";width:6px;height:6px;border-radius:50%;background:#22c55e;flex:none}
</style>
<button id="fab" class="btn default">${ic('image')}<span>Bulk Image</span></button>
<div id="panel">
  <div class="hd">
    <div style="padding-top:2px">${ic('image', 18)}</div>
    <div><div class="t1">Bulk Image Prompter</div><div class="t2">Queue prompts and auto-generate images in ChatGPT</div></div>
    <div class="sp"></div>
    <button id="theme" class="btn ghost xs" title="Dark / Light">${ic('sun')}</button><button id="close" class="btn ghost xs" title="Close">${ic('x')}</button>
  </div>
  <div class="plat">
    <button class="pl on" data-plat="chatgpt">ChatGPT</button>
    <button class="pl" data-plat="flow" disabled title="Google Flow support is coming">Google Flow <span class="badge">Coming soon</span></button>
  </div>
  <div class="tabs">
    <button class="tt on" data-tab="queue">Queue</button><button class="tt" data-tab="project">Project</button>
    <button class="tt" data-tab="import">Import</button><button class="tt" data-tab="download">Download</button><button class="tt" data-tab="settings">Settings</button>
  </div>

  <div class="body">
    <div class="tp" data-pane="queue">
      <div class="prog"><div class="top"><span id="progName">—</span><span id="progTxt">0/0</span></div><div class="bar"><i id="progBar"></i></div></div>
      <div class="ctl">
        <button id="start" class="btn default">${ic('play')}Start</button>
        <button id="pause" class="btn secondary">${ic('pause')}Pause</button>
        <button id="skip" class="btn outline" title="Image is ready or stuck — move on to the next prompt now">${ic('skip')}Done/Skip</button>
        <button id="retry" class="btn outline">${ic('retry')}Retry errors</button>
        <button id="reset" class="btn outline">${ic('reset')}Reset</button>
      </div>
      <div id="mon">Monitor: idle</div>
      <div id="list"></div>
    </div>

    <div class="tp" data-pane="project" hidden>
      <label class="l" style="margin-top:0">Project</label>
      <div class="row"><select id="projSel"></select><button id="newProj" class="btn outline icon" title="New project">${ic('plus')}</button><button id="delProj" class="btn destructive icon" title="Delete">${ic('trash')}</button></div>
      <label class="l">Name <span class="hint">(also used as the download folder name)</span></label>
      <input id="projName" class="input" placeholder="Project name">
      <label class="l">Chat / Project URL <span class="hint">(optional)</span></label>
      <div class="row"><input id="targetUrl" class="input" placeholder="https://chatgpt.com/c/…"><button id="useUrl" class="btn outline icon" title="Use the current chat URL">${ic('pin')}</button></div>
      <div class="hint" style="margin-top:4px">On Start, the extension opens this chat first (use the chat that already has your portrait and style lock).</div>
      <label class="l">Prefix</label>
      <textarea id="prefix" rows="2" placeholder="Text added before every prompt"></textarea>
      <label class="l">Suffix</label>
      <textarea id="suffix" rows="2" placeholder="Text added after every prompt"></textarea>
    </div>

    <div class="tp" data-pane="import" hidden>
      <div class="hint">Formats: <code>## ID</code> heading with the prompt below (md) · JSON · CSV <code>id,prompt</code> · blocks separated by <code>---</code> or blank lines.</div>
      <pre>## R5
SCENE R5: A grand divan chamber ...

## R6
SCENE R6: A council of viziers ...</pre>
      <input type="file" id="file" accept=".md,.txt,.csv,.json">
      <label class="l">Or paste here</label>
      <textarea id="paste" rows="6" placeholder="## ID&#10;prompt…"></textarea>
      <div class="ctl" style="margin-top:10px">
        <button id="impNew" class="btn default">${ic('upload')}Import as new project</button>
        <button id="impAdd" class="btn secondary">Add to current project</button>
        <button id="sample" class="btn ghost">Sample</button>
      </div>
    </div>

    <div class="tp" data-pane="download" hidden>
      <label class="l" style="margin-top:0">Where to save images</label>
      <div class="plat" style="margin:0 0 4px">
        <button class="pl on" data-dest="downloads">Downloads folder</button>
        <button class="pl" data-dest="picker">Choose a folder…</button>
      </div>
      <div id="destDl">
        <label class="l">Sub-folder name inside Downloads</label>
        <input id="dlRoot" class="input" placeholder="ChatGPT-Bulk">
      </div>
      <div id="destPk" hidden>
        <label class="l">Selected folder</label>
        <div class="row"><input id="pkName" class="input" readonly placeholder="No folder selected"><button id="pickBtn" class="btn outline">Choose…</button></div>
        <div class="hint" style="margin-top:4px">Chrome does not allow picking the top-level Downloads, Desktop or Documents folder — create a new folder inside one and pick that. After restarting Chrome, permission may be requested again (pressing Start will ask).</div>
      </div>
      <div class="sw" style="margin-top:10px"><span>Auto download<small>Save each image when it finishes</small></span><input type="checkbox" id="sDl"></div>
      <div class="sw"><span>Project sub-folder<small>…/project/R5.png</small></span><input type="checkbox" id="sProj"></div>
      <div class="sw"><span>Serial prefix<small>01_R5.png — off gives just R5.png</small></span><input type="checkbox" id="sSer"></div>
      <div class="hint" style="margin-top:8px">File name: the scene number from the prompt (<code>SCENE R5:</code> → R5). If the prompt has no scene number, the prompt's serial number (01, 02…) is used. Duplicate names get _2, _3.</div>
      <div class="sep"></div>
      <button id="dlAll" class="btn secondary" style="width:100%">⬇ Download all generated images in this chat</button>
      <div class="hint" style="margin-top:4px">The extension scrolls through the whole chat by itself to collect every image, then saves them. Keep the tab open until it finishes.</div>
    </div>

    <div class="tp" data-pane="settings" hidden>
      <div class="grid2">
        <div><label class="l" style="margin-top:0">Delay between prompts (s)</label><input type="number" id="sDelay" class="input" min="1"></div>
        <div><label class="l" style="margin-top:0">Max wait per image (min)</label><input type="number" id="sMax" class="input" min="1"></div>
      </div>
      <div class="sw" style="margin-top:8px"><span>Pause when a usage limit is detected</span><input type="checkbox" id="sLim"></div>
      <div class="sw"><span>Beep when an image finishes</span><input type="checkbox" id="sSnd"></div>
      <label class="l">Log <span class="hint">(last 30)</span></label>
      <pre id="log"></pre>
    </div>
  </div>
  <div id="status">Ready</div>
</div>`;
  document.documentElement.appendChild(host);
  const $ = (s) => shadow.querySelector(s);
  const setStatus = (m) => { $('#status').textContent = m; log(m); };
  const mon = (m) => { $('#mon').textContent = m; };
  function log(m) {
    if (logs[logs.length - 1] && logs[logs.length - 1].m === m) return;
    logs.push({ t: new Date().toLocaleTimeString('en-GB'), m });
    if (logs.length > 30) logs.shift();
    $('#log').textContent = logs.map((l) => `${l.t} ${l.m}`).join('\n');
  }
  function beep() {
    if (!S.settings.sound) return;
    try {
      const a = new AudioContext(), o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = 0.08;
      o.start(); o.stop(a.currentTime + 0.25);
    } catch (e) { /* autoplay blocked */ }
  }

  function render() {
    host.classList.toggle('light', S.settings.theme === 'light');
    $('#theme').innerHTML = ic(S.settings.theme === 'light' ? 'moon' : 'sun');
    const sel = $('#projSel');
    sel.innerHTML = S.projects.map((p) => `<option value="${p.id}" ${p.id === S.activeId ? 'selected' : ''}>${esc(p.name)} (${p.items.filter((i) => i.status === 'done').length}/${p.items.length})</option>`).join('') || '<option>— No projects —</option>';
    const p = active();
    if (shadow.activeElement !== $('#projName')) $('#projName').value = p ? p.name : '';
    if (shadow.activeElement !== $('#targetUrl')) $('#targetUrl').value = p ? p.targetUrl || '' : '';
    if (shadow.activeElement !== $('#prefix')) $('#prefix').value = p ? p.prefix || '' : '';
    if (shadow.activeElement !== $('#suffix')) $('#suffix').value = p ? p.suffix || '' : '';
    $('#sDelay').value = S.settings.delay; $('#sMax').value = S.settings.maxWaitMin;
    $('#sDl').checked = S.settings.autoDownload; $('#sLim').checked = S.settings.pauseOnLimit; $('#sSnd').checked = S.settings.sound; $('#sSer').checked = S.settings.serial;
    $('#sProj').checked = S.settings.projSub;
    shadow.querySelectorAll('[data-dest]').forEach((b) => b.classList.toggle('on', b.dataset.dest === S.settings.dest));
    $('#destDl').hidden = S.settings.dest !== 'downloads'; $('#destPk').hidden = S.settings.dest !== 'picker';
    if (shadow.activeElement !== $('#dlRoot')) $('#dlRoot').value = S.settings.dlRoot || '';
    $('#pkName').value = dirHandle ? dirHandle.name : '';
    const label = { pending: 'Pending', sending: 'Running', done: 'Done', error: 'Error' };
    const nextId = p && (p.items.find((i) => i.status === 'sending') || p.items.find((i) => i.status === 'pending'));
    $('#list').innerHTML = p && p.items.length ? p.items.map((it, n) => `
      <div class="it ${nextId && nextId.id === it.id ? 'cur' : ''}">
        <div class="itm"><span class="badge b-${it.status}">${label[it.status]}</span><b>${esc(it.label)}</b><span class="sp"></span>
          <button class="btn ghost xs" data-a="redo" data-i="${n}" title="Set back to pending">${ic('reset', 12)}</button>
          <button class="btn ghost xs" data-a="del" data-i="${n}" title="Remove">${ic('x', 12)}</button></div>
        <div class="t" title="${esc(it.text)}">${esc(it.text)}</div>${it.msg ? `<div class="m">${esc(it.msg)}</div>` : ''}
      </div>`).join('') : '<div class="empty">No prompts yet — add some from the Import tab</div>';
    const total = p ? p.items.length : 0, done = p ? p.items.filter((i) => i.status === 'done').length : 0;
    $('#progName').textContent = p ? p.name : '—'; $('#progTxt').textContent = `${done}/${total}`;
    $('#progBar').style.width = (total ? (done / total) * 100 : 0) + '%';
    $('#start').disabled = S.run.running; 
  }

  // ---------- UI events ----------
  shadow.addEventListener('click', (e) => {
    const t = e.target.closest('.tt'); if (!t) return;
    shadow.querySelectorAll('.tt').forEach((x) => x.classList.toggle('on', x === t));
    shadow.querySelectorAll('.tp').forEach((x) => { x.hidden = x.dataset.pane !== t.dataset.tab; });
  });
  $('#fab').onclick = () => $('#panel').classList.toggle('open');
  $('#theme').onclick = async () => { S.settings.theme = S.settings.theme === 'light' ? 'dark' : 'light'; await save(); render(); };
  $('#close').onclick = () => $('#panel').classList.remove('open');
  chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'toggle') $('#panel').classList.toggle('open'); });

  $('#projSel').onchange = async (e) => { S.activeId = e.target.value; await save(); render(); };
  $('#newProj').onclick = async () => {
    const p = { id: uid(), name: 'Project ' + (S.projects.length + 1), targetUrl: '', prefix: '', suffix: '', items: [] };
    S.projects.push(p); S.activeId = p.id; await save(); render();
  };
  $('#delProj').onclick = async () => {
    const p = active(); if (!p || !confirm(`Delete "${p.name}"?`)) return;
    S.projects = S.projects.filter((x) => x.id !== p.id); S.activeId = S.projects[0] ? S.projects[0].id : null;
    await save(); render();
  };
  for (const [id, key] of [['#projName', 'name'], ['#targetUrl', 'targetUrl'], ['#prefix', 'prefix'], ['#suffix', 'suffix']]) {
    $(id).onchange = async (e) => { const p = active(); if (!p) return; p[key] = e.target.value.trim() || (key === 'name' ? p.name : ''); await save(); render(); };
  }
  $('#useUrl').onclick = async () => { const p = active(); if (!p) return; p.targetUrl = location.origin + location.pathname; await save(); render(); };
  $('#sDelay').onchange = async (e) => { S.settings.delay = Math.max(1, +e.target.value || 6); await save(); };
  $('#sMax').onchange = async (e) => { S.settings.maxWaitMin = Math.max(1, +e.target.value || 8); await save(); };
  $('#sDl').onchange = async (e) => { S.settings.autoDownload = e.target.checked; await save(); };
  $('#sLim').onchange = async (e) => { S.settings.pauseOnLimit = e.target.checked; await save(); };
  $('#sSer').onchange = async (e) => { S.settings.serial = e.target.checked; await save(); };
  $('#sProj').onchange = async (e) => { S.settings.projSub = e.target.checked; await save(); };
  $('#dlRoot').onchange = async (e) => { S.settings.dlRoot = e.target.value.trim() || 'ChatGPT-Bulk'; await save(); render(); };
  shadow.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dest]'); if (!b) return;
    S.settings.dest = b.dataset.dest; await save(); render();
  });
  $('#pickBtn').onclick = async () => {
    try {
      const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'bpi-save' });
      dirHandle = h; await idbSet('dir', h); S.settings.dest = 'picker'; await save(); render();
      setStatus('Folder selected: ' + h.name);
    } catch (e) { if (e.name !== 'AbortError') setStatus('Could not pick folder: ' + e.message); }
  };
  $('#dlAll').onclick = () => downloadAllInChat();
  $('#sSnd').onchange =async (e) => { S.settings.sound = e.target.checked; await save(); };
  $('#skip').onclick = () => { skipNow = true; setStatus('Skip/Done pressed'); };

  $('#file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('#paste').value = await f.text();
    $('#paste').dataset.name = f.name.replace(/\.[^.]+$/, '');
  };
  const mkItems = (arr) => arr.map((x) => ({ id: uid(), label: x.label, text: x.text, status: 'pending', msg: '' }));
  $('#impNew').onclick = async () => {
    const items = bpiParse($('#paste').value);
    if (!items.length) return setStatus('No prompts found');
    const name = $('#paste').dataset.name || 'Project ' + (S.projects.length + 1);
    const p = { id: uid(), name, targetUrl: '', prefix: '', suffix: '', items: mkItems(items) };
    S.projects.push(p); S.activeId = p.id; await save(); render(); setStatus(`Imported ${items.length} prompts → "${name}"`);
    $('#paste').value = ''; delete $('#paste').dataset.name;
  };
  $('#impAdd').onclick = async () => {
    const p = active(); if (!p) return setStatus('Create a project first');
    const items = bpiParse($('#paste').value);
    if (!items.length) return setStatus('No prompts found');
    p.items.push(...mkItems(items)); await save(); render(); setStatus(`Added ${items.length} prompts`);
    $('#paste').value = '';
  };
  $('#sample').onclick = () => {
    const txt = '# My Project\n\n## S1\nSCENE S1: A misty mountain village at dawn, cinematic, 16:9, no text.\n\n## S2\nSCENE S2: A lone rider crossing a stone bridge at sunset, cinematic, 16:9, no text.\n';
    chrome.runtime.sendMessage({ type: 'download', url: 'data:text/markdown;charset=utf-8,' + encodeURIComponent(txt), filename: 'ChatGPT-Bulk/sample-prompts.md' });
  };
  $('#list').onclick = async (e) => {
    const b = e.target.closest('button'); const p = active(); if (!b || !p) return;
    const i = +b.dataset.i;
    if (b.dataset.a === 'del') p.items.splice(i, 1);
    if (b.dataset.a === 'redo') { p.items[i].status = 'pending'; p.items[i].msg = ''; }
    await save(); render();
  };
  $('#retry').onclick = async () => { const p = active(); if (!p) return; p.items.forEach((i) => { if (i.status === 'error') { i.status = 'pending'; i.msg = ''; } }); await save(); render(); };
  $('#reset').onclick = async () => { const p = active(); if (!p || !confirm('Set all items back to pending?')) return; p.items.forEach((i) => { i.status = 'pending'; i.msg = ''; }); await save(); render(); };
  $('#pause').onclick = async () => { S.run.running = false; await save(); render(); setStatus('Will pause after the current prompt…'); };
  $('#start').onclick = async () => {
    if (S.settings.dest === 'picker' && S.settings.autoDownload && !(await dirPerm(true))) return setStatus('Choose a folder and grant permission in the Download tab first');
    const p = active(); if (!p) return setStatus('No project');
    if (!p.items.some((i) => i.status === 'pending' || i.status === 'sending')) return setStatus('No pending prompts (use Reset/Retry)');
    S.run = { running: true, projectId: p.id, navDone: false }; await save(); render(); runLoop();
  };

  // ---------- ChatGPT automation ----------
  async function waitFor(fn, timeout, what) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const v = fn(); if (v) return v; await sleep(300); }
    throw new Error(what + ' not found');
  }

  async function fillPrompt(text) {
    const ed = await waitFor(() => q(CFG.editor), 20000, 'prompt box');
    text = text.replace(/\s*\n\s*/g, ' ').trim();
    ed.focus();
    if (ed.tagName === 'TEXTAREA') {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ed, text);
      ed.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    document.execCommand('selectAll', false);
    document.execCommand('delete', false);
    document.execCommand('insertText', false, text);
    await sleep(300);
    const head = text.slice(0, 25);
    if (!ed.innerText.includes(head)) { // fallback: paste event
      document.execCommand('selectAll', false); document.execCommand('delete', false);
      const dt = new DataTransfer(); dt.setData('text/plain', text);
      ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      await sleep(400);
      if (!ed.innerText.includes(head)) throw new Error('Could not enter the prompt');
    }
  }

  async function clickSend() {
    for (let i = 0; i < 40; i++) {
      const b = q(CFG.send);
      if (b && !b.disabled) { b.click(); return; }
      await sleep(250);
    }
    const ed = q(CFG.editor);
    if (ed) ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  }

  const mainEl = () => document.querySelector('main') || document.body;
  const allImgSrcs = () => [...mainEl().querySelectorAll('img')].map((i) => i.src);
  function newImg(before) {
    const arr = [...mainEl().querySelectorAll('img')].filter((i) =>
      i.src && !before.has(i.src) && !i.closest(CFG.user) && (i.naturalWidth >= 300 || i.width >= 300));
    return arr[arr.length - 1] || null;
  }
  const lastText = () => { const a = qa(CFG.assistant); return a.length ? a[a.length - 1].innerText.trim().slice(0, 200) : ''; };

  function lastTurnText() {
    const m = qa(CFG.assistant); if (m.length) return m[m.length - 1].innerText.slice(0, 400);
    const arts = qa('article'); return arts.length ? arts[arts.length - 1].innerText.slice(0, 400) : '';
  }
  // hard = definitely generating; soft = probably generating (Thinking / Preview badge)
  function genState(img) {
    if (q(CFG.stop)) return { hard: 'stop', soft: [] };
    const sb = [...document.querySelectorAll('button')].find((b) => /stop/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('data-testid') || '')));
    if (sb) return { hard: 'stop*', soft: [] };
    if (document.querySelector('.result-streaming,[data-is-streaming="true"]')) return { hard: 'streaming', soft: [] };
    const soft = [];
    if (/\b(Thinking|Creating image|Generating image|Analyzing image)\b/.test(lastTurnText())) soft.push('thinking');
    if (img) {
      const box = img.closest('article,section') || img.parentElement;
      if (box && [...box.querySelectorAll('div,span')].some((e) => !e.children.length && e.textContent.trim() === 'Preview')) soft.push('preview');
    }
    return { hard: '', soft };
  }

  async function waitResult(uCount, before, resume) {
    const max = S.settings.maxWaitMin * 60000, t0 = Date.now();
    let started = resume, lastSig = '', lastChange = Date.now(), retried = false;
    while (Date.now() - t0 < max) {
      const imgNow = newImg(before);
      const g = genState(imgNow);
      const ed = q(CFG.editor);
      const edText = ed ? String(ed.value !== undefined ? ed.value : ed.innerText).trim() : '';
      const sig = (imgNow ? imgNow.src + imgNow.naturalWidth : '') + '|' + lastTurnText().length;
      if (sig !== lastSig) { lastSig = sig; lastChange = Date.now(); }
      const stable = Math.round((Date.now() - lastChange) / 1000);
      mon(`Stop: ${g.hard || '—'} · Thinking/Preview: ${g.soft.join(',') || '—'} · Image: ${imgNow ? '✅' : '—'} · Stable: ${stable}s · Started: ${started ? 'yes' : 'no'} · Time: ${Math.round((Date.now() - t0) / 1000)}s`);
      if (skipNow) { skipNow = false; return imgNow ? { img: imgNow } : { skipped: true }; }
      if (!started && (g.hard || g.soft.length || qa(CFG.user).length > uCount || imgNow || (ed && edText === ''))) started = true;
      if (started) {
        const need = g.hard ? Infinity : g.soft.length ? 30 : 10;
        if (stable >= need) {
          if (resume) return { resumed: true };
          if (imgNow) {
            if ((imgNow.complete && imgNow.naturalWidth) || stable >= 25) { await sleep(1500); return { img: newImg(before) || imgNow }; }
          } else if (stable >= 35) { const text = lastText(); return { img: null, text, limit: LIMIT_RE.test(text) }; }
        }
      } else {
        if (!retried && Date.now() - t0 > 20000 && edText) { retried = true; await clickSend(); }
        if (Date.now() - t0 > 45000) throw new Error('Prompt was not sent');
      }
      await sleep(1000);
    }
    throw new Error('Timeout — no image arrived');
  }

  function blobToDataUrl(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }

  // ---- File name: scene number from the prompt, else the prompt serial ----
  function sceneId(t) {
    const m = String(t || '').match(/\bscene\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Za-z]{0,3}\d+[A-Za-z0-9_-]{0,6})\b/i);
    return m ? m[1] : '';
  }
  function baseName(text, idx, total) {
    const nn = String(idx + 1).padStart(Math.max(2, String(total).length), '0');
    const sc = sceneId(text);
    if (!sc) return nn;
    return S.settings.serial ? `${nn}_${safe(sc)}` : safe(sc);
  }

  // ---- Folder picker (File System Access API) ----
  let dirHandle = null;
  const idbOpen = () => new Promise((res, rej) => { const r = indexedDB.open('bpi-handles', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function idbGet(k) { const db = await idbOpen(); return new Promise((res, rej) => { const t = db.transaction('h').objectStore('h').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
  async function idbSet(k, v) { const db = await idbOpen(); return new Promise((res, rej) => { const t = db.transaction('h', 'readwrite').objectStore('h').put(v, k); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }
  async function dirPerm(ask) {
    if (!dirHandle) return false;
    try {
      let p = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (p === 'granted') return true;
      if (ask) { p = await dirHandle.requestPermission({ mode: 'readwrite' }); return p === 'granted'; }
    } catch (e) { /* ignore */ }
    return false;
  }
  async function writeToDir(blob, project, fileName) {
    let dir = dirHandle;
    if (S.settings.projSub) dir = await dir.getDirectoryHandle(safe(project), { create: true });
    let name = fileName, n = 1;
    for (;;) { try { await dir.getFileHandle(name); n++; name = fileName.replace(/\.png$/, `_${n}.png`); } catch (e) { break; } }
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable(); await w.write(blob); await w.close();
    return name;
  }

  async function imgToPng(img) {
    let blob = null, bmp;
    try { blob = await (await fetch(img.src, { credentials: 'include' })).blob(); } catch (e) { /* use element */ }
    if (blob) { if (blob.type === 'image/png') return blob; bmp = await createImageBitmap(blob); }
    else bmp = await createImageBitmap(img);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('png convert failed'))), 'image/png'));
  }

  // blob: PNG blob (or null -> fall back to the image URL)
  async function saveBlobOut(blob, fallbackUrl, project, base) {
    const fname = base + '.png';
    if (S.settings.dest === 'picker') {
      if (blob && (await dirPerm(false))) { await writeToDir(blob, project, fname); return; }
      setStatus('⚠ No folder permission — saving to Downloads instead (re-pick the folder in the Download tab)');
    }
    const root = safe(S.settings.dlRoot || 'ChatGPT-Bulk');
    const path = `${root}/${S.settings.projSub ? safe(project) + '/' : ''}${fname}`;
    const url = blob ? await blobToDataUrl(blob) : fallbackUrl;
    const r = await chrome.runtime.sendMessage({ type: 'download', url, filename: path });
    if (!r || !r.ok) throw new Error('Download failed: ' + (r && r.error));
  }

  async function saveImage(img, project, base) {
    let blob = null;
    try { blob = await imgToPng(img); } catch (e) { /* URL fallback */ }
    return saveBlobOut(blob, img.src, project, base);
  }

  // ChatGPT only keeps a window of turns mounted, so we scroll through the whole
  // chat and grab each image (as a PNG blob) while it is mounted.
  async function downloadAllInChat() {
    if (S.settings.dest === 'picker' && !(await dirPerm(true))) return setStatus('Choose a folder and grant permission first');
    const findScroller = () => {
      const known = document.querySelector('.thread-scroll-container');
      if (known) return known;
      let n = document.querySelector('[data-user-message-bubble="true"]');
      while (n && n !== document.documentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 50) return n;
        n = n.parentElement;
      }
      return null;
    };
    const sc = findScroller();
    const found = new Map(); // turn key -> { blob, prompt, order }
    const harvest = async () => {
      const nodes = [...document.querySelectorAll('[data-user-message-bubble="true"], img[alt^="Generated image"]')];
      let prompt = '';
      for (const el of nodes) {
        if (el.tagName !== 'IMG') { prompt = el.innerText; continue; }
        if ((el.naturalWidth || el.width) < 150) continue;
        const tk = el.closest('[data-turn-key]');
        const key = (tk ? tk.dataset.turnKey : el.src) + '|' + el.alt;
        const rec = found.get(key);
        if (rec) { if (!rec.prompt && prompt) rec.prompt = prompt; continue; }
        for (let i = 0; i < 10 && !(el.complete && el.naturalWidth); i++) await sleep(300);
        try {
          found.set(key, { blob: await imgToPng(el), prompt, order: found.size });
          setStatus(`Scanning chat… found ${found.size} images`);
        } catch (e) { log('Skipped an unreadable image: ' + e.message); }
      }
    };
    setStatus('Scanning chat…');
    const startTop = sc ? sc.scrollTop : 0;
    if (sc) {
      sc.scrollTop = 0; await sleep(900);
      let stuck = 0;
      for (let i = 0; i < 500; i++) {
        await harvest();
        if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) break;
        const before = sc.scrollTop;
        sc.scrollTop = before + Math.floor(sc.clientHeight * 0.5);
        await sleep(700);
        if (sc.scrollTop === before) { if (++stuck >= 2) break; } else stuck = 0;
      }
      await harvest();
      sc.scrollTop = startTop;
    } else await harvest();

    const list = [...found.values()].sort((x, y) => x.order - y.order);
    if (!list.length) return setStatus('No generated images found in this chat');
    const projName = (active() || {}).name || 'chat';
    const pad = Math.max(2, String(list.length).length);
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const it = list[i], sc2 = sceneId(it.prompt), nn = String(i + 1).padStart(pad, '0');
      const base = sc2 ? (S.settings.serial ? `${nn}_${safe(sc2)}` : safe(sc2)) : nn;
      setStatus(`Saving ${i + 1}/${list.length}: ${base}`);
      try { await saveBlobOut(it.blob, '', projName, base); ok++; } catch (e) { log('Failed ' + base + ': ' + e.message); }
      await sleep(200);
    }
    setStatus(`✅ Saved ${ok}/${list.length} images`); beep();
  }

  async function processItem(p, it) {
    const resume = it.status === 'sending';
    const before = new Set(allImgSrcs());
    const uCount = qa(CFG.user).length;
    if (!resume) {
      it.status = 'sending'; it.msg = ''; await save(); render();
      const full = [p.prefix, it.text, p.suffix].filter((x) => x && x.trim()).join(' ');
      try { await fillPrompt(full); await clickSend(); }
      catch (e) { it.status = 'error'; it.msg = e.message; await save(); render(); return; }
    }
    setStatus(`Generating: ${it.label}`);
    try {
      const res = await waitResult(uCount, before, resume);
      if (res.resumed) { it.status = 'done'; it.msg = 'resumed — download skipped'; }
      else if (res.skipped) { it.status = 'done'; it.msg = 'skipped manually'; }
      else if (res.img) {
        if (S.settings.autoDownload) await saveImage(res.img, p.name, baseName(it.text, p.items.indexOf(it), p.items.length));
        it.status = 'done'; it.msg = '';
        setStatus(`✅ ${it.label} done`); beep();
      } else if (res.limit && S.settings.pauseOnLimit) {
        it.status = 'pending'; it.msg = 'Limit: ' + res.text.slice(0, 80); S.run.running = false;
      } else { it.status = 'error'; it.msg = (res.text || 'No image found').slice(0, 120); }
    } catch (e) { it.status = 'error'; it.msg = e.message; }
    await save(); render();
  }

  async function runLoop() {
    if (looping) return; looping = true;
    const hb = setInterval(() => { try { chrome.storage.local.set({ bpi_hb: Date.now() }); } catch (e) {} }, 2000);
    try {
      let p = proj(S.run.projectId);
      if (!p) { S.run.running = false; return; }
      if (p.targetUrl && !S.run.navDone) {
        S.run.navDone = true; await save();
        const t = new URL(p.targetUrl, location.origin);
        if (t.pathname !== location.pathname) { setStatus('Opening chat…'); location.href = t.href; return; }
      }
      await waitFor(() => q(CFG.editor), 30000, 'prompt box');
      while (S.run.running) {
        p = proj(S.run.projectId); if (!p) break;
        const it = p.items.find((i) => i.status === 'sending') || p.items.find((i) => i.status === 'pending');
        if (!it) { S.run.running = false; setStatus('All done ✅'); beep(); beep(); break; }
        await processItem(p, it);
        if (!S.run.running) break;
        for (let s = S.settings.delay; s > 0 && S.run.running; s--) { setStatus(`Next prompt in ${s}s…`); await sleep(1000); }
      }
      if (!S.run.running && !/done/i.test($('#status').textContent)) setStatus('Stopped ⏸');
    } catch (e) { S.run.running = false; setStatus('Stopped: ' + e.message); }
    finally { clearInterval(hb); looping = false; mon('Monitor: idle'); await save(); render(); }
  }

  // ---------- init ----------
  (async () => {
    try { shadow.querySelector('.t2').textContent += ' · v' + chrome.runtime.getManifest().version; } catch (e) {}
    await load(); try { dirHandle = (await idbGet('dir')) || null; } catch (e) { dirHandle = null; }
    render();
    if (S.run.running) { // resume after a page reload/navigation
      await sleep(6000);
      const d = await chrome.storage.local.get(['bpi', 'bpi_hb']);
      if (d.bpi && d.bpi.run && d.bpi.run.running && Date.now() - (d.bpi_hb || 0) > 5000) {
        S = { ...S, ...d.bpi, settings: { ...DEFAULTS, ...d.bpi.settings } };
        $('#panel').classList.add('open'); render(); runLoop();
      }
    }
  })();
})();
