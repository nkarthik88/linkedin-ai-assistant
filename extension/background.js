// IMPORTANT: onMessage must be the very first statement so it is registered
// synchronously the instant the service worker wakes up — before any async work.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "BG_FETCH") return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), msg.timeout || 15000);
  fetch(msg.url, { ...(msg.options || {}), signal: controller.signal })
    .then(async (r) => {
      clearTimeout(timeoutId);
      const text = await r.text();
      sendResponse({ ok: r.ok, status: r.status, text });
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      sendResponse({ error: err.message });
    });
  return true; // keep the message channel open for the async sendResponse
});

function generateUUID() {
  return crypto.randomUUID();
}

async function ensureUserId() {
  const { userId } = await chrome.storage.local.get("userId");
  if (!userId) {
    const newId = generateUUID();
    await chrome.storage.local.set({ userId: newId });
    return newId;
  }
  return userId;
}

chrome.runtime.onInstalled.addListener(() => {
  ensureUserId();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});
