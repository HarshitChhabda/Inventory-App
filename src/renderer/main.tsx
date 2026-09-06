import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/animations.css';

// Global error handlers for renderer process
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Renderer Error]', { message, source, lineno, colno, error });
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Renderer Unhandled Rejection]', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
