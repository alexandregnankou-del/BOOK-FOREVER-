/**
 * Parcours réel des pages dans Chromium : détecte les erreurs de rendu, les
 * ressources manquantes et les écrans vides. À lancer après `npm run build`.
 *
 *   node scripts/browser-check.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'bf-browser-'));
const port = 4950;
const base = `http://127.0.0.1:${port}`;

const server = spawn('node', ['server/index.mjs'], {
  env: { ...process.env, DATA_DIR: dir, PORT: String(port), ADMIN_EMAIL: 'admin@browser.test', ADMIN_PASSWORD: 'BrowserTest123' },
  stdio: 'ignore',
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(500);
  }
  return false;
}

const ROUTES = [
  '/', '/bibliotheque', '/auteurs', '/a-propos', '/telecharger', '/compte',
  '/connexion', '/inscription', '/contact', '/regles', '/ecrire', '/conditions',
  '/confidentialite', '/installer',
];

const problems = [];

try {
  if (!(await waitForServer())) throw new Error('serveur non démarré');

  /* Une fiche + un chapitre pour chaque roman : c'est là que les objets
     (catégorie, auteur) se glissent dans le rendu React. */
  try {
    const list = await (await fetch(`${base}/api/books`)).json();
    for (const b of list.books || []) {
      ROUTES.push(`/roman/${b.slug}`);
      ROUTES.push(`/lire/${b.slug}/1`);
      /* Chapitre verrouillé : c'est le chemin du paywall, à vérifier aussi. */
      ROUTES.push(`/lire/${b.slug}/12`);
    }
  } catch (err) {
    problems.push(`liste des romans: ${err.message}`);
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    /* 402/404 volontaires (chapitre verrouillé ou inexistant) : bruit réseau. */
    if (msg.type() === 'error' && !/Failed to load resource/.test(text)) {
      problems.push(`console: ${text.slice(0, 200)}`);
    }
  });
  page.on('pageerror', (err) => problems.push(`exception: ${String(err.message).slice(0, 200)}`));
  page.on('requestfailed', (req) => problems.push(`requête échouée: ${req.url()} (${req.failure()?.errorText})`));

  for (const route of ROUTES) {
    const before = problems.length;
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await sleep(400);
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 90);
    const blank = text.trim().length < 20;
    const boundary = await page.locator('[data-bf-boundary]').count();
    const state = blank ? 'VIDE' : boundary ? 'ERREUR' : 'ok';
    console.log(`${state.padEnd(6)} ${route.padEnd(15)} ${text.slice(0, 60)}`);
    if (state !== 'ok') problems.push(`${route} → ${state}`);
    if (problems.length > before) console.log(`       ↳ ${problems.slice(before).join(' | ')}`);
  }

  /* Connexion + console d'administration */
  await page.goto(`${base}/connexion`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@browser.test');
  await page.fill('input[type="password"]', 'BrowserTest123');
  await page.click('button[type="submit"]');
  await sleep(1500);
  await page.goto(`${base}/console`, { waitUntil: 'networkidle' });
  await sleep(800);
  const consoleText = (await page.locator('body').innerText()).slice(0, 80).replace(/\s+/g, ' ');
  console.log(`console admin: ${consoleText}`);

  await page.screenshot({ path: '/tmp/bf-console.png', fullPage: false });
  await browser.close();
} catch (err) {
  problems.push(`fatal: ${err.message}`);
} finally {
  server.kill();
}

console.log(problems.length ? `\n${problems.length} problème(s) :\n- ${problems.join('\n- ')}` : '\nAucun problème détecté.');
process.exit(problems.length ? 1 : 0);
