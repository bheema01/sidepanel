// Logging utility removed, using console directly
console.log('[Background] Starting service worker...');

// Track allowed domains
const ALLOWED_DOMAINS = ['localhost', 'github.com', 'google.com'];

// Create regex patterns for each domain
const domainPatterns = ALLOWED_DOMAINS.map(domain => {
  if (domain === 'localhost') {
    return new RegExp('^localhost$');
  }
  // Escape dots and create pattern that allows subdomains
  return new RegExp(`^(?:[\\w-]+\\.)*${domain.replace(/\./g, '\\.')}$`);
});

// Check if URL is allowed
function isAllowedUrl(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return domainPatterns.some(pattern => pattern.test(hostname));
  } catch (e) {
    console.error('[Background] URL parsing error:', e);
    return false;
  }
}

// Instead of directly sending messages:
function sendMessageSafely(message) {
  chrome.runtime.sendMessage(message).catch(err => {
    console.log('[Background] Error sending message:', err.message);
    // Message failed, but we caught the error
  });
}

// Handle tab updates with title
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('[Background] Tab updated:', {
    tabId,
    url: tab.url,
    isAllowed: isAllowedUrl(tab.url),
    title: tab.title
  });

  if (changeInfo.status === 'complete' && isPanelReady) {
    sendMessageSafely({
      type: 'TAB_STATE_UPDATE',
      isAllowed: isAllowedUrl(tab.url),
      url: tab.url,
      title: tab.title || 'Untitled'
    });
  }
});

// Handle tab activation with title
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const state = {
      type: 'TAB_STATE_UPDATE',
      isAllowed: isAllowedUrl(tab.url),
      url: tab.url,
      title: tab.title || 'Untitled'
    };

    console.info('[Background] Tab activated:', state);

    if (isPanelReady) {
      sendMessageSafely(state);
    } else {
      pendingTabState = state;
    }
  } catch (error) {
    console.error('[Background] Failed to get tab info', { error });
  }
});

let isPanelReady = false;
let pendingTabState = null;

// Add function to get current tab state
async function getCurrentTabState() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return {
      type: 'TAB_STATE_UPDATE',
      isAllowed: isAllowedUrl(tab.url),
      url: tab.url,
      title: tab.title || 'Untitled'
    };
  } catch (error) {
    console.error('[Background] Failed to get current tab state', { error });
    return null;
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  console.info('[Background] Icon clicked', {
    tabId: tab.id,
    url: tab.url,
    isAllowed: isAllowedUrl(tab.url)
  });

  // Store the state we want to send
  pendingTabState = {
    type: 'TAB_STATE_UPDATE',
    isAllowed: isAllowedUrl(tab.url),
    url: tab.url,
    title: tab.title || 'Untitled'
  };

  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// Set panel behavior
chrome.sidePanel.setPanelBehavior({
  openPanelOnActionClick: true,
});

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PANEL_READY') {
    console.info('[Background] Panel ready received');
    isPanelReady = true;
    
    // Send pending state or get current tab state
    if (pendingTabState) {
      sendMessageSafely(pendingTabState);
      pendingTabState = null;
    } else {
      // Immediately get and send current tab state
      getCurrentTabState().then(state => {
        if (state) {
          sendMessageSafely(state);
        }
      });
    }
    sendResponse({ received: true });
  } else if (message.type === 'NOTE_ADDED') {
    console.info('[Background] New note added', {
      note: message.payload,
      tabId: sender.tab?.id,
      timestamp: new Date().toISOString()
    });
  }
  return true;
});
