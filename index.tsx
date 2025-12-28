import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializePreloader } from './utils/preloader';
import { initWebVitalsMonitoring, optimizeResourceLoading } from './utils/performance';

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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for Push Notifications
if ('serviceWorker' in navigator && 'PushManager' in window) {
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
