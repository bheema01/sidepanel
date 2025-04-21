/**
 * Background script manages core extension state and tab tracking
 * 
 * Key responsibilities:
 * - Maintains visited tabs history
 * - Handles allowed domains
 * - Manages port connections
 * - Processes tab events
 * 
 * @important: Service worker may restart after periods of inactivity
 */

// Logging utility removed, using console directly
console.log('[Background] Starting service worker...');

// Configurable domain whitelist
const ALLOWED_DOMAINS = ['localhost', 'github.com', 'google.com'];

// Prevent memory leaks by limiting visited tabs
const MAX_VISITED_TABS = 100;
const visitedTabs = new Set();

/**
 * Adds URL to visited set with size limit enforcement
 * @param {string} url - URL to track
 */
function addVisitedUrl(url) {
  if (visitedTabs.size >= MAX_VISITED_TABS) {
    // Remove oldest entry (first item in set)
    visitedTabs.delete(visitedTabs.values().next().value);
  }
  visitedTabs.add(url);
}

// Add port management
let port = null;

// Core functionality
/**
 * Checks if a URL is allowed based on the domain whitelist
 * @param {string} url - URL to validate
 * @returns {boolean} - True if URL is allowed, false otherwise
 */
function isAllowedUrl(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'localhost' || 
           ALLOWED_DOMAINS.some(domain => 
             hostname === domain || hostname.endsWith('.' + domain)
           );
  } catch (e) {
    console.error('[Background] URL parsing error:', e);
    return false;
  }
}

// State management
let isPanelReady = false;

// Message handling
/**
 * Sends tab state to the connected port
 * @param {object} tab - Tab object containing URL and title
 * @param {boolean} wasVisited - Indicates if the tab was previously visited
 */
function sendTabState(tab, wasVisited = false) {
  if (!isPanelReady || !port) return;
  
  try {
    port.postMessage({
      type: 'TAB_STATE_UPDATE',
      isAllowed: isAllowedUrl(tab.url),
      url: tab.url,
      title: tab.title || 'Untitled',
      wasVisited
    });
  } catch (error) {
    console.error('[Background] Send error:', error);
    isPanelReady = false; // Reset on error
  }
}

// Handle port connections
chrome.runtime.onConnect.addListener((connectionPort) => {
  port = connectionPort;
  console.log('[Background] Port connected');
  
  port.onMessage.addListener((message) => {
    if (message.type === 'PANEL_READY') {
      isPanelReady = true;
      chrome.tabs.query({ active: true, currentWindow: true })
        .then(([tab]) => tab && sendTabState(tab));
    }
  });

  port.onDisconnect.addListener(() => {
    port = null;
    isPanelReady = false;
    console.warn('[Background] Port disconnected');
  });
});

// Event Listeners
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isPanelReady) {
    const wasVisited = visitedTabs.has(tab.url);
    if (!wasVisited) addVisitedUrl(tab.url);
    sendTabState(tab, wasVisited);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const wasVisited = visitedTabs.has(tab.url);
    if (!wasVisited) addVisitedUrl(tab.url);
    sendTabState(tab, wasVisited);
  } catch (error) {
    console.error('[Background] Tab activation error:', error);
  }
});

// Add tab removal handler
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    // Get all open tabs to compare against
    const tabs = await chrome.tabs.query({});
    const openUrls = new Set(tabs.map(tab => tab.url));

    // Remove URLs that are no longer open in any tab
    for (const url of visitedTabs) {
      if (!openUrls.has(url)) {
        visitedTabs.delete(url);
        console.log('[Background] Removed visited URL:', url);
      }
    }
  } catch (error) {
    console.error('[Background] Tab removal cleanup error:', error);
  }
});

// Panel management
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });

chrome.sidePanel?.onChanged?.addListener(({ enabled }) => {
  if (!enabled) {
    visitedTabs.clear();
    isPanelReady = false;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PANEL_READY') {
    isPanelReady = true;
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => tab && sendTabState(tab));
  }
  return true;
});
