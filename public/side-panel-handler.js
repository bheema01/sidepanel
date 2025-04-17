// Logging utility
const log = {
  info: (message, data) => console.log(`[SidePanel] 📘 ${message}`, data || ''),
  warn: (message, data) => console.warn(`[SidePanel] ⚠️ ${message}`, data || ''),
  error: (message, data) => console.error(`[SidePanel] 🔴 ${message}`, data || '')
};

const iframe = document.getElementById('app-frame');
const IFRAME_URL = 'http://localhost:5176';

// Set iframe source immediately
iframe.src = IFRAME_URL;

// Send ready message when iframe loads
iframe.addEventListener('load', () => {
  log.info('Iframe loaded, sending PANEL_READY');
  chrome.runtime.sendMessage({ type: 'PANEL_READY' }, (response) => {
    if (chrome.runtime.lastError) {
      log.error('Failed to send PANEL_READY:', chrome.runtime.lastError);
    } else {
      log.info('PANEL_READY acknowledged:', response);
    }
  });
});

// Listen for messages from React app
window.addEventListener('message', (event) => {
  if (event.data?.type === 'NOTES_STATE_UPDATE') {
    log.info('Notes state updated:', event.data);
  }
});

// Handle tab updates
function handleTabUpdate(message) {
  if (!iframe?.contentWindow) {
    log.error('Iframe or contentWindow not found');
    return;
  }

  // Add debug logging for visit status
  log.info('Tab visit status:', {
    url: message.url,
    wasVisited: message.wasVisited ? '✅ Yes' : '❌ No',
    visitCount: message.visitCount
  });

  log.info('Forwarding tab update:', message);
  iframe.contentWindow.postMessage({
    type: 'TAB_STATE_UPDATE',
    isAllowed: Boolean(message.isAllowed),
    url: message.url,
    title: message.title || 'Untitled',
    wasVisited: message.wasVisited,
    visitCount: message.visitCount
  }, '*');
}

// Listen for state updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TAB_STATE_UPDATE') {
    handleTabUpdate(message);
  }
  sendResponse({ received: true });
  return true;
});
