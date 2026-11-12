# ChatGPT Bulk Image Prompter

A Chrome extension that lets you import a batch of image prompts (organised by project), then submits them to ChatGPT one by one. When an image finishes generating, it is saved automatically and the next prompt is sent — until the whole queue is done.

> Unofficial tool. Not affiliated with or endorsed by OpenAI. It automates the ChatGPT web UI, so it can break when ChatGPT changes its interface, and your usage is still subject to ChatGPT's terms and image-generation limits.

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
- **Google Flow** — coming soon.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder (the one that contains `manifest.json`).
5. Open [chatgpt.com](https://chatgpt.com) and refresh the page.
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

## Project structure

```
manifest.json        Chrome extension manifest (MV3)
content.js           Panel UI and ChatGPT automation
parser.js            Prompt import parser (Markdown / JSON / CSV / text)
background.js        Handles downloads and the toolbar icon click
icons/               Extension icons
sample-prompts.md    Sample import file (Markdown)
sample-prompts.json  Sample import file (JSON)
```

Everything runs locally in your browser. Projects and settings are stored with `chrome.storage.local`; the chosen folder handle is stored in the page's IndexedDB. No data is sent to any server.

## Roadmap

- Google Flow support (the option is visible in the panel as "Coming soon").

## License

Add a license of your choice before publishing (for example MIT).
