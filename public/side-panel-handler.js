// Logging utility
const log = {
  info: (message, data) => console.log(`[SidePanel] 📘 ${message}`, data || ''),
  warn: (message, data) =>
    console.warn(`[SidePanel] ⚠️ ${message}`, data || ''),
  error: (message, data) =>
    console.error(`[SidePanel] 🔴 ${message}`, data || ''),
};

const iframe = document.getElementById('app-frame');
const IFRAME_URL = 'http://localhost:5176';

// Initialize iframe
iframe.src = IFRAME_URL;

// Panel ready notification
iframe.addEventListener('load', () => {
  console.log('[SidePanel] Iframe loaded');
  chrome.runtime.sendMessage({ type: 'PANEL_READY' });
});

// Message handling
function forwardToIframe(message) {
  if (!iframe?.contentWindow) return;
  
  iframe.contentWindow.postMessage({
    type: 'TAB_STATE_UPDATE',
    isAllowed: Boolean(message.isAllowed),
    url: message.url,
    title: message.title || 'Untitled',
    wasVisited: message.wasVisited
  }, '*');
}

// Event listeners
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TAB_STATE_UPDATE') {
    forwardToIframe(message);
  }
  return true;
});
