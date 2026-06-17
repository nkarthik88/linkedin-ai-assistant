// IMPORTANT: onMessage must be the very first statement so it is registered
// synchronously the instant the service worker wakes up — before any async work.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "BG_FETCH") return false;

  const isReddit = msg.url?.includes("/api/reddit/");
  const shortUrl = msg.url?.replace("https://api.propostly.com", "");
  if (isReddit) {
    console.log(`[BG_FETCH] ➜ ${msg.options?.method || "GET"} ${shortUrl}`);
  }

  // Attach stable device fingerprint to every outgoing API request.
  // Resolved async then fetch proceeds — does not block the message listener.
  getStableUserId().then((deviceId) => {
    const headers = {
      ...(msg.options?.headers || {}),
      "X-Device-Fingerprint": deviceId,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), msg.timeout || 15000);

    fetch(msg.url, { ...(msg.options || {}), headers, signal: controller.signal })
      .then(async (r) => {
        clearTimeout(timeoutId);
        const text = await r.text();

        if (isReddit) {
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

        // Global 402 handler — open billing page so the user can upgrade.
        // Only fires for non-status-check endpoints to avoid infinite loops.
        if (r.status === 402 && !msg.url?.includes("/api/usage/status")) {
          handle402();
        }

        sendResponse({ ok: r.ok, status: r.status, text });
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (isReddit) console.warn(`[BG_FETCH] ✗ ${shortUrl}`, err.message);
        sendResponse({ error: err.message });
      });
  });

  return true; // keep message channel open for async sendResponse
});

/**
 * Returns a stable UUID that survives extension reinstalls on the same browser
 * profile by using chrome.storage.sync (synced across devices for the same
 * Chrome/Brave profile). Falls back to storage.local if sync is unavailable
 * (e.g. sync disabled, Opera without Google account).
 *
 * Does NOT use chrome.identity — that requires Google sign-in and fails on
 * Brave, Opera, and Vivaldi when the user isn't logged into a Google account.
 */
async function getStableUserId() {
  // 1. Try sync storage first (survives reinstall on same profile)
  try {
    const synced = await chrome.storage.sync.get("stableUserId");
    if (synced.stableUserId) {
      // Mirror to local so it's available without a sync round-trip next time
      chrome.storage.local.set({ userId: synced.stableUserId }).catch(() => {});
      return synced.stableUserId;
    }
  } catch {
    // sync storage unavailable — fall through to local
  }

  // 2. Check local storage (pre-existing installs)
  const local = await chrome.storage.local.get("userId");
  if (local.userId) {
    // Promote to sync so future reinstalls on the same profile recover it
    chrome.storage.sync.set({ stableUserId: local.userId }).catch(() => {});
    return local.userId;
  }

  // 3. First install — generate a new UUID and persist to both stores
  const newId = crypto.randomUUID();
  chrome.storage.local.set({ userId: newId }).catch(() => {});
  chrome.storage.sync.set({ stableUserId: newId }).catch(() => {});
  return newId;
}

/**
 * Open the LinkedIn Pro billing page when a 402 is received.
 * Uses chrome.tabs so it works from the service worker context.
 */
function handle402() {
  chrome.tabs.create({
    url: "https://checkout.dodopayments.com/buy/pdt_0NfglmAMcUzd4GiVlnt0H?quantity=1",
    active: true,
  }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  getStableUserId(); // ensure ID is seeded on install
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});
