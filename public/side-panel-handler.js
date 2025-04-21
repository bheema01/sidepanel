/**
 * Side Panel Handler acts as a bridge between background script and React app
 * 
 * Key responsibilities:
 * - Manages iframe loading and communication
 * - Handles port connection/reconnection
 * - Forwards messages between components
 * - Maintains connection state
 */

const iframe = document.getElementById('app-frame');
const IFRAME_URL = new URL('http://localhost:5176');
// Add extension ID to URL
IFRAME_URL.searchParams.set('extensionId', chrome.runtime.id);

// Initialize iframe with complete URL
iframe.src = IFRAME_URL.toString();

// Configure reconnection behavior
const RECONNECT_DELAY = 1000; // Base delay (1 second)
const MAX_RECONNECT_ATTEMPTS = 3;
const MIN_RECONNECT_INTERVAL = 2000; // Minimum time between attempts

// Add connection state management
let port = null;
let reconnectTimer = null;

// Add timestamp tracking
let lastReconnectAttempt = 0;

/**
 * Sends connection state to iframe
 * @param {boolean} isConnected - Connection state
 */
function sendConnectionState(isConnected) {
  if (!iframe?.contentWindow) return;
  
  console.log('[SidePanel] 📘 Sending connection state:', isConnected);
  iframe.contentWindow.postMessage(
    { type: 'CONNECTION_STATE', connected: isConnected },
    IFRAME_URL.origin
  );
}

/**
 * Manages port connection with retry logic
 * @param {number} attempt - Current connection attempt number
 */
function connect(attempt = 1) {
  // Clear existing timer first
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const now = Date.now();
  if (now - lastReconnectAttempt < MIN_RECONNECT_INTERVAL) {
    console.warn('[SidePanel] ⚠️ Reconnection attempted too soon, skipping');
    return;
  }
  lastReconnectAttempt = now;

  try {
    port = chrome.runtime.connect({ name: 'sidepanel' });
    console.log('[SidePanel] 📘 Port connected');

    // Send connection state immediately
    sendConnectionState(true);

    port.onMessage.addListener((message) => {
      if (message.type === 'TAB_STATE_UPDATE') {
        forwardToIframe(message);
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
      console.warn('[SidePanel] ⚠️ Port disconnected');
      
      // Send disconnection state
      sendConnectionState(false);

      // Clear any existing reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      // Attempt reconnection with exponential backoff
      reconnectTimer = setTimeout(() => {
        console.log(`[SidePanel] 📘 Attempting reconnection ${attempt}/${MAX_RECONNECT_ATTEMPTS}`);
        connect(attempt + 1);
      }, RECONNECT_DELAY * attempt);
    });

    // Send initial ready message
    port.postMessage({ type: 'PANEL_READY' });
  } catch (error) {
    console.error('[SidePanel] 🔴 Connection failed:', error);
    sendConnectionState(false);
  }
}

// Initialize connection when needed
iframe.addEventListener('load', () => {
  console.log('[SidePanel] 📘 Iframe loaded');
  connect();
  
  // Double-check connection state after frame is ready
  setTimeout(() => {
    sendConnectionState(Boolean(port));
  }, 100);
});

// Update visibility change handler to reset reconnection
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && !port) {
    console.log('[SidePanel] 📘 Panel visible, reconnecting...');
    connect(1);
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);

window.addEventListener('unload', () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  if (port) {
    port.disconnect();
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

/**
 * Forwards messages to iframe
 * @param {Object} message - Message object containing tab state
 */
function forwardToIframe(message) {
  if (!iframe?.contentWindow) return;

  iframe.contentWindow.postMessage(
    {
      type: 'TAB_STATE_UPDATE',
      isAllowed: Boolean(message.isAllowed),
      url: message.url,
      title: message.title || 'Untitled',
      wasVisited: message.wasVisited,
    },
    IFRAME_URL.origin // Use specific origin instead of '*'
  );
}
