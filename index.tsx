import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializePreloader } from './utils/preloader';
import { initWebVitalsMonitoring, optimizeResourceLoading } from './utils/performance';
import { PUSH_NOTIFICATIONS_ENABLED } from './constants';
import { initialLocaleReady, reloadOnceForStaleChunks, isLocaleChunkError } from './contexts/i18nContext';

// Tras un despliegue, una pestana abierta de antes pide chunks (paginas) con
// hashes que ya no existen. Vite avisa con vite:preloadError: se recarga una vez
// para traer el index.html nuevo. Si ya se recargo hace poco, el error sigue su
// curso (ErrorBoundary) en vez de entrar en bucle. Los chunks de idioma no: los
// gestiona i18nContext (reintento, recarga unica y aviso traducido).
window.addEventListener('vite:preloadError', (event) => {
  if (isLocaleChunkError((event as any).payload)) return;
  if (reloadOnceForStaleChunks()) event.preventDefault();
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Initialize performance optimizations
try {
  initializePreloader();
  initWebVitalsMonitoring();
  optimizeResourceLoading();
} catch (error) {
  console.warn('Performance initialization failed:', error);
}

// Los textos de cada idioma se descargan aparte (contexts/i18nContext.tsx).
// Se espera al del idioma inicial antes de pintar: mientras tanto sigue el
// "Cargando..." de index.html, en vez de pintar en espanol y cambiar de golpe.
// En espanol ya esta resuelto y no retrasa nada.
const root = ReactDOM.createRoot(rootElement);
initialLocaleReady().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

// Register Service Worker for Push Notifications
if (PUSH_NOTIFICATIONS_ENABLED && 'serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered:', registration);
      })
      .catch(registrationError => {
        console.log('Service Worker registration failed: ', registrationError);
      });
  });
}
