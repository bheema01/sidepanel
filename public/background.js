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

  if (changeInfo.status === 'complete') {
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
    console.log('[Background] Tab activated:', {
      tabId: tab.id,
      url: tab.url,
      isAllowed: isAllowedUrl(tab.url),
      title: tab.title
    });

    sendMessageSafely({
      type: 'TAB_STATE_UPDATE',
      isAllowed: isAllowedUrl(tab.url),
      url: tab.url,
      title: tab.title || 'Untitled'
    });
  } catch (error) {
    log.error('Failed to get tab info', { error });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('[Background] Icon clicked:', {
    tabId: tab.id,
    url: tab.url,
    isAllowed: isAllowedUrl(tab.url),
  });

  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Set panel behavior
chrome.sidePanel.setPanelBehavior({
  openPanelOnActionClick: true,
});

// Handle port connections for debugging
chrome.runtime.onConnect.addListener((port) => {
  console.log('[Background] Port connected:', port.name);

  port.onDisconnect.addListener(() => {
    console.log('[Background] Port disconnected:', port.name);
  });
});

// Handle port connections
chrome.runtime.onConnect.addListener((port) => {
  log.info('Port connected', { name: port.name });

  port.onDisconnect.addListener(() => {
    log.info('Port disconnected', { name: port.name });
  });

  port.onMessage.addListener((message) => {
    log.info('Message received', { message, from: port.name });
  });
});

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'NOTE_ADDED') {
    console.log('[Background] 📝 New note added:', {
      note: message.payload,
      tabId: sender.tab?.id,
      timestamp: new Date().toISOString()
    });
  }
});
