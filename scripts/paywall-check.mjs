/**
 * Vérifie qu'un chapitre verrouillé n'affiche ni son texte ni un écran vide :
 * on attend l'écran d'achat, avec le bouton de déblocage.
 *
 *   node scripts/paywall-check.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'bf-paywall-'));
const port = 4951;
const base = `http://127.0.0.1:${port}`;

const server = spawn('node', ['server/index.mjs'], {
  env: { ...process.env, DATA_DIR: dir, PORT: String(port), ADMIN_EMAIL: 'a@b.test', ADMIN_PASSWORD: 'PaywallTest123' },
  stdio: 'ignore',
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return true;
    } catch { /* pas prêt */ }
    await sleep(500);
  }
  return false;
}

const problems = [];

try {
  if (!(await waitForServer())) throw new Error('serveur non démarré');

  const list = await (await fetch(`${base}/api/books`)).json();
  const book = (list.books || []).find((b) => b.chaptersTotal > 12) || (list.books || [])[0];
  if (!book) throw new Error('aucun roman');

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  page.on('pageerror', (err) => problems.push(`exception: ${err.message.slice(0, 160)}`));

  const url = `${base}/lire/${book.slug}/12`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await sleep(700);

  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const locked = /débloqu|Débloqu|FCFA/.test(text);
  const boundary = await page.locator("text=Cette page n’a pas pu s’afficher").count();
  const blank = text.trim().length < 20;

  console.log(`chapitre verrouillé : ${url}`);
  console.log(`  texte affiché   : ${text.slice(0, 220)}`);
  console.log(`  écran de vente  : ${locked ? 'oui' : 'NON'}`);
  console.log(`  écran d'erreur  : ${boundary ? 'OUI' : 'non'}`);
  console.log(`  page vide       : ${blank ? 'OUI' : 'non'}`);

  if (!locked) problems.push('aucun écran de déblocage sur un chapitre verrouillé');
  if (boundary) problems.push('écran d’erreur sur un chapitre verrouillé');
  if (blank) problems.push('page vide sur un chapitre verrouillé');

  await page.screenshot({ path: '/tmp/bf-paywall.png' });
  await browser.close();
} catch (err) {
  problems.push(`fatal: ${err.message}`);
} finally {
  server.kill();
}

console.log(problems.length ? `\n${problems.length} problème(s) :\n- ${problems.join('\n- ')}` : '\nPaywall conforme.');
process.exit(problems.length ? 1 : 0);
