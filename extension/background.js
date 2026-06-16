// IMPORTANT: onMessage must be the very first statement so it is registered
// synchronously the instant the service worker wakes up — before any async work.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "BG_FETCH") return false;

  // Trace every API call so usage issues are visible in:
  // DevTools → Extensions → Service Worker → Console
  const isReddit = msg.url?.includes("/api/reddit/");
  const shortUrl = msg.url?.replace("https://api.propostly.com", "");
  if (isReddit) {
    console.log(`[BG_FETCH] ➜ ${msg.options?.method || "GET"} ${shortUrl}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), msg.timeout || 15000);
  fetch(msg.url, { ...(msg.options || {}), signal: controller.signal })
    .then(async (r) => {
      clearTimeout(timeoutId);
      const text = await r.text();
      if (isReddit) {
        // Parse usage fields out of the response so they appear in the log
        try {
          const d = JSON.parse(text);
          const usage = d.featureUsed !== undefined
            ? `used=${d.featureUsed}/${d.featureLimit} remaining=${d.featureRemaining}`
            : "";
          console.log(`[BG_FETCH] ✓ ${r.status} ${shortUrl} ${usage}`);
        } catch {
          console.log(`[BG_FETCH] ✓ ${r.status} ${shortUrl}`);
        }
      }
      sendResponse({ ok: r.ok, status: r.status, text });
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      if (isReddit) console.warn(`[BG_FETCH] ✗ ${shortUrl}`, err.message);
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
