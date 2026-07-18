import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register service worker for PWA offline support
const setupPWA = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // @ts-ignore
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({ immediate: true });
    } catch (e) {
      console.error('Failed to register service worker', e);
    }
  }
};
setupPWA();

createRoot(document.getElementById('root')!).render(
  
    <App />
  ,
);
