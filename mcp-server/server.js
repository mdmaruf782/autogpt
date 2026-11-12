#!/usr/bin/env node
// MCP server for the Bulk Image Prompter Chrome extension.
//   Claude  <--stdio MCP-->  this server  <--WebSocket (127.0.0.1)-->  extension (service worker)  -->  ChatGPT / Flow tab
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from 'ws';
import { z } from 'zod';

const PORT = Number(process.env.BPI_PORT || 8765);
const TOKEN = process.env.BPI_TOKEN || ''; // optional; must match the Token field in the extension
const log = (...a) => console.error('[bpi-mcp]', ...a); // stdout is reserved for MCP

// ---------- WebSocket bridge to the extension ----------
let ext = null;
let seq = 0;
const pending = new Map();

const wss = new WebSocketServer({
  host: '127.0.0.1',
  port: PORT,
  // Only browser extensions may connect; ordinary web pages send an https:// origin and are refused.
  verifyClient: (info) => String(info.origin || '').startsWith('chrome-extension://'),
});
wss.on('error', (e) => log('WebSocket server error:', e.code === 'EADDRINUSE' ? `port ${PORT} is already in use (another copy running?)` : e.message));
wss.on('listening', () => log(`waiting for the extension on ws://127.0.0.1:${PORT}`));
wss.on('connection', (ws) => {
  let ok = false;
  const timer = setTimeout(() => { if (!ok) ws.close(); }, 5000);
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(String(raw)); } catch { return; }
    if (m.type === 'hello') {
      if (TOKEN && m.token !== TOKEN) { ws.send(JSON.stringify({ type: 'denied' })); ws.close(); return; }
      ok = true; clearTimeout(timer);
      if (ext && ext !== ws) { try { ext.close(); } catch { /* ignore */ } }
      ext = ws; ws.send(JSON.stringify({ type: 'welcome' })); log('extension connected, v' + (m.version || '?'));
    } else if (!ok) return;
    else if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    else if (m.type === 'res' && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.t);
      m.ok ? p.resolve(m.result) : p.reject(new Error(m.error || 'failed'));
    }
  });
  ws.on('close', () => {
    clearTimeout(timer);
    if (ext === ws) {
      ext = null; log('extension disconnected');
      for (const [id, p] of pending) { clearTimeout(p.t); p.reject(new Error('Extension disconnected')); pending.delete(id); }
    }
  });
});

function call(cmd, args = {}, timeoutMs = 60000) {
  if (!ext || ext.readyState !== 1) {
    return Promise.reject(new Error('The extension is not connected. In Chrome open the extension panel → Settings → turn on "MCP bridge" (port ' + PORT + '), then retry.'));
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out waiting for "${cmd}"`)); }, timeoutMs);
    pending.set(id, { resolve, reject, t });
    ext.send(JSON.stringify({ type: 'cmd', id, cmd, args }));
  });
}

// ---------- MCP tools ----------
const server = new McpServer({ name: 'bulk-image-prompter', version: '1.0.0' });

const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: String(e && e.message ? e.message : e) }] });
const wrap = (cmd, timeout) => async (args) => { try { return text(await call(cmd, args, timeout)); } catch (e) { return fail(e); } };

const platform = z.enum(['chatgpt', 'flow']).optional().describe('Which site tab to control. Default: the most recently used ChatGPT/Flow tab.');
const project = z.string().optional().describe('Project name or id. Default: the active project.');

server.registerTool('list_tabs', {
  description: 'List the open ChatGPT and Google Flow tabs the extension can control.',
  inputSchema: {},
}, wrap('list_tabs'));

server.registerTool('open_tab', {
  description: 'Open ChatGPT or Google Flow in a new tab (or focus an existing one). After it loads the extension panel is ready.',
  inputSchema: { site: z.enum(['chatgpt', 'flow']), url: z.string().optional().describe('Optional exact URL on that site, e.g. a chat or Flow project URL.') },
}, wrap('open_tab'));

server.registerTool('get_status', {
  description: 'Current state of the extension: running or not, active project, counts, what the monitor shows right now, recent log lines, and settings. Call this to see progress.',
  inputSchema: { platform },
}, wrap('status'));

server.registerTool('list_projects', {
  description: 'List all projects with their done/total counts.',
  inputSchema: { platform },
}, wrap('list_projects'));

server.registerTool('get_items', {
  description: 'List the prompts of a project with their status (pending, sending, done, error) and error messages.',
  inputSchema: { platform, project, status: z.enum(['pending', 'sending', 'done', 'error']).optional() },
}, wrap('get_items'));

server.registerTool('import_prompts', {
  description: 'Import prompts into the extension. Accepts markdown (## ID heading then the prompt), JSON, CSV (id,prompt) or blocks separated by --- / blank lines. Creates a new project (mode "new") or appends to one (mode "add").',
  inputSchema: {
    platform,
    text: z.string().describe('The raw prompt file content.'),
    mode: z.enum(['new', 'add']).default('new'),
    name: z.string().optional().describe('Name for the new project (also the download folder name).'),
    project,
    prefix: z.string().optional().describe('Text added before every prompt (new project).'),
    suffix: z.string().optional().describe('Text added after every prompt (new project).'),
    targetUrl: z.string().optional().describe('Chat or Flow project URL to open before starting.'),
  },
}, wrap('import_prompts'));

server.registerTool('update_project', {
  description: 'Change a project: rename it, set its prefix, suffix or target URL, or make it the active project.',
  inputSchema: {
    platform, project,
    name: z.string().optional(), prefix: z.string().optional(), suffix: z.string().optional(), targetUrl: z.string().optional(),
    makeActive: z.boolean().optional(),
  },
}, wrap('update_project'));

server.registerTool('delete_project', {
  description: 'Delete a project and its queue. Cannot be undone.',
  inputSchema: { platform, project: z.string().describe('Project name or id (required).') },
}, wrap('delete_project'));

server.registerTool('start', {
  description: 'Start (or resume) the automation for a project. Returns immediately; use get_status or wait_for_progress to follow it. On Flow the saved Flow settings are applied first.',
  inputSchema: { platform, project },
}, wrap('start'));

server.registerTool('pause', {
  description: 'Pause after the current prompt finishes.',
  inputSchema: { platform },
}, wrap('pause'));

server.registerTool('skip_current', {
  description: 'Mark the prompt that is currently generating as done/skipped and move on (like the Done/Skip button).',
  inputSchema: { platform },
}, wrap('skip'));

server.registerTool('retry_errors', {
  description: 'Set all failed prompts of a project back to pending.',
  inputSchema: { platform, project },
}, wrap('retry_errors'));

server.registerTool('reset_project', {
  description: 'Set every prompt of a project back to pending.',
  inputSchema: { platform, project },
}, wrap('reset'));

server.registerTool('set_settings', {
  description: 'Change general extension settings. Only the fields you pass are changed.',
  inputSchema: {
    platform,
    delay: z.number().int().min(1).optional().describe('Seconds between prompts.'),
    maxWaitMin: z.number().int().min(1).optional().describe('Max minutes to wait per prompt.'),
    autoDownload: z.boolean().optional(),
    pauseOnLimit: z.boolean().optional(),
    sound: z.boolean().optional(),
    serial: z.boolean().optional().describe('Prefix file names with the prompt serial (01_R5.png).'),
    projSub: z.boolean().optional().describe('Save into a sub-folder named after the project.'),
    dlRoot: z.string().optional().describe('Downloads sub-folder name for ChatGPT.'),
    dlRootFlow: z.string().optional().describe('Downloads sub-folder name for Google Flow.'),
  },
}, wrap('set_settings'));

server.registerTool('set_flow_settings', {
  description: 'Set the Google Flow generation settings the extension applies automatically on Start. Optionally apply them to the open Flow tab right now.',
  inputSchema: {
    mode: z.enum(['image', 'video']).optional(),
    input: z.enum(['frames', 'ingredients']).optional().describe('Video input type.'),
    aspect: z.enum(['16:9', '4:3', '1:1', '3:4', '9:16']).optional().describe('Video supports only 16:9 and 9:16.'),
    imageModel: z.string().optional().describe('e.g. "Nano Banana Pro", "Nano Banana 2 Lite", "Nano Banana 2.1"'),
    videoModel: z.string().optional().describe('e.g. "Veo 3.1 - Lite", "Veo 3.1 - Fast", "Veo 3.1 - Quality", "Omni 1.2 Flash"'),
    outputs: z.number().int().min(1).max(4).optional().describe('Outputs per prompt (x1-x4).'),
    videoQuality: z.enum(['1080p', '720p', '270p', 'direct']).optional().describe('Video download quality via the tile Download menu.'),
    apply: z.boolean().optional().describe('Apply these settings automatically on Start.'),
    applyNow: z.boolean().optional().describe('Also push them into the open Flow tab now.'),
  },
}, wrap('set_flow_settings', 90000));

server.registerTool('download_all', {
  description: 'Save every generated image (ChatGPT chat) or every image/video on the page (Flow) to the download location.',
  inputSchema: { platform },
}, wrap('download_all'));

server.registerTool('wait_for_progress', {
  description: 'Wait (up to timeoutSec, max 300) until the run stops or the number of finished prompts changes, then return the status. Use instead of polling get_status in a tight loop.',
  inputSchema: { platform, timeoutSec: z.number().int().min(5).max(300).default(120) },
}, async ({ platform: p, timeoutSec }) => {
  try {
    const t0 = Date.now();
    let first = await call('status', { platform: p });
    const done0 = first.counts.done + first.counts.error;
    for (;;) {
      await new Promise((r) => setTimeout(r, 4000));
      const s = await call('status', { platform: p });
      if (!s.running || s.counts.done + s.counts.error !== done0 || Date.now() - t0 > timeoutSec * 1000) return text(s);
    }
  } catch (e) { return fail(e); }
});

await server.connect(new StdioServerTransport());
log('MCP server ready');
