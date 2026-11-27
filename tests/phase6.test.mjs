import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-p6-test-'));
const port = 4100 + Math.floor(Math.random() * 80);
const base = `http://127.0.0.1:${port}`;
const ADMIN = { email: 'admin-p6@test.local', password: 'TestAdminP6-123!' };
const WEBHOOK_SECRET = 'secret-p6-webhook';
let server;

before(async () => {
  server = spawn('node', ['server/index.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      JWT_SECRET: 'test-p6-secret',
      WAVE_WEBHOOK_SECRET: WEBHOOK_SECRET,
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
const anon = createClient();

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
  /* v55 : un achat de chapitre est définitif. Le reçu doit le dire. */
  assert.equal(receipt.accessType, 'chapter_permanent');
  assert.equal(receipt.expiresAt, '', 'un achat définitif ne porte pas de date expiration');

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

test('Phase 6 - Capture de Lead WhatsApp avant lecture', async () => {
  // Test format invalide
  const bad = await anon('/api/leads', {
    method: 'POST',
    body: { phone: '123456', bookSlug: 'amour-perdu' },
  });
  assert.equal(bad.status, 400);

  // Test format valide ivoirien (07 XX XX XX XX)
  const good = await anon('/api/leads', {
    method: 'POST',
    body: { phone: '0706486904', bookSlug: 'amour-perdu' },
  });
  assert.equal(good.status, 201);
  assert.equal(good.json.phone, '0706486904');
  assert.ok(good.json.ok);

  // Test avec indicatif +225
  const intl = await anon('/api/leads', {
    method: 'POST',
    body: { phone: '+225 05 12 34 56 78', bookSlug: 'amour-perdu' },
  });
  assert.equal(intl.status, 201);
  assert.equal(intl.json.phone, '0512345678');
});

test('Phase 6 - Paiement automatisé & Webhook Wave / CinetPay', async () => {
  // Créer une commande en attente
  const orderRes = await reader('/api/me/purchases', {
    method: 'POST',
    body: { bookSlug: 'amour-perdu', chapterNumber: 4, method: 'wave_link' },
  });
  assert.equal(orderRes.status, 201);
  const ref = orderRes.json.order.reference;

  // Checkout API
  const checkoutRes = await anon('/api/payments/checkout', {
    method: 'POST',
    body: { reference: ref, provider: 'wave' },
  });
  assert.equal(checkoutRes.status, 200);
  assert.ok(checkoutRes.json.launchUrl);

  // 1. Webhook SANS signature : doit être refusé (v53 : échec fermé)
  const sansSignature = await anon('/api/payments/webhook/wave', {
    method: 'POST',
    body: { type: 'checkout.session.completed', data: { object: { client_reference: ref, amount: 300, currency: 'XOF' } } },
  });
  assert.equal(sansSignature.status, 401, 'un webhook sans signature ne doit jamais être accepté');

  const apresRefus = await reader('/api/me/receipts');
  assert.ok(
    !apresRefus.json.receipts.some((r) => r.reference === ref && r.status === 'confirmed'),
    'aucun reçu ne doit être émis sans vérification',
  );

  // 2. Webhook signé, montant et devise conformes : paiement accepté
  const charge = {
    type: 'checkout.session.completed',
    data: { object: { client_reference: ref, amount: 300, currency: 'XOF' } },
  };
  const corps = JSON.stringify(charge);
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(corps).digest('hex');
  const webhookRes = await fetch(base + '/api/payments/webhook/wave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'wave-signature': signature },
    body: corps,
  });
  assert.equal(webhookRes.status, 200);
  const corpsReponse = await webhookRes.json();
  assert.equal(corpsReponse.paid, true);

  // Vérifier que le chapitre est maintenant débloqué pour le lecteur
  const receipts = await reader('/api/me/receipts');
  assert.equal(receipts.status, 200);
  const myReceipt = receipts.json.receipts.find((r) => r.reference === ref);
  assert.ok(myReceipt, 'Le reçu automatique doit exister suite au webhook signé');
  assert.equal(myReceipt.status, 'confirmed');

  // 3. Rejeu du même webhook : accepté mais sans second déblocage
  const rejeu = await fetch(base + '/api/payments/webhook/wave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'wave-signature': signature },
    body: corps,
  });
  assert.equal(rejeu.status, 200);
  assert.equal((await rejeu.json()).alreadyPaid, true);
  // Test Guest Checkout (visiteur sans compte)
  const guestRes = await anon('/api/payments/guest-checkout', {
    method: 'POST',
    body: { bookSlug: 'amour-perdu', chapterNumber: 3, method: 'wave_link' },
  });
  assert.equal(guestRes.status, 201);
  assert.ok(guestRes.json.order.reference.startsWith('BF-GUEST-'));
  assert.ok(guestRes.json.launchUrl);
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
