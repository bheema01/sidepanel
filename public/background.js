// Logging utility with forced console output
const log = {
  info: (message, data) => {
    const logMessage = `[Background] 📘 ${message}`;
    console.log(logMessage, data || '');
    // Force log to service worker console
    if (globalThis.registration) {
      globalThis.registration.active?.postMessage({
        type: 'LOG',
        level: 'info',
        message: logMessage,
        data,
      });
    }
  },
  warn: (message, data) =>
    console.warn(`[Background] ⚠️ ${message}`, data || ''),
  error: (message, data) =>
    console.error(`[Background] 🔴 ${message}`, data || ''),
};

// Simple initialization log
console.log('[Background] Starting service worker...');

// Track allowed domains
const ALLOWED_DOMAINS = ['localhost', 'github.com', 'google.com'];

// Check if URL is allowed
function isAllowedUrl(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_DOMAINS.some((domain) => hostname.includes(domain));
  } catch (e) {
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

    log.info('Tab activated:', state);

    if (isPanelReady) {
      sendMessageSafely(state);
    } else {
      pendingTabState = state;
    }
  } catch (error) {
    log.error('Failed to get tab info', { error });
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
    log.error('Failed to get current tab state', { error });
    return null;
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  log.info('Icon clicked', {
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
    log.info('Panel ready received');
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
    log.info('New note added', {
      note: message.payload,
      tabId: sender.tab?.id,
      timestamp: new Date().toISOString()
    });
  }
  return true;
});
