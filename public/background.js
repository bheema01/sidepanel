/**
 * Background script with simplified window-based state management
 */

console.log('[Background] Starting service worker...');

// Configuration
const ALLOWED_DOMAINS = ['localhost', 'github.com', 'google.com'];
const MAX_VISITED_URLS = 100;

// Simple window state tracker
const windows = new Map();

class WindowState {
  constructor(port) {
    this.port = port;
    this.urls = new Set();
  }

  addVisitedUrl(url) {
    if (this.urls.size >= MAX_VISITED_URLS) {
      const firstUrl = this.urls.values().next().value;
      this.urls.delete(firstUrl);
    }
    this.urls.add(url);
  }

  isUrlVisited(url) {
    return this.urls.has(url);
  }

  updateTab(tab) {
    if (!tab?.url) return;

    const wasVisited = this.isUrlVisited(tab.url);
    if (!wasVisited) {
      this.addVisitedUrl(tab.url);
    }

    this.port.postMessage({
      type: 'TAB_STATE_UPDATE',
      url: tab.url,
      title: tab.title || 'Untitled',
      isAllowed: isAllowedUrl(tab.url),
      wasVisited,
    });
  }
}

// Domain validation
function isAllowedUrl(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch (e) {
    console.error('[Background] URL parsing error:', e);
    return false;
  }
}

// Connect handler
chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name !== 'sidepanel') return;

  try {
    const window = await chrome.windows.getCurrent();
    const windowId = window.id;
    console.log('[Background] Panel connected:', windowId);

    const state = new WindowState(port);
    windows.set(windowId, state);

    // Send initial tab state immediately
    chrome.tabs.query({ active: true, windowId }, ([tab]) => {
      if (tab) state.updateTab(tab);
    });

    port.onDisconnect.addListener(() => {
      windows.delete(windowId);
      console.log('[Background] Panel disconnected:', windowId);
    });
  } catch (error) {
    console.error('[Background] Connection error:', error);
  }
});

// Tab event handlers
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  const state = windows.get(windowId);
  if (!state) return;

  chrome.tabs.get(tabId).then((tab) => state.updateTab(tab));
});

chrome.tabs.onUpdated.addListener((tabId, _, tab) => {
  const state = windows.get(tab.windowId);
  if (!state) return;

  state.updateTab(tab);
});

// Enable panel opening on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
