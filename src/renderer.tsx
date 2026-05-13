import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './renderer/App';
import { NotesWindow } from './renderer/NotesWindow';
import './renderer/styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Garlic Sauce could not find the React root element.');
}

const isNotesWindow = new URLSearchParams(window.location.search).get('window') === 'notes';

createRoot(rootElement).render(
  <StrictMode>{isNotesWindow ? <NotesWindow /> : <App />}</StrictMode>,
);
