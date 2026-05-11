import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './renderer/App';
import './renderer/styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Garlic Sauce could not find the React root element.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
