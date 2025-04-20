// Logging utility removed, using console directly
console.log('[Background] Starting service worker...');

// Track allowed domains
const ALLOWED_DOMAINS = ['localhost', 'github.com', 'google.com'];

// State management
let isPanelReady = false;
const visitedTabs = new Set();

// Core functionality
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

// Message handling
function sendTabState(tab, wasVisited = false) {
  if (!isPanelReady) return;
  
  chrome.runtime.sendMessage({
    type: 'TAB_STATE_UPDATE',
    isAllowed: isAllowedUrl(tab.url),
    url: tab.url,
    title: tab.title || 'Untitled',
    wasVisited
  }).catch(err => console.error('[Background] Send error:', err));
}

// Event Listeners
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isPanelReady) {
    const wasVisited = visitedTabs.has(tab.url);
    if (!wasVisited) visitedTabs.add(tab.url);
    sendTabState(tab, wasVisited);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const wasVisited = visitedTabs.has(tab.url);
    if (!wasVisited) visitedTabs.add(tab.url);
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
