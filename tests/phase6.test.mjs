import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-p6-test-'));
const port = 4100 + Math.floor(Math.random() * 80);
const base = `http://127.0.0.1:${port}`;
const ADMIN = { email: 'admin-p6@test.local', password: 'TestAdminP6-123!' };
let server;

before(async () => {
  server = spawn('node', ['server/index.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      JWT_SECRET: 'test-p6-secret',
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Serveur non démarré')), 20000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('http://localhost')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  });
});

after(() => {
  server?.kill('SIGTERM');
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function createClient() {
  let cookie = '';
  return async function call(pathname, { method = 'GET', body } = {}) {
    const res = await fetch(base + pathname, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.getSetCookie?.() || [];
    if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  };
}

const reader = createClient();
const admin = createClient();

test('Phase 6 - Inscription lecteur & Commande avant paiement', async () => {
  const reg = await reader('/api/auth/register', {
    method: 'POST',
    body: { email: 'client.phase6@test.ci', password: 'Password123!', name: 'Kouame Jean' },
  });
  assert.equal(reg.status, 201);

  // Commande du chapitre 3 de light-in-the-dark
  const orderRes = await reader('/api/me/purchases', {
    method: 'POST',
    body: { bookSlug: 'light-in-the-dark', chapterNumber: 3, method: 'wave_link' },
  });
  assert.equal(orderRes.status, 201);
  assert.equal(orderRes.json.order.status, 'pending');
  assert.equal(orderRes.json.order.amountXof, 300);
  assert.match(orderRes.json.order.reference, /^BF-\d{4}-[A-F0-9]{8}$/);
});

test('Phase 6 - Validation admin & Génération automatique du reçu électronique certifié', async () => {
  await admin('/api/auth/login', { method: 'POST', body: ADMIN });

  const orders = await admin('/api/admin/orders?status=pending');
  assert.ok(orders.json.orders.length >= 1);
  const target = orders.json.orders.find((o) => o.book_slug === 'light-in-the-dark' && o.chapter_number === 3);
  assert.ok(target, 'La commande doit exister');

  const valRes = await admin(`/api/admin/orders/${target.id}/validate`, { method: 'POST', body: {} });
  assert.equal(valRes.status, 200);
  assert.ok(valRes.json.receipt, 'Le reçu doit être généré');
  assert.match(valRes.json.receipt.receipt_number, /^BF-REC-\d{4}-/);
  assert.equal(valRes.json.receipt.amount_xof, 300);
  assert.equal(valRes.json.receipt.status, 'confirmed');
});

test('Phase 6 - Consultation des reçus par le lecteur (Mes transactions)', async () => {
  const res = await reader('/api/me/receipts');
  assert.equal(res.status, 200);
  assert.ok(res.json.receipts.length >= 1);

  const receipt = res.json.receipts[0];
  assert.equal(receipt.bookSlug, 'light-in-the-dark');
  assert.equal(receipt.chapterNumber, 3);
  assert.equal(receipt.amountXof, 300);
  assert.equal(receipt.currency, 'XOF');
  assert.equal(receipt.status, 'confirmed');
  assert.equal(receipt.accessType, 'chapter_30d');
  assert.ok(receipt.expiresAt, 'La date d expiration 30 jours doit être définie');

  // Détail du reçu avec mentions légales vendeur
  const detail = await reader(`/api/me/receipts/${receipt.id}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.json.receipt.vendor.name);
  assert.ok(detail.json.receipt.vendor.address);
});

test('Phase 6 - Filtrage et recherche de reçus', async () => {
  const searchFound = await reader('/api/me/receipts?search=Light');
  assert.equal(searchFound.status, 200);
  assert.ok(searchFound.json.receipts.length >= 1);

  const searchNotFound = await reader('/api/me/receipts?search=InexistantXYZ');
  assert.equal(searchNotFound.status, 200);
  assert.equal(searchNotFound.json.receipts.length, 0);
});

test('Phase 6 - Création et suivi d une réclamation client (SAV)', async () => {
  const claimRes = await reader('/api/me/claims', {
    method: 'POST',
    body: {
      category: 'paiement_bloque',
      orderReference: 'BF-2026-TEST',
      subject: 'Chapitre non ouvert après Wave',
      message: 'J ai effectué mon paiement de 300 FCFA sur Wave mais le chapitre 3 est resté verrouillé.',
    },
  });
  assert.equal(claimRes.status, 201);
  assert.match(claimRes.json.claim.claimNumber, /^REC-\d{4}-/);
  assert.equal(claimRes.json.claim.status, 'OUVERT');

  const myClaims = await reader('/api/me/claims');
  assert.equal(myClaims.status, 200);
  assert.ok(myClaims.json.claims.some((c) => c.subject === 'Chapitre non ouvert après Wave'));
});

test('Phase 6 - Traitement admin de la réclamation', async () => {
  const adminClaims = await admin('/api/admin/claims');
  assert.equal(adminClaims.status, 200);
  const targetClaim = adminClaims.json.claims.find((c) => c.subject === 'Chapitre non ouvert après Wave');
  assert.ok(targetClaim);

  const updateRes = await admin(`/api/admin/claims/${targetClaim.id}`, {
    method: 'PATCH',
    body: {
      status: 'RESOLU',
      adminReply: 'Votre paiement a été identifié et vos droits de lecture ont été débloqués pour 30 jours.',
    },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.json.claim.status, 'RESOLU');
  assert.ok(updateRes.json.claim.admin_reply);

  const refreshed = await reader('/api/me/claims');
  const userClaim = refreshed.json.claims.find((c) => c.id === targetClaim.id);
  assert.equal(userClaim.status, 'RESOLU');
  assert.equal(userClaim.adminReply, 'Votre paiement a été identifié et vos droits de lecture ont été débloqués pour 30 jours.');
});

test('Phase 6 - Scripts de Sauvegarde externe et Restauration', () => {
  // Exécuter le script de backup
  const backupOutput = execSync(`node ${path.join(root, 'scripts/backup.mjs')}`, {
    cwd: root,
    env: { ...process.env, DATA_DIR: dataDir },
  }).toString();

  assert.match(backupOutput, /Sauvegarde réussie dans/);

  // Trouver le dernier fichier généré
  const backupsDir = path.join(root, 'backups');
  const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 1);
  const latestBackup = path.join(backupsDir, files.sort().reverse()[0]);

  // Exécuter le script de restauration
  const restoreOutput = execSync(`node ${path.join(root, 'scripts/restore.mjs')} "${latestBackup}"`, {
    cwd: root,
    env: { ...process.env, DATA_DIR: dataDir },
  }).toString();

  assert.match(restoreOutput, /Restauration terminée avec succès/);
});
