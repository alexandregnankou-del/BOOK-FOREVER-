import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir = mkdtempSync(path.join(tmpdir(), 'bf-shot-'));
const port = 4997;
const base = `http://127.0.0.1:${port}`;
const srv = spawn('node', ['server/index.mjs'], { env: { ...process.env, DATA_DIR: dir, PORT: String(port), ADMIN_EMAIL: 'a@b.test', ADMIN_PASSWORD: 'ShotTest12345' }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 40; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await sleep(400); }
const b = await chromium.launch({ args: ['--no-sandbox'] });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
const p = await c.newPage();
for (const [route, file] of [['/', 'home'], ['/bibliotheque', 'biblio'], ['/lire/light-in-the-dark/1', 'reader'], ['/auteurs', 'auteurs']]) {
  await p.goto(base + route, { waitUntil: 'networkidle' });
  await sleep(700);
  await p.screenshot({ path: `/tmp/bf-${file}.png` });
}
await b.close(); srv.kill();
console.log('captures ok');
