import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import './styles.css';

if (!__DESKTOP__ && 'serviceWorker' in navigator && import.meta.env.PROD) {
  // Registration failure only means "not ready offline"; the app still works online.
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
