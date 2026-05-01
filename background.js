// PromptForge — background.js (service worker)

// Create right-click context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'promptforge-forge',
    title: '⚡ Forge this as JSON prompt',
    contexts: ['selection', 'editable']
  });
});

// Handle context menu click → open popup with pre-filled text
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'promptforge-forge') return;

  const selectedText = info.selectionText || '';

  // Store selected text so popup can pick it up
  await chrome.storage.local.set({ contextText: selectedText, contextTrigger: Date.now() });

  // Open popup (Chrome doesn't allow programmatic popup open from background,
  // so we open a small standalone window as fallback)
  chrome.action.openPopup?.().catch(() => {
    // openPopup not available in all versions — store and let user click icon
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONTEXT_TARGET') {
    chrome.storage.local.set({ contextText: message.selectedText });
  }
  sendResponse({ received: true });
});
