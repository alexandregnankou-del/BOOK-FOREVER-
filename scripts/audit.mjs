/**
 * Audit complet du site : rendu, liens morts, images cassées, débordements,
 * titres manquants. À lancer après `npm run build`.
 *
 *   node scripts/audit.mjs [url-de-base]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const external = process.argv[2];
const dir = mkdtempSync(path.join(tmpdir(), 'bf-audit-'));
const port = 4960;
const base = external || `http://127.0.0.1:${port}`;

let server = null;
if (!external) {
  server = spawn('node', ['server/index.mjs'], {
    env: { ...process.env, DATA_DIR: dir, PORT: String(port), ADMIN_EMAIL: 'audit@book.test', ADMIN_PASSWORD: 'AuditTest123' },
    stdio: 'ignore',
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return true;
    } catch { /* pas prêt */ }
    await sleep(500);
  }
  return false;
}

const problems = [];
const report = [];

try {
  if (!(await waitForServer())) throw new Error('serveur injoignable');

  const list = await (await fetch(`${base}/api/books`)).json();
  const books = list.books || [];

  const routes = [
    '/', '/bibliotheque', '/auteurs', '/a-propos', '/telecharger', '/installer',
    '/compte', '/connexion', '/inscription', '/contact', '/regles', '/ecrire',
    '/conditions', '/confidentialite',
    ...books.flatMap((b) => [`/roman/${b.slug}`, `/lire/${b.slug}/1`, `/lire/${b.slug}/12`]),
  ];

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();

  let current = '/';
  page.on('pageerror', (err) => problems.push(`[JS] ${current} : ${err.message.slice(0, 140)}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource/.test(t)) problems.push(`[console] ${current} : ${t.slice(0, 140)}`);
  });
  page.on('response', (r) => {
    const u = r.url();
    if (r.status() >= 400 && !u.includes('/api/') && !/\.map$/.test(u)) {
      problems.push(`[HTTP ${r.status()}] ${current} → ${u.replace(base, '')}`);
    }
  });

  const seenLinks = new Map();

  for (const route of routes) {
    current = route;
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => problems.push(`[nav] ${route} : ${e.message.slice(0, 80)}`));
    await sleep(350);

    const info = await page.evaluate(() => {
      const body = document.body;
      const boundary = Boolean(document.querySelector('[data-bf-boundary]'));
      const text = (body.innerText || '').replace(/\s+/g, ' ').trim();
      const imgs = [...document.querySelectorAll('img')].map((i) => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0, alt: i.hasAttribute('alt') }));
      const links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
      const h1 = document.querySelectorAll('h1').length;
      return { text, imgs, links, h1, boundary, overflow: document.documentElement.scrollWidth - window.innerWidth };
    });

    const blank = info.text.length < 20;
    const state = info.boundary ? 'ERREUR' : blank ? 'VIDE' : 'ok';
    const flags = [];
    if (info.h1 !== 1) flags.push(`h1=${info.h1}`);
    if (info.overflow > 2) flags.push(`débordement ${info.overflow}px`);
    const brokenImgs = info.imgs.filter((i) => !i.ok);
    if (brokenImgs.length) flags.push(`${brokenImgs.length} image(s) cassée(s)`);
    const noAlt = info.imgs.filter((i) => !i.alt).length;
    if (noAlt) flags.push(`${noAlt} image(s) sans alt`);

    report.push({ route, state, flags: flags.join(', '), text: info.text.slice(0, 60) });
    if (state !== 'ok') { problems.push(`[${state}] ${route}`); console.log(`\n--- ${route} ---\n${info.text.slice(0, 400)}\n`); }
    for (const img of brokenImgs) problems.push(`[image] ${route} → ${img.src.replace(base, '')}`);
    for (const l of info.links) if (l && l.startsWith('/')) seenLinks.set(l.split('#')[0], route);
  }

  /* Vérification des liens internes uniques (statut HTTP). */
  const uniqueLinks = [...seenLinks.keys()].filter((l) => l !== '/' && !/\.(apk|zip)$/.test(l));
  for (const link of uniqueLinks) {
    const res = await fetch(base + link, { redirect: 'manual' }).catch(() => null);
    if (!res) { problems.push(`[lien] ${link} injoignable`); continue; }
    if (res.status >= 400 && !/^\/api\//.test(link)) problems.push(`[lien ${res.status}] ${link} (vu sur ${seenLinks.get(link)})`);
  }

  console.log('\n=== PAGES ===');
  for (const r of report) console.log(`${r.state.padEnd(7)} ${r.route.padEnd(34)} ${r.flags}`);
  console.log(`\n=== LIENS INTERNES VÉRIFIÉS : ${uniqueLinks.length} ===`);

  await page.screenshot({ path: '/tmp/bf-audit-home.png' });
  await browser.close();
} catch (err) {
  problems.push(`fatal: ${err.message}`);
} finally {
  if (server) server.kill();
}

console.log(problems.length ? `\n${problems.length} PROBLÈME(S) :\n- ${problems.join('\n- ')}` : '\nAucun problème détecté.');
process.exit(problems.length ? 1 : 0);
