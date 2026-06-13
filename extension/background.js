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
  // Popup (popup.html) is the default UI — side panel available but not auto-opened
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});
