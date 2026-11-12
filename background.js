chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
});

chrome.runtime.onMessage.addListener((m, _sender, sendResponse) => {
  if (m && m.type === 'download') {
    chrome.downloads
      .download({ url: m.url, filename: m.filename, conflictAction: 'uniquify', saveAs: false })
      .then((id) => sendResponse({ ok: true, id }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async response
  }
});


// Rename downloads that Flow's own Download menu starts (set by content.js via expectDownload)
const PEND = 'bpi_pend';
const getPend = async () => (await chrome.storage.session.get(PEND))[PEND] || null;
const setPend = (p) => chrome.storage.session.set({ [PEND]: p });

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  (async () => {
    const p = await getPend();
    if (p && p.state === 'waiting' && item.byExtensionId !== chrome.runtime.id && Date.now() - p.t < p.timeout) {
      p.state = 'started'; p.id = item.id; await setPend(p);
      suggest({ filename: p.filename, conflictAction: 'uniquify' });
    } else suggest();
  })().catch(() => suggest());
  return true;
});

chrome.downloads.onChanged.addListener(async (d) => {
  const p = await getPend();
  if (!p || p.id !== d.id || !d.state) return;
  if (d.state.current === 'complete') { p.state = 'done'; await setPend(p); }
  else if (d.state.current === 'interrupted') { p.state = 'error'; await setPend(p); }
});

chrome.runtime.onMessage.addListener((m, _s, sendResponse) => {
  if (!m) return;
  if (m.type === 'expectDownload') { setPend({ filename: m.filename, timeout: m.timeout || 480000, t: Date.now(), state: 'waiting' }).then(() => sendResponse({ ok: true })); return true; }
  if (m.type === 'dlStatus') { getPend().then((p) => sendResponse({ state: p ? p.state : null })); return true; }
  if (m.type === 'clearPending') { chrome.storage.session.remove(PEND).then(() => sendResponse({ ok: true })); return true; }
});

// ---------- MCP bridge (lets Claude control the extension through the local MCP server) ----------
const MCP_KEY = 'bpi_mcp', MCP_ST = 'bpi_mcp_state';
const SITES = {
  chatgpt: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  flow: ['https://flow.google.com/*', 'https://labs.google/fx/*'],
};
let ws = null, pingT = null, retryT = null;

const mcpCfg = async () => ({ enabled: false, port: 8765, token: '', ...((await chrome.storage.local.get(MCP_KEY))[MCP_KEY] || {}) });
const mcpState = (s) => chrome.storage.local.set({ [MCP_ST]: s });

async function mcpConnect() {
  clearTimeout(retryT); clearInterval(pingT);
  if (ws) { const old = ws; ws = null; try { old.close(); } catch (e) { /* ignore */ } }
  const c = await mcpCfg();
  if (!c.enabled) return mcpState('off');
  await mcpState('connecting');
  let sock;
  try { sock = new WebSocket(`ws://127.0.0.1:${c.port}`); } catch (e) { await mcpState('err'); retryT = setTimeout(mcpConnect, 5000); return; }
  ws = sock;
  sock.onopen = () => {
    sock.send(JSON.stringify({ type: 'hello', token: c.token || '', version: chrome.runtime.getManifest().version }));
    pingT = setInterval(() => { try { sock.send('{"type":"ping"}'); } catch (e) { /* closed */ } }, 20000); // also keeps this worker alive
  };
  sock.onmessage = async (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.type === 'welcome') return mcpState('on');
    if (m.type === 'denied') { c.enabled = false; return mcpState('denied'); }
    if (m.type !== 'cmd') return;
    let out;
    try { out = { ok: true, result: await mcpRoute(m.cmd, m.args || {}) }; }
    catch (e) { out = { ok: false, error: String((e && e.message) || e) }; }
    try { sock.send(JSON.stringify({ type: 'res', id: m.id, ...out })); } catch (e) { /* closed */ }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null; clearInterval(pingT);
    mcpCfg().then((cfg) => { if (cfg.enabled) { mcpState('err'); retryT = setTimeout(mcpConnect, 5000); } });
  };
  sock.onerror = () => {};
}

async function mcpTabs(site) {
  const urls = site ? SITES[site] : [...SITES.chatgpt, ...SITES.flow];
  const tabs = await chrome.tabs.query({ url: urls });
  return tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
}
const siteOf = (u) => (/flow\.google\.com|labs\.google/.test(u || '') ? 'flow' : 'chatgpt');

async function mcpRoute(cmd, a) {
  if (cmd === 'list_tabs') return (await mcpTabs()).map((t) => ({ tabId: t.id, site: siteOf(t.url), title: t.title, url: t.url, active: t.active }));
  if (cmd === 'open_tab') {
    const home = { chatgpt: 'https://chatgpt.com/', flow: 'https://flow.google.com/' }[a.site];
    if (!home) throw new Error('site must be "chatgpt" or "flow"');
    const url = a.url || home;
    if (!SITES[a.site].some((p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace('*', '.*') + '$').test(url))) throw new Error('URL is not on the chosen site');
    const t = await chrome.tabs.create({ url, active: true });
    return { tabId: t.id, note: 'Tab opened. Wait a few seconds for it to load before sending commands.' };
  }
  const tabs = await mcpTabs(a.platform);
  const tab = a.tabId ? tabs.find((t) => t.id === a.tabId) : tabs[0];
  if (!tab) throw new Error(`No ${a.platform || 'ChatGPT or Flow'} tab is open — use open_tab first.`);
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: 'mcp', cmd, args: a });
    if (!r) throw new Error('no answer');
    if (!r.ok) throw new Error(r.error);
    return r.result;
  } catch (e) {
    if (/Receiving end|no answer|Could not establish/i.test(String(e.message || e))) throw new Error('The extension is not active in that tab — refresh the page and try again.');
    throw e;
  }
}

chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch[MCP_KEY]) mcpConnect(); });
chrome.runtime.onStartup.addListener(mcpConnect);
chrome.runtime.onInstalled.addListener(mcpConnect);
chrome.alarms.create('bpi-mcp', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(async (al) => { if (al.name === 'bpi-mcp' && !ws && (await mcpCfg()).enabled) mcpConnect(); });
mcpConnect();
