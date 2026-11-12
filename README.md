# ChatGPT Bulk Image Prompter

Chrome extension that imports prompts in bulk (project-wise) and submits them one by one in ChatGPT for image generation. When one image finishes, it saves it and sends the next prompt.

## Install
1. Chrome -> `chrome://extensions` -> turn Developer mode ON -> **Load unpacked** -> select this folder.
2. Open chatgpt.com and refresh. A **Bulk Image** button appears at the bottom right (the toolbar icon also toggles the panel). The panel header shows the version.

## Usage
1. Open the ChatGPT chat that already has your reference portrait and style lock.
2. In the panel: **Import** tab -> choose a file or paste text -> **Import as new project** (the file name becomes the project name), or **Add to current project**.
3. (Optional) **Project** tab -> pin button saves the current chat URL; Start will then open that chat first.
4. **Queue** tab -> **Start**. Each prompt is sent, the extension waits until the image finishes, saves it, then sends the next prompt.
5. **Pause** stops after the current prompt. Use **Retry errors** for failed items, **Done/Skip** to move on manually.

## Import formats
- Markdown: `## ID` heading + prompt below (see `sample-prompts.md`)
- JSON: `[{"id":"S1","prompt":"..."}]` (see `sample-prompts.json`)
- CSV: `id,prompt`
- Plain text: blocks separated by `---` or blank lines

## Download tab
- **Save to:** the Downloads folder (custom sub-folder name) or any folder you choose with the folder picker.
- **File name:** the scene number from the prompt (`SCENE R5:` -> `R5.png`). If the prompt has no scene number, the prompt serial (`03.png`). With the serial prefix on: `01_R5.png`. Duplicates get `_2`, `_3`.
- **Download all generated images in this chat:** saves every generated image currently loaded on the page using the same naming.
- Chrome does not allow picking the top-level Downloads/Desktop/Documents folder; create a folder inside one and pick that. Permission may be requested again after a browser restart.

## Tips
- Keep the ChatGPT tab open (an inactive tab works, but Chrome may slow timers in hidden tabs).
- Dark/Light toggle is at the top right of the panel.
- If ChatGPT changes its UI, update the selectors in the `CFG` block at the top of `content.js`.
- Google Flow support: coming soon.
