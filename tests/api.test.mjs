import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-test-'));
const port = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const ADMIN = { email: 'admin@test.local', password: 'TestAdmin123!' };
const WEBHOOK_SECRET = 'secret-de-test-webhook';
let server;

before(async () => {
  server = spawn('node', ['server/index.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      JWT_SECRET: 'test-secret',
      WAVE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('serveur non démarré')), 20000);
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

function client() {
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

const anon = client();
const reader = client();
const admin = client();

test('santé de l’API', async () => {
  const { status, json } = await anon('/api/health');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
});

test('catalogue : romans publiés, tous les chapitres publiés, 2 offerts par roman', async () => {
  const { status, json } = await anon('/api/books');
  assert.equal(status, 200);
  assert.ok(json.books.length >= 4);
  assert.ok(
    json.books.some((book) => book.slug === 'si-je-t-aimais-au-present'),
    'le roman adapté de la BD doit être publié',
  );
  for (const book of json.books) {
    assert.equal(book.chaptersFree, 2);
    assert.equal(book.priceXof, 300);
    assert.ok(book.chaptersTotal >= 6, `${book.slug} doit avoir au moins 6 chapitres`);
    assert.equal(book.chaptersPublished, book.chaptersTotal, `${book.slug} : chapitres non publiés`);
  }
});

test('coordonnées publiques réelles', async () => {
  const { json } = await anon('/api/site');
  assert.equal(json.contactEmail, 'alexandregnankou@gmail.com');
  assert.equal(json.contactPhone, '+225 0703025007');
  assert.equal(json.orangeNumber, '0706486904');
  assert.match(json.waveLink, /pay\.wave\.com/);
});

test('chapitre 1 offert sans compte', async () => {
  const { status, json } = await anon('/api/books/les-larmes-d-une-plume/chapters/1');
  assert.equal(status, 200);
  assert.equal(json.locked, false);
  assert.ok(json.chapter.text.length > 500);
});

test('chapitre payant verrouillé → 402 avec instruction de paiement', async () => {
  await admin('/api/auth/login', { method: 'POST', body: ADMIN });
  const books = await admin('/api/admin/books');
  const book = books.json.books.find((b) => b.slug === 'les-larmes-d-une-plume');
  const chapters = await admin(`/api/admin/books/${book.id}/chapters`);
  const chapter = chapters.json.chapters.find((c) => c.number === 3);
  await admin(`/api/admin/chapters/${chapter.id}`, {
    method: 'PATCH',
    body: { status: 'published', text: 'Chapitre trois de démonstration pour le test du verrou.' },
  });

  const { status, json } = await anon('/api/books/les-larmes-d-une-plume/chapters/3');
  assert.equal(status, 402);
  assert.equal(json.locked, true);
  assert.equal(json.paywall.priceXof, 300);
  assert.equal(json.chapter.text, undefined);
});

test('inscription lecteur puis achat Wave en attente', async () => {
  const reg = await reader('/api/auth/register', {
    method: 'POST',
    body: { email: 'lecteur@test.ci', password: 'MotDePasse123', name: 'Lecteur Test' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.role, 'reader');

  const buy = await reader('/api/me/purchases', {
    method: 'POST',
    body: { bookSlug: 'les-larmes-d-une-plume', chapterNumber: 3, method: 'wave_link' },
  });
  assert.equal(buy.status, 201);
  assert.match(buy.json.order.reference, /^BF-\d{4}-[A-F0-9]{8}$/);
  assert.equal(buy.json.instructions.amountXof, 300);

  const again = await reader('/api/me/purchases', {
    method: 'POST',
    body: { bookSlug: 'les-larmes-d-une-plume', chapterNumber: 3, method: 'wave_link' },
  });
  assert.equal(again.json.reused, true);
  assert.equal(again.json.order.reference, buy.json.order.reference);
});

test('achat ignoré tant que le chapitre n’est pas publié', async () => {
  const books = await admin('/api/admin/books');
  const book = books.json.books.find((b) => b.slug === 'les-larmes-d-une-plume');
  const chapters = await admin(`/api/admin/books/${book.id}/chapters`);
  const target = chapters.json.chapters.find((c) => c.number === 5);

  const off = await admin(`/api/admin/chapters/${target.id}`, {
    method: 'PATCH',
    body: { status: 'draft' },
  });
  assert.equal(off.status, 200);

  const blocked = await reader('/api/me/purchases', {
    method: 'POST',
    body: { bookSlug: 'les-larmes-d-une-plume', chapterNumber: 5, method: 'wave_link' },
  });
  assert.equal(blocked.status, 404);

  const on = await admin(`/api/admin/chapters/${target.id}`, {
    method: 'PATCH',
    body: { status: 'published' },
  });
  assert.equal(on.status, 200);
});

test('validation administrateur → chapitre ouvert pour le lecteur', async () => {
  const pending = await admin('/api/admin/orders?status=pending');
  assert.equal(pending.json.orders.length, 1);
  const order = pending.json.orders[0];
  const validated = await admin(`/api/admin/orders/${order.id}/validate`, { method: 'POST', body: {} });
  assert.equal(validated.status, 200);

  const chapter = await reader('/api/books/les-larmes-d-une-plume/chapters/3');
  assert.equal(chapter.status, 200);
  assert.equal(chapter.json.locked, false);
  assert.ok(chapter.json.chapter.text.length > 10);

  const purchases = await reader('/api/me/purchases');
  assert.equal(purchases.json.purchases[0].status, 'paid');
});

test('un lecteur ne peut pas valider un paiement', async () => {
  const { status } = await reader('/api/admin/orders/1/validate', { method: 'POST', body: {} });
  assert.equal(status, 403);
});

test('formulaire de contact → message dans la console', async () => {
  const sent = await anon('/api/contact', {
    method: 'POST',
    body: { name: 'Awa', email: 'awa@example.ci', subject: 'Paiement', body: 'Bonjour, mon paiement Wave est passé hier.' },
  });
  assert.equal(sent.status, 201);
  const messages = await admin('/api/admin/messages');
  assert.ok(messages.json.messages.some((m) => m.email === 'awa@example.ci'));
});

test('import d’un manuscrit : découpage sur « Chapitre N »', async () => {
  const created = await admin('/api/admin/books', {
    method: 'POST',
    body: { title: 'Roman Partenaire', author: 'Auteur Partenaire', categoryName: 'Nouvelle', priceXof: 250 },
  });
  assert.equal(created.status, 201);
  const id = created.json.book.id;

  const manuscript = `Chapitre 1\n\nPremier paragraphe du roman.\n\nChapitre 2\n\nDeuxième paragraphe.\n\nCHAPITRE 3\n\nTroisième et dernier paragraphe.`;
  const imported = await admin(`/api/admin/books/${id}/import`, {
    method: 'POST',
    body: { text: manuscript, mode: 'replace' },
  });
  assert.equal(imported.status, 200);
  assert.equal(imported.json.imported, 3);

  const chapters = await admin(`/api/admin/books/${id}/chapters`);
  assert.deepEqual(chapters.json.chapters.map((c) => c.number), [1, 2, 3]);
  assert.equal(chapters.json.chapters[0].isFree, true);
  assert.equal(chapters.json.chapters[2].isFree, false);
});

test('réglages : modification répercutée sur /api/site', async () => {
  await admin('/api/admin/settings', { method: 'PATCH', body: { priceXof: '350', contactPhone: '+225 0102030405' } });
  const site = await anon('/api/site');
  assert.equal(site.json.priceXof, 350);
  assert.equal(site.json.contactPhone, '+225 0102030405');
});

test('changement de mot de passe puis reconnexion', async () => {
  const changed = await reader('/api/auth/password', {
    method: 'POST',
    body: { currentPassword: 'MotDePasse123', newPassword: 'NouveauMotDePasse456' },
  });
  assert.equal(changed.status, 200);

  const other = client();
  const oldLogin = await other('/api/auth/login', {
    method: 'POST',
    body: { email: 'lecteur@test.ci', password: 'MotDePasse123' },
  });
  assert.equal(oldLogin.status, 401);

  const fresh = client();
  const newLogin = await fresh('/api/auth/login', {
    method: 'POST',
    body: { email: 'lecteur@test.ci', password: 'NouveauMotDePasse456' },
  });
  assert.equal(newLogin.status, 200);
});

test('v50 : version et blocage après dix échecs de connexion', async () => {
  const health = await client()('/api/health');
  assert.match(health.json.release, /^v5\d(\.\d+)?$/);
  assert.match(health.json.version, /^1\.\d+\.\d+$/);

  const email = 'brute-force@test.ci';
  for (let i = 0; i < 10; i += 1) {
    const attempt = await client()('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'mauvais-mot-de-passe' },
    });
    assert.equal(attempt.status, 401);
  }
  const blocked = await client()('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'mauvais-mot-de-passe' },
  });
  assert.equal(blocked.status, 429);
});

test('page publique rendue par le serveur', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /BOOK FOREVER/);
  assert.match(html, /<div id="root">/);
});

test('service worker jamais mis en cache', async () => {
  const res = await fetch(base + '/sw.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control') || '', /no-cache/);
});


/* ---------- v22 : formules, packs de crédits et parrainage ---------- */

test('offres : pass 7 jours, pack de 5 chapitres, abonnement mensuel', async () => {
  const { status, json } = await reader('/api/me/offers');
  assert.equal(status, 200);
  assert.equal(json.pass.priceXof, 500);
  assert.equal(json.pass.days, 7);
  assert.equal(json.pack.priceXof, 1200);
  assert.equal(json.pack.credits, 5);
  assert.equal(json.monthly.priceXof, 2000);
  assert.equal(json.referral.target, 3);
  assert.equal(json.credits, 0);
});

test('pack de crédits : demande, validation, ouverture d’un chapitre', async () => {
  const asked = await reader('/api/me/credits', { method: 'POST', body: { method: 'wave_link' } });
  assert.equal(asked.status, 201);
  assert.equal(asked.json.order.amountXof, 1200);
  assert.equal(asked.json.order.credits, 5);
  assert.match(asked.json.order.reference, /^BF-PACK-/);
  assert.equal(asked.json.instructions.amountXof, 1200);

  const again = await reader('/api/me/credits', { method: 'POST', body: { method: 'wave_link' } });
  assert.equal(again.json.reused, true);
  assert.equal(again.json.order.reference, asked.json.order.reference);

  const packs = await admin('/api/admin/credits');
  const pending = packs.json.orders.find((p) => p.status === 'pending');
  assert.ok(pending, 'le pack doit apparaître en attente');
  const validated = await admin(`/api/admin/credits/${pending.id}/validate`, { method: 'POST', body: {} });
  assert.equal(validated.status, 200);
  assert.equal(validated.json.credits, 5);

  const balance = await reader('/api/me/credits');
  assert.equal(balance.json.balance, 5);

  const used = await reader('/api/me/credits/use', {
    method: 'POST',
    body: { bookSlug: 'les-larmes-d-une-plume', chapterNumber: 4 },
  });
  assert.equal(used.status, 200);
  assert.equal(used.json.balance, 4);

  const chapter = await reader('/api/books/les-larmes-d-une-plume/chapters/4');
  assert.equal(chapter.status, 200);
  assert.ok(chapter.json.chapter.text.length > 10);

  const twice = await reader('/api/me/credits/use', {
    method: 'POST',
    body: { bookSlug: 'les-larmes-d-une-plume', chapterNumber: 4 },
  });
  assert.equal(twice.status, 409);
});

test('pass 7 jours : activation par l’administrateur, catalogue ouvert', async () => {
  const asked = await reader('/api/me/subscription', {
    method: 'POST',
    body: { method: 'wave_link', plan: 'week' },
  });
  assert.equal(asked.status, 201);
  assert.equal(asked.json.amountXof, 500);
  assert.equal(asked.json.days, 7);

  const list = await admin('/api/admin/subscriptions');
  const pending = list.json.subscriptions.find((s) => s.status === 'pending');
  assert.ok(pending, 'le pass doit apparaître en attente');
  const validated = await admin(`/api/admin/subscriptions/${pending.id}/validate`, { method: 'POST', body: {} });
  assert.equal(validated.status, 200);
  assert.equal(validated.json.days, 7);

  const end = new Date(`${validated.json.periodEnd}T00:00:00Z`);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const diff = Math.round((end - today) / 86400000);
  assert.ok(diff === 6 || diff === 7, `période de 7 jours attendue, reçue ${diff}`);

  const chapter = await reader('/api/books/les-larmes-d-une-plume/chapters/6');
  assert.equal(chapter.status, 200);
  assert.equal(chapter.json.chapter.access, 'subscription');
});

test('parrainage : trois filleuls donnent un chapitre offert', async () => {
  const mine = await reader('/api/me/referral');
  assert.equal(mine.status, 200);
  assert.match(mine.json.code, /^[A-F0-9]{8}$/);

  for (let i = 1; i <= 3; i += 1) {
    const invited = client();
    const res = await invited('/api/auth/register', {
      method: 'POST',
      body: {
        email: `filleul${i}@test.ci`,
        password: 'MotDePasse123',
        name: `Filleul ${i}`,
        ref: mine.json.code,
      },
    });
    assert.equal(res.status, 201);
    assert.ok(res.json.referral, 'le parrainage doit être enregistré');
  }

  const after = await reader('/api/me/referral');
  assert.equal(after.json.invited, 3);
  assert.equal(after.json.earned, 1);

  const credits = await reader('/api/me/credits');
  assert.equal(credits.json.balance, 5, '4 crédits du pack + 1 offert');
});

test('un code de parrainage inconnu n’empêche pas l’inscription', async () => {
  const fresh = client();
  const res = await fresh('/api/auth/register', {
    method: 'POST',
    body: { email: 'sansparrain@test.ci', password: 'MotDePasse123', ref: 'ZZZZZZZZ' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.json.referral, null);
});

test('partage : un premier partage compte, le même jour et même canal non', async () => {
  const slug = 'light-in-the-dark';
  const first = await anon('/api/shares', { method: 'POST', body: { bookSlug: slug, channel: 'whatsapp' } });
  assert.equal(first.status, 200);
  assert.equal(first.json.counted, true);
  assert.ok(first.json.shares >= 1);

  const again = await anon('/api/shares', { method: 'POST', body: { bookSlug: slug, channel: 'whatsapp' } });
  assert.equal(again.json.counted, false, 'un double clic ne doit pas gonfler le compteur');

  const other = await anon('/api/shares', { method: 'POST', body: { bookSlug: slug, channel: 'facebook' } });
  assert.equal(other.json.counted, true, 'un autre canal reste un nouveau partage');

  const site = await anon('/api/shares', { method: 'POST', body: { channel: 'copie' } });
  assert.equal(site.status, 200);
  assert.equal(site.json.path, '/', 'sans roman, le lien vise la page d’accueil');
});

test('partage : un lecteur connecté diffuse son code de parrainage', async () => {
  const res = await reader('/api/shares', { method: 'POST', body: { bookSlug: 'light-in-the-dark', channel: 'telegram' } });
  assert.equal(res.status, 200);
  assert.ok(res.json.code && res.json.code.length >= 6, 'le lien doit porter le code du lecteur');

  const mine = await reader('/api/shares/mine');
  assert.ok(mine.json.shares >= 1);
  assert.equal(mine.json.code, res.json.code);
});

test('partage : un roman inconnu est refusé', async () => {
  const res = await anon('/api/shares', { method: 'POST', body: { bookSlug: 'roman-fantome', channel: 'x' } });
  assert.equal(res.status, 404);
});

test('console : cœurs et partages par roman', async () => {
  await admin('/api/auth/login', { method: 'POST', body: { email: 'admin@test.ci', password: 'Adisen2026!' } });
  const res = await admin('/api/admin/audience');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json.books));
  assert.ok(res.json.totals.shares >= 2, 'les partages des tests précédents doivent être visibles');
  const book = res.json.books.find((b) => b.slug === 'light-in-the-dark');
  assert.ok(book && book.shares >= 2, 'les partages par roman doivent remonter');
  assert.ok(typeof book.likes === 'number');
});

test('partage : deux visiteurs différents comptent, un même visiteur non', async () => {
  const first = await anon('/api/shares', {
    method: 'POST',
    body: { bookSlug: 'si-je-t-aimais-au-present', channel: 'x', visitor: 'visiteur-alpha-001' },
  });
  assert.equal(first.json.counted, true);

  const same = await anon('/api/shares', {
    method: 'POST',
    body: { bookSlug: 'si-je-t-aimais-au-present', channel: 'x', visitor: 'visiteur-alpha-001' },
  });
  assert.equal(same.json.counted, false, 'même visiteur, même canal : pas de double comptage');

  const other = await anon('/api/shares', {
    method: 'POST',
    body: { bookSlug: 'si-je-t-aimais-au-present', channel: 'x', visitor: 'visiteur-beta-002' },
  });
  assert.equal(other.json.counted, true, 'un autre visiteur compte comme un partage de plus');
});

test('sortie du jour : visible quand le chapitre existe, retirée après expiration', async () => {
  await admin('/api/auth/login', { method: 'POST', body: { email: 'admin@test.ci', password: 'Adisen2026!' } });

  const set = await admin('/api/admin/settings', {
    method: 'PATCH',
    body: { spotlightBook: 'light-in-the-dark', spotlightChapter: '1', spotlightUntil: '' },
  });
  assert.equal(set.status, 200);

  let site = await anon('/api/site');
  assert.ok(site.json.spotlight, 'l’encart doit être exposé');
  assert.equal(site.json.spotlight.chapter, 1);
  assert.equal(site.json.spotlight.isFree, true);

  /* Un chapitre verrouillé reste proposé, mais signalé comme payant. */
  await admin('/api/admin/settings', { method: 'PATCH', body: { spotlightChapter: '5' } });
  site = await anon('/api/site');
  assert.equal(site.json.spotlight.isFree, false);

  /* Date dépassée : l'encart disparaît sans intervention. */
  await admin('/api/admin/settings', { method: 'PATCH', body: { spotlightUntil: '2020-01-01' } });
  site = await anon('/api/site');
  assert.equal(site.json.spotlight, null, 'un encart expiré ne doit plus s’afficher');

  /* Nettoyage : on retire la mise en avant pour les tests suivants. */
  await admin('/api/admin/settings', {
    method: 'PATCH',
    body: { spotlightBook: '', spotlightChapter: '', spotlightUntil: '' },
  });
  site = await anon('/api/site');
  assert.equal(site.json.spotlight, null);
});

test('sortie du jour : un chapitre inexistant ne casse rien', async () => {
  await admin('/api/auth/login', { method: 'POST', body: { email: 'admin@test.ci', password: 'Adisen2026!' } });
  await admin('/api/admin/settings', { method: 'PATCH', body: { spotlightBook: 'light-in-the-dark', spotlightChapter: '999' } });
  const site = await anon('/api/site');
  assert.equal(site.json.spotlight, null);
  await admin('/api/admin/settings', { method: 'PATCH', body: { spotlightBook: '', spotlightChapter: '' } });
});

/* ---------------------------------------------------------------------------
   v53 — Protection du patrimoine : un chapitre vendu ne peut plus disparaître.
   Contexte : orders.chapter_id est en ON DELETE CASCADE. Sans garde-fou,
   supprimer un chapitre effaçait aussi les commandes payées (montant,
   référence, preuve de vente) et retirait son accès à l'acheteur.
--------------------------------------------------------------------------- */

async function livreLesLarmes() {
  const books = await admin('/api/admin/books');
  return books.json.books.find((b) => b.slug === 'les-larmes-d-une-plume');
}

test('v53 — suppression refusée sur un chapitre déjà acheté', async () => {
  const book = await livreLesLarmes();
  const chapters = await admin(`/api/admin/books/${book.id}/chapters`);
  const vendu = chapters.json.chapters.find((c) => c.number === 3);

  const refus = await admin(`/api/admin/chapters/${vendu.id}`, { method: 'DELETE' });
  assert.equal(refus.status, 409);
  assert.equal(refus.json.code, 'CHAPTER_SOLD');
  assert.ok(refus.json.orders >= 1, 'au moins une commande doit être signalée');
  assert.equal(refus.json.revenue, 300);
  assert.equal(refus.json.paid, 1);

  const apres = await admin(`/api/admin/books/${book.id}/chapters`);
  assert.ok(apres.json.chapters.some((c) => c.id === vendu.id), 'le chapitre acheté doit toujours exister');

  const acces = await reader('/api/books/les-larmes-d-une-plume/chapters/3');
  assert.equal(acces.status, 200);
  assert.equal(acces.json.locked, false);

  const achats = await reader('/api/me/purchases');
  assert.ok(achats.json.purchases.some((p) => p.status === 'paid'), 'la commande payée doit subsister');
});

test('v53 — archivage : le chapitre quitte le catalogue sans rien effacer', async () => {
  const book = await livreLesLarmes();
  const chapters = await admin(`/api/admin/books/${book.id}/chapters`);
  const vendu = chapters.json.chapters.find((c) => c.number === 3);

  const avant = await reader('/api/books/les-larmes-d-une-plume/chapters/3');
  const texteAvant = avant.json.chapter.text;
  assert.ok(texteAvant.length > 0);

  const archive = await admin(`/api/admin/chapters/${vendu.id}/archive`, {
    method: 'POST',
    body: { reason: 'test automatisé' },
  });
  assert.equal(archive.status, 200);
  assert.equal(archive.json.chapter.status, 'draft', 'archiver = dépublier');
  assert.ok(archive.json.chapter.archived_at, 'l’horodatage d’archivage est conservé');
  assert.equal(archive.json.chapter.archived_reason, 'test automatisé');
  assert.equal(archive.json.chapter.text, texteAvant, 'le texte est intact');

  const publicMasque = await anon('/api/books/les-larmes-d-une-plume/chapters/3');
  assert.equal(publicMasque.status, 404);

  const achats = await reader('/api/me/purchases');
  assert.ok(achats.json.purchases.some((p) => p.chapter?.number === 3 && p.status === 'paid'));

  const desarchive = await admin(`/api/admin/chapters/${vendu.id}/unarchive`, { method: 'POST' });
  assert.equal(desarchive.status, 200);
  assert.equal(desarchive.json.chapter.archived_at, null);
  assert.equal(desarchive.json.chapter.status, 'draft', 'la remise en ligne reste un acte explicite');

  const republie = await admin(`/api/admin/chapters/${vendu.id}`, {
    method: 'PATCH',
    body: { status: 'published' },
  });
  assert.equal(republie.status, 200);

  const acces = await reader('/api/books/les-larmes-d-une-plume/chapters/3');
  assert.equal(acces.status, 200);
  assert.equal(acces.json.locked, false);
  assert.ok(acces.json.chapter.text.length > 10);
});

test('v53 — suppression autorisée sur un chapitre jamais vendu', async () => {
  const book = await livreLesLarmes();
  const cree = await admin(`/api/admin/books/${book.id}/chapters`, {
    method: 'POST',
    body: { title: 'Chapitre jetable', text: 'Texte de test, jamais publié ni vendu.', publish: false },
  });
  assert.equal(cree.status, 201);
  const id = cree.json.chapter.id;

  const supprime = await admin(`/api/admin/chapters/${id}`, { method: 'DELETE' });
  assert.equal(supprime.status, 200);
  assert.equal(supprime.json.deleted, true);

  const apres = await admin(`/api/admin/books/${book.id}/chapters`);
  assert.ok(!apres.json.chapters.some((c) => c.id === id), 'le chapitre non vendu est bien supprimé');
});

test('v53 — un lecteur ne peut ni supprimer ni archiver un chapitre', async () => {
  const book = await livreLesLarmes();
  const chapters = await admin(`/api/admin/books/${book.id}/chapters`);
  const cible = chapters.json.chapters[0];

  const del = await reader(`/api/admin/chapters/${cible.id}`, { method: 'DELETE' });
  assert.equal(del.status, 403);

  const arch = await reader(`/api/admin/chapters/${cible.id}/archive`, { method: 'POST', body: {} });
  assert.equal(arch.status, 403);
});

/* ---------------------------------------------------------------------------
   v53 — Les webhooks de paiement ne doivent jamais débloquer sans preuve.
   Faille corrigée : sans clés CinetPay configurées, le statut « ACCEPTED »
   annoncé dans le corps suffisait à marquer une commande payée ; et le webhook
   Wave sautait la vérification dès que l'en-tête de signature était absent.
   Chapitres utilisés : amour-perdu 8 à 12 (jamais achetés par les autres tests).
--------------------------------------------------------------------------- */

const LIVRE_PAIEMENT = 'amour-perdu';

function signatureWave(corps) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(corps).digest('hex');
}

async function posterWebhook(chemin, charge, signature) {
  const corps = JSON.stringify(charge);
  const headers = { 'Content-Type': 'application/json' };
  if (signature !== undefined) headers['wave-signature'] = signature;
  const res = await fetch(base + chemin, { method: 'POST', headers, body: corps });
  const texte = await res.text();
  let json = null;
  try { json = JSON.parse(texte); } catch { json = null; }
  return { status: res.status, json };
}

/* Un seul compte pour les cinq tests de paiement : l'inscription est limitée
   en débit, et un compte peut acheter plusieurs chapitres différents. */
let lecteurPaiement = null;
async function nouveauLecteur() {
  if (lecteurPaiement) return lecteurPaiement;
  const c = client();
  const r = await c('/api/auth/register', {
    method: 'POST',
    body: { email: 'paiement-v53@exemple.ci', password: 'MotDePasse2026!', name: 'Lecteur Paiement' },
  });
  assert.ok(r.status === 201 || r.status === 409, `inscription inattendue : ${r.status}`);
  if (r.status === 409) {
    await c('/api/auth/login', {
      method: 'POST',
      body: { email: 'paiement-v53@exemple.ci', password: 'MotDePasse2026!' },
    });
  }
  lecteurPaiement = c;
  return c;
}

async function commandeEnAttente(c, chapterNumber) {
  const ord = await c('/api/me/purchases', {
    method: 'POST',
    body: { bookSlug: LIVRE_PAIEMENT, chapterNumber, method: 'wave_link' },
  });
  assert.equal(ord.status, 201, `commande attendue en 201, reçu ${ord.status} ${JSON.stringify(ord.json)}`);
  return ord.json.order;
}

async function etatChapitre(c, n) {
  const r = await c(`/api/books/${LIVRE_PAIEMENT}/chapters/${n}`);
  return { locked: r.json.locked, longueur: (r.json.chapter?.text || '').length };
}

test('v53 — faux webhook CinetPay : refusé, chapitre toujours verrouillé', async () => {
  const c = await nouveauLecteur();
  const order = await commandeEnAttente(c, 8);

  assert.equal((await etatChapitre(c, 8)).locked, true);

  const hook = await posterWebhook('/api/payments/webhook/cinetpay', {
    cpm_trans_id: order.reference,
    cpm_trans_status: 'ACCEPTED',
  });
  assert.equal(hook.status, 503, 'sans clés configurées, le receveur doit être inactif');

  const apres = await etatChapitre(c, 8);
  assert.equal(apres.locked, true, 'le chapitre ne doit pas s’être ouvert');
  assert.equal(apres.longueur, 0);
});

test('v53 — webhook Wave sans signature : 401, chapitre verrouillé', async () => {
  const c = await nouveauLecteur();
  const order = await commandeEnAttente(c, 9);

  const hook = await posterWebhook('/api/payments/webhook/wave', {
    type: 'checkout.session.completed',
    data: { object: { client_reference: order.reference, amount: 300, currency: 'XOF' } },
  });
  assert.equal(hook.status, 401);
  assert.equal((await etatChapitre(c, 9)).locked, true);
});

test('v53 — webhook Wave avec signature invalide : 401', async () => {
  const c = await nouveauLecteur();
  const order = await commandeEnAttente(c, 10);

  const hook = await posterWebhook(
    '/api/payments/webhook/wave',
    { type: 'checkout.session.completed', data: { object: { client_reference: order.reference, amount: 300, currency: 'XOF' } } },
    'a'.repeat(64),
  );
  assert.equal(hook.status, 401);
  assert.equal((await etatChapitre(c, 10)).locked, true);
});

test('v53 — webhook Wave signé mais montant faux : 409, aucun déblocage', async () => {
  const c = await nouveauLecteur();
  const order = await commandeEnAttente(c, 11);

  const charge = {
    type: 'checkout.session.completed',
    data: { object: { client_reference: order.reference, amount: 50, currency: 'XOF' } },
  };
  const hook = await posterWebhook('/api/payments/webhook/wave', charge, signatureWave(JSON.stringify(charge)));
  assert.equal(hook.status, 409);
  assert.equal((await etatChapitre(c, 11)).locked, true);
});

test('v53 — webhook Wave signé et conforme : débloque une seule fois', async () => {
  const c = await nouveauLecteur();
  const order = await commandeEnAttente(c, 12);

  const charge = {
    type: 'checkout.session.completed',
    data: { object: { client_reference: order.reference, amount: 300, currency: 'XOF' } },
  };
  const corps = JSON.stringify(charge);

  const premier = await posterWebhook('/api/payments/webhook/wave', charge, signatureWave(corps));
  assert.equal(premier.status, 200);
  assert.equal(premier.json.paid, true);

  const apres = await etatChapitre(c, 12);
  assert.equal(apres.locked, false, 'le chapitre payé doit s’ouvrir');
  assert.ok(apres.longueur > 100);

  const second = await posterWebhook('/api/payments/webhook/wave', charge, signatureWave(corps));
  assert.equal(second.status, 200);
  assert.equal(second.json.alreadyPaid, true);

  const achats = await c('/api/me/purchases');
  const lignes = achats.json.purchases.filter((p) => p.chapter?.number === 12 && p.status === 'paid');
  assert.equal(lignes.length, 1, 'une seule ligne payée pour ce chapitre');
});
