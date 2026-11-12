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
