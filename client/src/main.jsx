import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);

/* Mise à jour de l'application : on prévient, on ne recharge jamais d'office.
   Recharger de force ferait perdre la position de lecture. */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });

  let prompted = false;
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (prompted) return;
    prompted = true;
    const bar = document.createElement('div');
    bar.setAttribute('role', 'status');
    bar.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:9999;' +
      'display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:14px;' +
      'background:#14110E;color:#F5EFE6;font:14px system-ui,sans-serif;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.35);border:1px solid rgba(201,162,39,.35)';
    bar.innerHTML =
      '<span>Nouvelle version disponible.</span>' +
      '<button style="border:0;border-radius:999px;padding:8px 14px;background:#C9A227;color:#14110E;font-weight:600">Recharger</button>';
    bar.querySelector('button').addEventListener('click', () => location.reload());
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 12000);
  });
}
