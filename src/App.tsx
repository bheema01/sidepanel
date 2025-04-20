/**
 * React application provides the UI for the side panel
 * 
 * Key responsibilities:
 * - Renders UI components
 * - Manages notes state
 * - Handles message events
 * - Shows connection status
 * 
 * @important: Uses environment variables for extension configuration
 */

import React, { useState, useEffect } from 'react';
import './styles.css';

interface Note {
  text: string;
  timestamp: string;
}

// Message type definitions for type safety
interface ExtensionMessage {
  type: 'TAB_STATE_UPDATE' | 'CONNECTION_STATE';
  isAllowed?: boolean;
  title?: string;
  wasVisited?: boolean;
  url?: string;
  connected?: boolean;
}

interface TabState {
  isAllowed: boolean;
  title: string;
  wasVisited: boolean;
}

// Remove redundant extension state since we have EXTENSION_ID
interface ExtensionState {
  connected: boolean;
}

const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID;
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;

// Add debug logging for extension ID
console.log('[React] Using Extension ID:', EXTENSION_ID);
console.log('[React] Expected Origin:', EXTENSION_ORIGIN);

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAllowed, setIsAllowed] = useState(true);
  const [pageTitle, setPageTitle] = useState('Loading...');
  const [wasVisited, setWasVisited] = useState(false);
  const [showReloadIndicator, setShowReloadIndicator] = useState(false);
  const [extensionState, setExtensionState] = useState<ExtensionState>({
    connected: false
  });

  // Add debounced state updates
  const debouncedSetState = (updates: Partial<TabState>) => {
    requestAnimationFrame(() => {
      Object.entries(updates).forEach(([key, value]) => {
        switch(key) {
          case 'isAllowed':
            setIsAllowed(value as boolean);
            break;
          case 'title':
            setPageTitle(value as string);
            break;
          case 'wasVisited':
            setWasVisited(value as boolean);
            break;
        }
      });
    });
  };

  // Separate effect for message handling without notes dependency
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      // Add debug logging
      console.log('[React] Message received:', {
        type: event.data?.type,
        origin: event.origin,
        expectedOrigin: EXTENSION_ORIGIN,
        data: event.data
      });

      if (event.origin !== EXTENSION_ORIGIN) {
        console.warn('[React] Ignoring message from unauthorized origin:', 
          `${event.origin} !== ${EXTENSION_ORIGIN}`);
        return;
      }

      switch (event.data?.type) {
        case 'TAB_STATE_UPDATE':
          const { isAllowed, title, wasVisited } = event.data;
          debouncedSetState({ isAllowed, title, wasVisited });
          
          if (!wasVisited) {
            setShowReloadIndicator(true);
            setTimeout(() => setShowReloadIndicator(false), 2000);
          }
          break;

        case 'CONNECTION_STATE':
          console.log('[React] Connection state update:', event.data.connected);
          setExtensionState(prev => ({
            ...prev,
            connected: Boolean(event.data.connected)
          }));
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Separate effect for notes state changes
  useEffect(() => {
    if (notes.length > 0) {
      window.parent.postMessage(
        { type: 'NOTES_STATE_UPDATE', hasNotes: true },
        EXTENSION_ORIGIN
      );
    }
  }, [notes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      const note: Note = {
        text: inputText,
        timestamp: new Date().toLocaleString(),
      };

      setNotes((prev) => [note, ...prev]);
      window.parent.postMessage(
        { type: 'NOTE_ADDED', payload: note }, 
        EXTENSION_ORIGIN
      );
      setInputText('');
    }
  };

  // Add connection status indicator
  const ConnectionStatus = () => (
    <div className="connection-status">
      {extensionState.connected ? (
        <span className="status-connected">🟢 Connected</span>
      ) : (
        <span className="status-disconnected">🔴 Disconnected</span>
      )}
    </div>
  );

  if (!isAllowed) {
    return (
      <div className='container'>
        <div className='error-container'>
          <h2 className='error-title'>Unauthorized Domain</h2>
          <p className='error-message'>
            This extension is not supported on this page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='container'>
      <ConnectionStatus />
      {showReloadIndicator && (
        <div className='reload-indicator'>App reloaded</div>
      )}
      <h1 className='page-title'>
        {pageTitle}
        {wasVisited && (
          <span className='visited-badge'>Previously Visited</span>
        )}
      </h1>

      <form onSubmit={handleSubmit}>
        <input
          type='text'
          className='note-input'
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder='Add a note about this page...'
        />
      </form>

      {notes.length > 0 && (
        <div className='notes-container'>
          {notes.map((note, index) => (
            <div key={index} className='note'>
              <p className='note-text'>{note.text}</p>
              <span className='note-timestamp'>{note.timestamp}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
