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
let port = null;

/**
 * Manages port connection
 */
function connect() {
  port = chrome.runtime.connect({ name: 'sidepanel' });
  
  port.onMessage.addListener((message) => {
    iframe.contentWindow.postMessage(message, IFRAME_URL.origin);
  });
  
  port.onDisconnect.addListener(() => {
    port = null;
    iframe.contentWindow.postMessage({ type: 'DISCONNECTED' }, IFRAME_URL.origin);
  });
}

// Connect when iframe loads
iframe.addEventListener('load', connect);

// Reconnect on visibility change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !port) {
    connect();
  }
});
