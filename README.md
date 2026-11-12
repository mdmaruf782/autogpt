# Bulk Image Prompter (ChatGPT + Google Flow)

A Chrome extension that lets you import a batch of prompts (organised by project), then submits them to ChatGPT or Google Flow one by one. When an image finishes generating, it is saved automatically and the next prompt is sent — until the whole queue is done.

> Unofficial tool. Not affiliated with or endorsed by OpenAI or Google. It automates the ChatGPT and Google Flow web UIs, so it can break when they change their interfaces, and your usage is still subject to their terms, limits and credits.

## Features

- **Project-wise bulk import** — keep separate prompt lists per project, each with its own status, URL, prefix and suffix.
- **Flexible import formats** — Markdown, JSON, CSV or plain text.
- **Automatic queue** — fills the prompt box, sends it, waits for the image to finish, then moves on.
- **Smart completion detection** — watches ChatGPT's Stop button, the "Thinking"/"Preview" state and the image itself.
- **Live monitor** — shows what the extension sees right now, plus a log of the last 30 events.
- **Controls** — Start, Pause, Done/Skip, Retry errors, Reset, and per-item reset/remove.
- **Auto download** — saves each image as a PNG, named after the scene in the prompt.
- **Choose where to save** — the Downloads folder (custom sub-folder) or any folder you pick.
- **Download all** — one button saves every generated image in the current chat.
- **Dark and light themes**, beep on completion, resumes after a page reload.
- **Google Flow (image and video)** — pick the mode, aspect ratio, model and outputs once in the **Flow** tab; they are applied to Flow automatically every time you press Start. Images are saved as PNG, videos as MP4.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder (the one that contains `manifest.json`).
5. Open [chatgpt.com](https://chatgpt.com) or [flow.google.com](https://flow.google.com) and refresh the page.
6. Optional: click the puzzle icon in the toolbar and pin the extension.

A **Bulk Image** button appears at the bottom right of ChatGPT. Click it (or the toolbar icon) to open or close the panel. The panel header shows the installed version.

After changing any extension file, click the reload icon on the extension card and refresh chatgpt.com.

## Quick start

1. Open the ChatGPT chat where you want the images generated. If you use a reference portrait or a style lock, send them in this chat first so every prompt shares that context.
2. Open the panel and go to **Import**.
3. Choose a prompt file (or paste text) and click **Import as new project**. The file name becomes the project name.
4. Go to **Queue** and click **Start**.

The extension now sends the prompts in order and saves each finished image. You can leave the tab open and do other things.

## Import formats

Every prompt needs an ID (used as a label) and the prompt text.

**Markdown** (recommended) — a `## ID` heading, with the prompt below it:

```markdown
## R5
SCENE R5: A grand divan chamber in Edirne, soft light through lattice windows. Same style as before, 16:9, no text.

## R6
SCENE R6: A council of viziers seated on low cushions in a tall stone hall, warm lamp light. Same style as before, 16:9, no text.
```

Text before the first `## ` heading is ignored, so you can keep notes at the top of the file.

**JSON:**

```json
[
  { "id": "S1", "prompt": "SCENE S1: A misty mountain village at dawn, 16:9, no text." },
  { "id": "S2", "prompt": "SCENE S2: A lone rider crossing a stone bridge at sunset, 16:9, no text." }
]
```

**CSV** — header row `id,prompt`, quote prompts that contain commas:

```csv
id,prompt
S1,"SCENE S1: A misty mountain village at dawn, 16:9, no text."
S2,"SCENE S2: A lone rider crossing a stone bridge at sunset, 16:9, no text."
```

**Plain text** — prompts separated by a line containing `---`, or by blank lines. IDs are generated as `P1`, `P2`, …

Sample files: [`sample-prompts.md`](sample-prompts.md) and [`sample-prompts.json`](sample-prompts.json).

## Using the panel

### Queue tab
- **Start** — runs every pending prompt in the active project.
- **Pause** — stops after the current prompt finishes.
- **Done/Skip** — tells the extension to stop waiting and move on (use it if an image is ready but the queue seems stuck).
- **Retry errors** — sets failed items back to pending.
- **Reset** — sets every item in the project back to pending.
- Each item has buttons to set it back to pending or remove it.
- The **Monitor** line shows the Stop button state, Thinking/Preview state, image detection, how long the image has been stable, and elapsed time.

### Project tab
- Create, rename and delete projects.
- **Chat / Project URL** — optional. The pin button saves the current chat URL; when you press Start, the extension opens that chat first.
- **Prefix / Suffix** — text added before or after every prompt in the project (handy for a style lock).

### Import tab
Load a file or paste text, then import it as a new project or add it to the current one.

### Download tab
- **Where to save images**
  - *Downloads folder* — saves inside Chrome's Downloads folder, in a sub-folder whose name you choose (default `ChatGPT-Bulk`).
  - *Choose a folder…* — pick any folder on your computer; images are written directly into it.
- **Auto download** — save each image as soon as it finishes.
- **Project sub-folder** — put images in a folder named after the project.
- **Serial prefix** — add the prompt's position to the name (`01_R5.png`).
- **Download all generated images in this chat** — scrolls through the whole chat automatically and saves every generated image.

### Settings tab
Delay between prompts, maximum wait per image, pause on usage limit, completion beep, and the event log.

## File naming

1. If the prompt contains a scene number — `SCENE R5:`, `Scene 12 -`, `scene no. 7` — that number is the file name: `R5.png`, `12.png`, `7.png`.
2. If there is no scene number, the prompt's serial number in the list is used: `03.png`.
3. With **Serial prefix** on, the position is added in front: `01_R5.png`, `02_R6.png`.
4. If a file with the same name exists, `_2`, `_3`, … is appended; nothing is overwritten.

## Notes and limitations

- Keep the ChatGPT tab open. Chrome may slow timers in hidden tabs; an open background tab usually still works.
- Chrome does not allow choosing the top-level Downloads, Desktop or Documents folder with the folder picker. Create a folder inside one of them and pick that.
- After restarting Chrome, the folder permission may need to be granted again. Pressing **Start** asks for it. If permission is missing, images fall back to the Downloads folder instead of being lost.
- **Download all** scrolls the chat itself (ChatGPT only keeps a window of turns loaded), so keep the tab open and visible until it finishes.
- The extension works on the ChatGPT web UI only (`chatgpt.com`, `chat.openai.com`).

## Troubleshooting

| Problem | What to try |
| --- | --- |
| No toolbar icon | Click the puzzle icon in Chrome and pin the extension. |
| No **Bulk Image** button on ChatGPT | Reload the extension on `chrome://extensions`, then refresh chatgpt.com. |
| Panel does not show the new version | The extension was not reloaded. Reload it and refresh the page. |
| "Prompt was not sent" | Check the Monitor line and Log. ChatGPT's page structure may have changed — see below. |
| Queue never moves on | Watch the Monitor. If the image is ready, press **Done/Skip**. If Stop stays on, ChatGPT is still working. |
| Items marked Error | Open the Log for the reason, then press **Retry errors**. |
| Queue paused with "Limit: …" | You hit ChatGPT's image limit. Wait, then press **Start** again. |
| Images land in Downloads, not my folder | Re-pick the folder in the Download tab and press **Start** to grant permission. |

### If ChatGPT changes its UI

All page selectors live in one block at the top of `content.js`:

```js
const CFG = {
  editor: [...],     // prompt box
  send: [...],       // send button
  stop: [...],       // stop button (shown while generating)
  assistant: '...',  // assistant messages
  user: '...',       // user messages
};
```

Open ChatGPT's DevTools, find the new attribute or `aria-label` for the element, and update the matching selector.

## Google Flow

1. Open your Flow project (`https://flow.google.com/project/…`) and open the panel.
2. Go to the **Flow** tab and choose:
   - **Mode** — Image or Video (Video also has **Frames** / **Ingredients**)
   - **Aspect ratio** — Image: 16:9, 4:3, 1:1, 3:4, 9:16 · Video: 16:9, 9:16
   - **Model** — e.g. Nano Banana Pro (image), Veo 3.1 - Lite / Fast / Quality, Omni (video)
   - **Outputs per prompt** — x1 to x4
3. Import prompts and press **Start**. The extension opens Flow's settings, selects your choices, checks them, then submits each prompt and waits until every new tile has finished (or failed) before moving on. **Apply to Flow now** lets you test the settings without running anything.
   - **Video download quality** — 1080p (upscaled by Flow, then downloaded), 720p original, 270p GIF, or the direct file. This uses each video's own Download menu, so 1080p takes extra time; these files go to Chrome's Downloads folder.
4. With more than one output per prompt, files get `_1`, `_2`… after the name. Use **Download all images and videos on this page** to save everything already in the project.

Notes: every generation uses Flow credits. If Flow shows an "unusual activity" warning, the run stops instead of retrying — reload Flow, use it manually for a bit, then press Start again. In the Project tab, set the project's URL to your Flow project so Start opens it first.

## Control with Claude (MCP)

The extension can be driven by an AI assistant — **Claude** (Claude Code or Claude Desktop) or **Codex** (OpenAI Codex CLI) — through a small local MCP server in `mcp-server/`. The assistant can import prompts, start/pause, change Google Flow settings and read live progress.

```
Claude / Codex  ⇄  MCP server (node, stdio)  ⇄  WebSocket on 127.0.0.1  ⇄  extension  ⇄  ChatGPT / Flow tab
```

### 1. Install the server (once)

Needs Node 18+.

```bash
cd mcp-server
npm install
```

Note the full path to `mcp-server/server.js` (for example `/Users/you/chromeExt/autogpt/mcp-server/server.js`). Use it in the commands below.

### 2. Register it with your assistant

**Claude Code**

```bash
claude mcp add bulk-image-prompter -- node /full/path/to/mcp-server/server.js
```

Check with `claude mcp list`, then start a new Claude Code session (MCP tools load at session start).

**Claude Desktop** — edit `claude_desktop_config.json` (Settings → Developer → Edit Config), add the block below, then restart the app:

```json
{
  "mcpServers": {
    "bulk-image-prompter": {
      "command": "node",
      "args": ["/full/path/to/mcp-server/server.js"]
    }
  }
}
```

**Codex CLI** — either run:

```bash
codex mcp add bulk-image-prompter -- node /full/path/to/mcp-server/server.js
```

or add this to `~/.codex/config.toml`:

```toml
[mcp_servers.bulk-image-prompter]
command = "node"
args = ["/full/path/to/mcp-server/server.js"]
```

Check with `codex mcp list` (or `/mcp` inside Codex), then start a new Codex session.

Any other MCP-capable client works the same way: run `node /full/path/to/mcp-server/server.js` as a stdio server.

### 3. Turn on the bridge in Chrome

Open the extension panel → **Settings** → turn on **MCP bridge**. The status line changes to "Connected to the MCP server" once your assistant has started the server. The default port is 8765; to change it, set the `BPI_PORT` environment variable for the server and enter the same number in the panel. Only one assistant session can hold the port at a time — close the other one if the status stays on "Waiting for the MCP server".

### 4. Ask your assistant

> Open Flow, import these prompts as project "Ep3", set video mode with Veo 3.1 - Fast at 1080p, start it and tell me when it's done.

> Open ChatGPT, import the prompts from this file as "Chapter 2" and run them all.

**Tools:** `list_tabs`, `open_tab`, `get_status`, `list_projects`, `get_items`, `import_prompts`, `update_project`, `delete_project`, `start`, `pause`, `skip_current`, `retry_errors`, `reset_project`, `set_settings`, `set_flow_settings`, `download_all`, `wait_for_progress`.

**Safety:** the server listens on `127.0.0.1` only and refuses any connection that does not come from a browser extension, so websites cannot reach it. Optionally set `BPI_TOKEN` for the server and the same value in the panel's Token field. Keep the browser open while a run is in progress; the first-time folder-picker permission still has to be granted by you in the Download tab.

## Project structure

```
manifest.json        Chrome extension manifest (MV3)
content.js           Panel UI and ChatGPT / Google Flow automation
parser.js            Prompt import parser (Markdown / JSON / CSV / text)
background.js        Downloads, file renaming, toolbar icon click and the MCP bridge
mcp-server/          Local MCP server (server.js, package.json) for Claude
icons/               Extension icons
sample-prompts.md    Sample import file (Markdown)
sample-prompts.json  Sample import file (JSON)
```

Everything runs locally in your browser. Projects and settings are stored with `chrome.storage.local`; the chosen folder handle is stored in the page's IndexedDB. No data is sent to any server.

## Roadmap

- Flow: choose video duration/resolution (not selectable in Flow's settings popover today) and per-tile download quality.

## License

Add a license of your choice before publishing (for example MIT).
