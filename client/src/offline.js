/* File d'attente des achats déclarés sans réseau.
   Un lecteur en zone blanche garde sa demande : elle part dès le retour du réseau,
   jamais en double (chaque entrée porte une clé unique). */

import { api } from './api.js';

const KEY = 'bf.orders.queue';
const MAX = 20;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX)));
  } catch {
    /* stockage plein : on ne bloque pas la lecture */
  }
}

export function pendingOrders() {
  return read();
}

export function queueOrder(order) {
  const items = read();
  const key = `${order.bookSlug}:${order.chapterNumber}`;
  if (items.some((item) => `${item.bookSlug}:${item.chapterNumber}` === key)) return;
  items.push({ ...order, at: Date.now() });
  write(items);
}

/** Une erreur de réseau n'a pas de code HTTP ; une erreur métier en a un. */
export function isNetworkFailure(error) {
  return !error || typeof error.status !== 'number';
}

/** Envoie la file. Renvoie { sent, waiting }. */
export async function flushOrders() {
  const items = read();
  if (!items.length) return { sent: 0, waiting: 0 };
  const remaining = [];
  let sent = 0;
  for (const item of items) {
    try {
      await api.buy({
        bookSlug: item.bookSlug,
        chapterNumber: item.chapterNumber,
        method: item.method,
      });
      sent += 1;
    } catch (error) {
      // 4xx : la demande a déjà été traitée ou n'est plus valable, inutile d'insister.
      if (!isNetworkFailure(error)) continue;
      remaining.push(item);
    }
  }
  write(remaining);
  return { sent, waiting: remaining.length };
}

export function notify(message) {
  const bar = document.createElement('div');
  bar.setAttribute('role', 'status');
  bar.style.cssText =
    'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:9999;' +
    'padding:12px 18px;border-radius:14px;background:#14110E;color:#F5EFE6;' +
    'font:14px system-ui,sans-serif;border:1px solid rgba(201,162,39,.4);' +
    'box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:88vw;text-align:center';
  bar.textContent = message;
  document.body.appendChild(bar);
  setTimeout(() => bar.remove(), 6000);
}

/** À appeler une fois au démarrage : rejoue ce qui attendait le réseau. */
export function watchConnectivity() {
  const run = async () => {
    if (!navigator.onLine) return;
    const { sent } = await flushOrders();
    if (sent > 0) {
      notify(
        sent === 1
          ? 'Votre paiement en attente a été transmis.'
          : `${sent} paiements en attente ont été transmis.`,
      );
    }
  };
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) run();
  });
  run();
}
