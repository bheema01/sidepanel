// Logging utility
const log = {
  info: (message, data) => console.log(`[SidePanel] 📘 ${message}`, data || ''),
  warn: (message, data) => console.warn(`[SidePanel] ⚠️ ${message}`, data || ''),
  error: (message, data) => console.error(`[SidePanel] 🔴 ${message}`, data || '')
};

const iframe = document.getElementById('app-frame');
let isFirstLoad = true;
let hasNotes = false;

// Listen for messages from iframe
window.addEventListener('message', (event) => {
  if (event.data?.type === 'NOTES_STATE_UPDATE') {
    hasNotes = event.data.hasNotes;
    log.info('Notes state updated', { hasNotes });
  }
});

// Function to handle tab update
function handleTabUpdate(message) {
  if (!iframe?.contentWindow) {
    log.error('Iframe or contentWindow not found');
    return;
  }

  // For first load, set iframe source
  if (isFirstLoad) {
    log.info('First load, setting iframe source');
    iframe.src = 'http://localhost:5176';
    isFirstLoad = false;
    return;
  }

  // For subsequent updates, use postMessage
  log.info('Forwarding tab update', message);
  iframe.contentWindow.postMessage({
    type: 'TAB_STATE_UPDATE',
    isAllowed: Boolean(message.isAllowed),
    url: message.url,
    title: message.title || 'Untitled'
  }, '*');
}

// Listen for state updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log.info('Received message from background', { message, sender });
  
  if (message.type === 'TAB_STATE_UPDATE') {
    handleTabUpdate(message);
  }
  
  sendResponse({ received: true });
  return true;
});

// When iframe loads
iframe.addEventListener('load', async () => {
  log.info('Iframe loaded');
  
  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      handleTabUpdate({
        type: 'TAB_STATE_UPDATE',
        isAllowed: true, // This will be checked by background script
        url: tab.url,
        title: tab.title || 'Untitled'
      });
    }
  } catch (error) {
    log.error('Failed to get initial tab state', { error });
  }
});
