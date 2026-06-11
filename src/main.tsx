import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handler — catches renderer crashes and shows them instead of black screen
window.onerror = (msg, src, line, col, err) => {
  document.body.style.background = '#0a0a0f';
  document.body.style.color = '#ef4444';
  document.body.style.fontFamily = 'monospace';
  document.body.style.padding = '32px';
  document.body.innerHTML = `
    <h2 style="color:#ef4444">Spine Guardian — Startup Error</h2>
    <p style="color:#fca5a5">${msg}</p>
    <p style="color:rgba(255,255,255,0.4);font-size:12px">${src}:${line}:${col}</p>
    <pre style="color:rgba(255,255,255,0.5);font-size:11px;margin-top:16px">${err?.stack ?? ''}</pre>
  `;
  return true;
};

window.onunhandledrejection = (e) => {
  document.body.style.background = '#0a0a0f';
  document.body.style.color = '#ef4444';
  document.body.style.fontFamily = 'monospace';
  document.body.style.padding = '32px';
  document.body.innerHTML = `
    <h2 style="color:#ef4444">Spine Guardian — Unhandled Promise Error</h2>
    <pre style="color:#fca5a5;font-size:12px">${e.reason?.stack ?? String(e.reason)}</pre>
  `;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
