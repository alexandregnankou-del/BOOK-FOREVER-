/**
 * Vérifie que les clips promotionnels sont réellement servis et lus.
 *   node scripts/video-check.mjs [url-de-base]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const external = process.argv[2];
const dir = mkdtempSync(path.join(tmpdir(), 'bf-video-'));
const port = 4971;
const base = external || `http://127.0.0.1:${port}`;

let server = null;
if (!external) {
  server = spawn('node', ['server/index.mjs'], {
    env: { ...process.env, DATA_DIR: dir, PORT: String(port), ADMIN_EMAIL: 'v@book.test', ADMIN_PASSWORD: 'VideoTest123' },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 2500));
}

const fail = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => {
  fail.push(msg);
  console.log(`  ✗ ${msg}`);
};

/* ---- 1. HTTP : types, cache, et surtout les requêtes Range ---- */
for (const [label, url] of [
  ['accueil', '/'],
  ['page vidéos', '/videos'],
  ['sitemap', '/sitemap.xml'],
]) {
  const res = await fetch(base + url);
  if (res.status === 200) ok(`${label} → 200`);
  else bad(`${label} → ${res.status}`);
}
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
if (sitemap.includes('/videos')) ok('sitemap contient /videos');
else bad('sitemap sans /videos');

const range = await fetch(`${base}/media/videos/pour-une-femme-que-j-aime.mp4`, {
  headers: { Range: 'bytes=0-1023' },
});
const rangeType = range.headers.get('content-type');
const rangeStatus = range.status;
const rangeLength = (await range.arrayBuffer()).byteLength;
if (rangeStatus === 206 && rangeLength === 1024) ok(`Range → 206 (${rangeLength} octets)`);
else bad(`Range → ${rangeStatus}, ${rangeLength} octets`);
if (rangeType === 'video/mp4') ok('type video/mp4');
else bad(`type ${rangeType}`);

const full = await fetch(`${base}/media/videos/light-in-the-dark.mp4`, { method: 'HEAD' });
if (full.headers.get('accept-ranges') === 'bytes') ok('Accept-Ranges annoncé');
else bad('Accept-Ranges absent');

for (const name of [
  'pour-une-femme-que-j-aime',
  'les-larmes-d-une-plume',
  'light-in-the-dark',
  'si-je-t-aimais-au-present',
  'chaine-whatsapp',
]) {
  const v = await fetch(`${base}/media/videos/${name}.mp4`, { method: 'HEAD' });
  const p = await fetch(`${base}/media/videos/poster-${name}.jpg`, { method: 'HEAD' });
  if (v.status === 200 && p.status === 200) ok(`${name} + affiche`);
  else bad(`${name} : vidéo ${v.status} / affiche ${p.status}`);
}

/* ---- 2. Navigateur : la vidéo démarre-t-elle vraiment ? ---- */
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(`${base}/videos`, { waitUntil: 'networkidle' });
await page.waitForSelector('.video-tile video', { timeout: 10000 });

const count = await page.locator('.video-tile video').count();
if (count === 5) ok('5 clips sur la page /videos');
else bad(`${count} clips sur la page /videos`);

/* Le premier clip doit se charger et avancer d'au moins 0,5 s. */
await page.locator('.video-tile video').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
const started = await page.evaluate(async () => {
  const video = document.querySelector('.video-tile video');
  if (!video) return { error: 'aucune vidéo' };
  const before = video.currentTime;
  await new Promise((r) => setTimeout(r, 2500));
  return {
    readyState: video.readyState,
    networkState: video.networkState,
    currentTime: video.currentTime,
    paused: video.paused,
    before,
    duration: video.duration,
    width: video.videoWidth,
  };
});
console.log('   état du lecteur :', JSON.stringify(started));
if (started.currentTime > 0.4) ok(`le clip avance (${started.currentTime.toFixed(2)} s)`);
else bad(`le clip ne démarre pas (currentTime=${started.currentTime})`);
if (started.width === 1080) ok('flux 1080 de large');
else bad(`largeur du flux ${started.width}`);

/* Sur l'accueil, le bandeau vidéo doit exister et rester sur une rangée. */
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForSelector('.video-rail');
await page.locator('.video-rail').scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
const railCount = await page.locator('.video-rail .video-card').count();
if (railCount === 5) ok('5 cartes dans le bandeau de l’accueil');
else bad(`${railCount} cartes dans le bandeau`);

const overflow = await page.evaluate(() => {
  const rail = document.querySelector('.video-rail');
  if (!rail) return null;
  return { scrollWidth: rail.scrollWidth, clientWidth: rail.clientWidth };
});
if (overflow && overflow.scrollWidth > overflow.clientWidth) ok('le bandeau défile horizontalement');
else bad(`bandeau non défilable : ${JSON.stringify(overflow)}`);

/* Aucun débordement horizontal de la page. */
const pageOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
if (pageOverflow <= 1) ok('aucun débordement horizontal');
else bad(`débordement horizontal de ${pageOverflow} px`);

await page.screenshot({ path: 'videos-rail.png', fullPage: false });
await page.goto(`${base}/videos`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.screenshot({ path: 'videos-page.png', fullPage: false });

if (errors.length) bad(`erreurs console : ${errors.slice(0, 3).join(' | ')}`);
else ok('aucune erreur console');

await browser.close();
if (server) server.kill();

console.log(fail.length ? `\n${fail.length} problème(s).` : '\nTout est bon.');
process.exit(fail.length ? 1 : 0);
