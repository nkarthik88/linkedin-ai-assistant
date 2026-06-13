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
  // Side panel opens on toolbar click — stays open while browsing
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});
