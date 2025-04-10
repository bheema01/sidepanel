import React, { useState, useEffect } from 'react';
import './styles.css';

interface Note {
  text: string;
  timestamp: string;
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAllowed, setIsAllowed] = useState(true);
  const [pageTitle, setPageTitle] = useState('Loading...');
  const [showReloadIndicator, setShowReloadIndicator] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TAB_STATE_UPDATE') {
        const { isAllowed, title } = event.data;
        setIsAllowed(Boolean(isAllowed));
        setPageTitle(title || 'Untitled');
        
        // Show reload indicator only when there are no notes
        if (notes.length === 0) {
          setShowReloadIndicator(true);
          // Hide indicator after 2 seconds
          setTimeout(() => setShowReloadIndicator(false), 2000);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [notes]);

  useEffect(() => {
    window.parent.postMessage(
      { type: 'NOTES_STATE_UPDATE', hasNotes: notes.length > 0 },
      '*'
    );
  }, [notes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      const note: Note = {
        text: inputText,
        timestamp: new Date().toLocaleString()
      };

      setNotes(prev => [note, ...prev]);
      window.parent.postMessage({ type: 'NOTE_ADDED', payload: note }, '*');
      setInputText('');
    }
  };

  if (!isAllowed) {
    return (
      <div className="container">
        <div className="error-container">
          <h2 className="error-title">Unauthorized Domain</h2>
          <p className="error-message">
            This extension is not supported on this page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {showReloadIndicator && (
        <div className="reload-indicator">
          App reloaded
        </div>
      )}
      <h1 className="page-title">{pageTitle}</h1>
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          className="note-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Add a note about this page..."
        />
      </form>

      {notes.length > 0 && (
        <div className="notes-container">
          {notes.map((note, index) => (
            <div key={index} className="note">
              <p className="note-text">{note.text}</p>
              <span className="note-timestamp">{note.timestamp}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
