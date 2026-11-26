import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import config, { CONTEST } from './config.mjs';


export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader','admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  synopsis TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  category_slug TEXT NOT NULL DEFAULT 'roman',
  category_name TEXT NOT NULL DEFAULT 'Roman',
  price_xof INTEGER NOT NULL DEFAULT 300,
  free_chapters INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  download_allowed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  is_free INTEGER NOT NULL DEFAULT 0,
  words INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (book_id, number)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  amount_xof INTEGER NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('wave_link','orange_money_direct','wave_api','orange_api','mtn_momo','moov','cinetpay','card')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected','refunded')),
  provider_ref TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','answered')),
  reply TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at TEXT
);

CREATE TABLE IF NOT EXISTS progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  position REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, book_id)
);


/* ---------- v16 : abonnements et statut d'auteur ---------- */
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'wave_link',
  amount_xof INTEGER NOT NULL DEFAULT 2000,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','expired')),
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status);


/* ---------- v17 : audience (vues, réactions, abonnés) ---------- */
CREATE TABLE IF NOT EXISTS book_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '❤️',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS author_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, author_name)
);

CREATE INDEX IF NOT EXISTS idx_reactions_book ON book_reactions(book_id);
CREATE INDEX IF NOT EXISTS idx_follows_author ON author_follows(author_name);
CREATE TABLE IF NOT EXISTS book_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id INTEGER,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_views_book ON book_views(book_id);

/* Partages : un lien diffusé par un lecteur, avec le canal utilisé.
   book_id NULL = partage du site entier. */
CREATE TABLE IF NOT EXISTS shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER,
  user_id INTEGER,
  channel TEXT NOT NULL DEFAULT 'autre',
  code TEXT NOT NULL DEFAULT '',
  visitor TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shares_book ON shares(book_id);
CREATE INDEX IF NOT EXISTS idx_shares_day ON shares(created_at);

CREATE TABLE IF NOT EXISTS boots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_dir TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

/* ---------- v22 : packs de crédits et parrainage ---------- */
CREATE TABLE IF NOT EXISTS credit_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL DEFAULT 'wave_link',
  amount_xof INTEGER NOT NULL DEFAULT 1200,
  credits INTEGER NOT NULL DEFAULT 5,
  source TEXT NOT NULL DEFAULT 'pack',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at TEXT
);

CREATE TABLE IF NOT EXISTS credit_uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credit_order_id INTEGER NOT NULL REFERENCES credit_orders(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_orders_user ON credit_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_uses_user ON credit_uses(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

/* ---------- v52 : jeu-concours « 20 romans offerts » ---------- */
CREATE TABLE IF NOT EXISTS contest_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  book_slug TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'direct' CHECK (status IN ('direct','draw','winner','lost')),
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/* Un même courriel ne peut s'inscrire qu'une fois. */
CREATE UNIQUE INDEX IF NOT EXISTS idx_contest_email ON contest_entries(lower(email));
CREATE INDEX IF NOT EXISTS idx_contest_position ON contest_entries(position);

/* ---------- Phase 6 : reçus électroniques et service client / réclamations ---------- */
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  book_title TEXT NOT NULL,
  book_slug TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  chapter_title TEXT NOT NULL,
  amount_xof INTEGER NOT NULL DEFAULT 300,
  currency TEXT NOT NULL DEFAULT 'XOF',
  payment_method TEXT NOT NULL DEFAULT 'wave_link',
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','expired','refunded')),
  access_type TEXT NOT NULL DEFAULT 'chapter_30d',
  confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  access_starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_receipts_ref ON receipts(reference);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_number TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  order_reference TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OUVERT' CHECK (status IN ('OUVERT','EN_COURS','EN_ATTENTE','RESOLU','FERME')),
  admin_reply TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_claims_user ON claims(user_id, status);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status, created_at);

/* ---------- Table des leads WhatsApp capturés avant lecture gratuite ---------- */
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'chapter1_gate',
  book_slug TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id, number);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
`);

/* Colonnes ajoutées progressivement (v16) : ignorées si déjà présentes. */
function addColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  if (!existing.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumn('users', 'pen_name', "TEXT NOT NULL DEFAULT ''");
addColumn('users', 'bio', "TEXT NOT NULL DEFAULT ''");
addColumn('users', 'author_status', "TEXT NOT NULL DEFAULT ''");
addColumn('users', 'author_requested_at', 'TEXT');
addColumn('books', 'owner_id', 'INTEGER');
addColumn('books', 'views', 'INTEGER NOT NULL DEFAULT 0');
addColumn('chapters', 'views', 'INTEGER NOT NULL DEFAULT 0');
/* Phase 3 : canal, prestataire, devise, expiration du droit, vérification */
addColumn('orders', 'channel', "TEXT NOT NULL DEFAULT 'WEB_PAYMENT'");
addColumn('orders', 'provider', "TEXT NOT NULL DEFAULT 'manual'");
addColumn('orders', 'currency', "TEXT NOT NULL DEFAULT 'XOF'");
addColumn('orders', 'expires_at', 'TEXT');
addColumn('orders', 'verification_status', "TEXT NOT NULL DEFAULT 'manual'");
/* v53 : archivage d'un chapitre (on dépublie au lieu de supprimer) */
addColumn('chapters', 'archived_at', 'TEXT');
addColumn('chapters', 'archived_reason', "TEXT NOT NULL DEFAULT ''");
/* v22 : pass court, packs de crédits, parrainage */
addColumn('subscriptions', 'plan', "TEXT NOT NULL DEFAULT 'monthly'");
addColumn('subscriptions', 'days', 'INTEGER NOT NULL DEFAULT 30');
addColumn('users', 'referral_code', "TEXT NOT NULL DEFAULT ''");
addColumn('users', 'referred_by', 'INTEGER');
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code) WHERE referral_code <> ''");


export const DEFAULT_SETTINGS = {
  siteName: 'BOOK FOREVER',
  siteTagline: 'Lire · Rêver · Toujours',
  contactEmail: config.defaults.contactEmail,
  contactPhone: config.defaults.contactPhone,
  channelUrl: config.defaults.channelUrl,
  waveLink: config.defaults.waveLink,
  orangeNumber: config.defaults.orangeNumber,
  priceXof: String(config.defaults.priceXof),
  freeChapters: String(config.defaults.freeChapters),
  address: 'Abidjan, Côte d’Ivoire',
  publisher: 'ADISEN — section Littérature',
  waveEnabled: '1',
  orangeEnabled: '1',
  supportHours: 'Lundi – samedi, 8h – 20h',
  /* Paliers du titre d'auteur (v18) */
  authorMinViews: '1000',
  authorMinHearts: '100',
  authorMinFollowers: '50',
  authorCertViews: '10000',
  authorCertHearts: '1000',
  authorCertFollowers: '500',
  /* Offres (v22) : pass court, pack de crédits, abonnement, parrainage */
  monthlyPrice: '2000',
  monthlyDays: '30',
  passPrice: '500',
  passDays: '7',
  packPrice: '1200',
  packCredits: '5',
  vipPrice: '5000',
  vipDays: '30',
  bookFullPrice: '1500',
  accessDays: '30',
  referralTarget: '3',
  referralReward: '1',
  /* Mise en avant éditoriale : un chapitre choisi s'affiche en haut de l'accueil. */
  spotlightBook: '',
  spotlightChapter: '',
  spotlightUntil: '',
};

export function seedSettings() {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insert.run(k, v);
  });
  tx();
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

/** Chapitre mis en avant, uniquement s'il est réellement en ligne et non expiré. */
function spotlightFor(settings) {
  const slug = String(settings.spotlightBook || '').trim();
  const number = Number(settings.spotlightChapter || 0);
  if (!slug || !Number.isInteger(number) || number < 1) return null;
  const until = String(settings.spotlightUntil || '').trim();
  if (until && until < new Date().toISOString().slice(0, 10)) return null;
  const row = db
    .prepare(
      `SELECT b.slug, b.title, b.author, b.cover, b.price_xof,
              c.number, c.title AS chapter_title, c.is_free
         FROM books b JOIN chapters c ON c.book_id = b.id
        WHERE b.slug = ? AND c.number = ? AND b.status = 'published' AND c.status = 'published'`,
    )
    .get(slug, number);
  if (!row) return null;
  return {
    bookSlug: row.slug,
    bookTitle: row.title,
    author: row.author,
    cover: row.cover,
    chapter: row.number,
    chapterTitle: row.chapter_title,
    isFree: Boolean(row.is_free),
    priceXof: row.price_xof,
    until,
  };
}

export function publicSite() {
  const s = getSettings();
  return {
    siteName: s.siteName,
    siteTagline: s.siteTagline,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    channelUrl: s.channelUrl || config.defaults.channelUrl,
    spotlight: spotlightFor(s),
    waveLink: s.waveLink,
    orangeNumber: s.orangeNumber,
    priceXof: Number(s.priceXof),
    freeChapters: Number(s.freeChapters),
    address: s.address,
    publisher: s.publisher,
    waveEnabled: s.waveEnabled === '1',
    orangeEnabled: s.orangeEnabled === '1',
    supportHours: s.supportHours,
    accessDays: numberOr(s.accessDays, 30),
    offers: {
      monthly: { priceXof: numberOr(s.monthlyPrice, 2000), days: numberOr(s.monthlyDays, 30) },
      pass: { priceXof: numberOr(s.passPrice, 500), days: numberOr(s.passDays, 7) },
      pack: { priceXof: numberOr(s.packPrice, 1200), credits: numberOr(s.packCredits, 5) },
      vip: { priceXof: numberOr(s.vipPrice, 5000), days: numberOr(s.vipDays, 30) },
      bookFull: { priceXof: numberOr(s.bookFullPrice, 1500) },
      referral: { target: numberOr(s.referralTarget, 3), reward: numberOr(s.referralReward, 1) },
    },
  };
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/* ------------------------ v22 : offres et crédits ------------------------ */

/** Les trois offres, prêtes à afficher, avec le prix réellement configuré. */
export function offerList() {
  const site = publicSite();
  return {
    accessDays: site.accessDays,
    monthly: site.offers.monthly,
    pass: site.offers.pass,
    pack: site.offers.pack,
    vip: site.offers.vip,
    bookFull: site.offers.bookFull,
    referral: site.offers.referral,
  };
}

/** Crédits encore disponibles (packs validés moins chapitres déjà ouverts). */
export function availableCredits(userId) {
  if (!userId) return 0;
  const row = db
    .prepare(`
      SELECT COALESCE(SUM(co.credits - (
        SELECT COUNT(*) FROM credit_uses cu WHERE cu.credit_order_id = co.id
      )), 0) AS n
      FROM credit_orders co
      WHERE co.user_id = ? AND co.status = 'active'`)
    .get(userId);
  return Math.max(0, Number(row?.n) || 0);
}

/** Chapitres ouverts par un crédit, encore valides, pour un roman donné. */
export function creditChapterIds(userId, bookId) {
  if (!userId) return new Set();
  const rows = db
    .prepare(`SELECT chapter_id FROM credit_uses
              WHERE user_id = ? AND book_id = ?
                AND (expires_at IS NULL OR date(expires_at) >= date('now'))`)
    .all(userId, bookId);
  return new Set(rows.map((r) => r.chapter_id));
}

/** Consomme un crédit sur un chapitre. Renvoie l'identifiant du pack utilisé, ou null. */
export function spendCredit(userId, bookId, chapterId, days = 30) {
  const tx = db.transaction(() => {
    const pack = db
      .prepare(`
        SELECT co.id FROM credit_orders co
        WHERE co.user_id = ? AND co.status = 'active'
          AND (SELECT COUNT(*) FROM credit_uses cu WHERE cu.credit_order_id = co.id) < co.credits
        ORDER BY co.id LIMIT 1`)
      .get(userId);
    if (!pack) return null;
    /* Journal d'utilisation : un chapitre rouvert après expiration consomme un nouveau crédit. */
    db.prepare(`INSERT INTO credit_uses (user_id, credit_order_id, book_id, chapter_id, expires_at)
                VALUES (?, ?, ?, ?, date('now', ?))`)
      .run(userId, pack.id, bookId, chapterId, `+${Math.max(1, Number(days) || 30)} days`);
    return pack.id;
  });
  return tx();
}

/** Crédits offerts (parrainage, geste commercial). */
export function grantCredits(userId, credits, source = 'parrainage', note = '') {
  const amount = Math.max(1, Number(credits) || 1);
  const reference = `BF-GIFT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  db.prepare(`INSERT INTO credit_orders (user_id, reference, method, amount_xof, credits, source, note, status, validated_at)
              VALUES (?, ?, 'offert', 0, ?, ?, ?, 'active', CURRENT_TIMESTAMP)`)
    .run(userId, reference, amount, String(source).slice(0, 40), String(note).slice(0, 200));
  return amount;
}

/** Code de parrainage stable, créé à la première demande. */
export function ensureReferralCode(userId) {
  const row = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(userId);
  if (!row) return '';
  if (row.referral_code) return row.referral_code;
  let code = '';
  do {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
  } while (db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code));
  db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, userId);
  return code;
}

/** Compteurs de partage : total, détail par canal, et part du jour. */
export function shareStats(bookId = null) {
  const where = bookId ? 'WHERE book_id = ?' : '';
  const args = bookId ? [bookId] : [];
  const total = db.prepare(`SELECT COUNT(*) AS n FROM shares ${where}`).get(...args).n;
  const today = db
    .prepare(`SELECT COUNT(*) AS n FROM shares ${where ? `${where} AND` : 'WHERE'} substr(created_at,1,10) = ?`)
    .get(...args, new Date().toISOString().slice(0, 10)).n;
  const channels = db
    .prepare(`SELECT channel, COUNT(*) AS n FROM shares ${where} GROUP BY channel ORDER BY n DESC`)
    .all(...args);
  return { shares: total, sharesToday: today, channels };
}

/**
 * Enregistre un partage. Un même visiteur qui reclique sur « Partager » le même
 * jour pour le même canal ne gonfle pas le compteur : on veut mesurer la
 * diffusion réelle, pas le nombre de clics.
 */
export function recordShare({ bookId = null, userId = null, channel = 'autre', code = '', visitor = '' }) {
  /* Fenêtre calculée par SQLite : Node et SQLite partagent ainsi la même horloge,
     ce qui évite un décalage de fuseau qui rendrait le dédoublonnage inopérant. */
  const already = db
    .prepare(
      `SELECT 1 FROM shares WHERE book_id IS ? AND visitor = ? AND channel = ?
         AND created_at >= datetime('now','-1 day')`,
    )
    .get(bookId, visitor, channel);
  if (!already) {
    db.prepare('INSERT INTO shares (book_id, user_id, channel, code, visitor) VALUES (?, ?, ?, ?, ?)').run(
      bookId,
      userId,
      String(channel || 'autre').slice(0, 20),
      String(code || '').slice(0, 20),
      String(visitor || '').slice(0, 60),
    );
  }
  return { counted: !already, ...shareStats(bookId) };
}

/** Enregistre un filleul et offre un crédit tous les « target » amis invités. */
export function registerReferral(invitedId, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return null;
  const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(code);
  if (!referrer || referrer.id === invitedId) return null;
  if (db.prepare('SELECT 1 FROM referrals WHERE invited_id = ?').get(invitedId)) return null;

  const offers = offerList();
  const target = Math.max(1, offers.referral.target);
  const reward = Math.max(1, offers.referral.reward);

  db.prepare('INSERT INTO referrals (referrer_id, invited_id) VALUES (?, ?)').run(referrer.id, invitedId);
  db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, invitedId);

  const total = db.prepare('SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ?').get(referrer.id).n;
  let gained = 0;
  if (total % target === 0) {
    gained = grantCredits(referrer.id, reward, 'parrainage', `${total} amis invités`);
  }
  return { referrerId: referrer.id, total, gained };
}

export function referralSummary(userId) {
  const code = ensureReferralCode(userId);
  const settings = offerList();
  const target = Math.max(1, settings.referral.target);
  const invited = db.prepare('SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ?').get(userId).n;
  const earned = db
    .prepare("SELECT COALESCE(SUM(credits),0) AS n FROM credit_orders WHERE user_id = ? AND source = 'parrainage'")
    .get(userId).n;
  return {
    code,
    invited,
    target,
    reward: settings.referral.reward,
    earned,
    nextIn: target - (invited % target),
    remainingForReward: invited % target === 0 && invited > 0 ? target : target - (invited % target),
  };
}

export function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

export function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'roman';
}

export function uniqueSlug(base, table = 'books') {
  const stmt = db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`);
  let slug = slugify(base);
  let i = 2;
  while (stmt.get(slug)) {
    slug = `${slugify(base)}-${i++}`;
  }
  return slug;
}

/** Abonnement mensuel en cours (2000 FCFA / 30 jours). */
export function hasActiveSubscription(userId) {
  if (!userId) return false;
  const row = db
    .prepare("SELECT period_end FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
    .get(userId);
  if (!row) return false;
  const end = row.period_end ? String(row.period_end).slice(0, 10) : null;
  if (!end) return true;
  return end >= new Date().toISOString().slice(0, 10);
}

/** Trace chaque démarrage : preuve que le disque persiste d'un déploiement à l'autre. */
/* Uniformise les couvertures : si un équivalent WebP existe à côté du JPEG
   d'origine, on bascule l'enregistrement dessus — même image, deux fois plus
   légère. Idempotent : rien à faire si c'est déjà fait. */
export function normalizeCovers() {
  let updated = 0;
  const rows = db.prepare("SELECT id, cover FROM books WHERE cover LIKE '/media/covers/%.jpg'").all();
  for (const row of rows) {
    const webp = row.cover.replace(/\.jpe?g$/i, '.webp');
    if (!fs.existsSync(path.join(config.publicDir, webp.replace(/^\//, '')))) continue;
    db.prepare('UPDATE books SET cover = ? WHERE id = ?').run(webp, row.id);
    updated += 1;
  }
  return updated;
}

export function recordBoot(dataDir) {
  try {
    db.prepare('INSERT INTO boots (data_dir) VALUES (?)').run(String(dataDir || ''));
  } catch {
    /* la table peut manquer sur une base très ancienne */
  }
}

export function bootStats() {
  try {
    const total = db.prepare('SELECT COUNT(*) AS total FROM boots').get().total;
    const first = db.prepare('SELECT started_at FROM boots ORDER BY id LIMIT 1').get();
    return { boots: total, firstBoot: first?.started_at || null };
  } catch {
    return { boots: 0, firstBoot: null };
  }
}


/* ---------------------------- Jeu-concours ------------------------------- */

export function contestStats() {
  const total = db.prepare('SELECT COUNT(*) AS n FROM contest_entries').get().n;
  const directTaken = db
    .prepare("SELECT COUNT(*) AS n FROM contest_entries WHERE status = 'direct'")
    .get().n;
  return { total, directTaken, remaining: Math.max(0, CONTEST.directPlaces - directTaken) };
}

export function createContestEntry({ name, email, phone, bookSlug }) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM contest_entries').get().n;
  const position = total + 1;
  const status = position <= CONTEST.directPlaces ? 'direct' : 'draw';
  /* Code lisible au téléphone : BF10- + 4 caractères + la place. */
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const code = `BF10-${suffix}${position}`;
  db.prepare(
    `INSERT INTO contest_entries (name, email, phone, book_slug, position, status, code)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(name, email.toLowerCase(), phone, bookSlug, position, status, code);
  return { position, status, code };
}

export function listContestEntries() {
  return db.prepare('SELECT * FROM contest_entries ORDER BY position ASC').all();
}

/* -------------------------------------------------------------------------- */
/*                     Phase 6 : Reçus et Réclamations                        */
/* -------------------------------------------------------------------------- */

export function generateReceiptForOrder(orderId) {
  const order = db
    .prepare(`
      SELECT o.*, b.title AS book_title, b.slug AS book_slug,
             c.number AS chapter_number, c.title AS chapter_title,
             u.id AS user_id, u.email AS user_email, u.name AS user_name
      FROM orders o
      JOIN books b ON b.id = o.book_id
      JOIN chapters c ON c.id = o.chapter_id
      JOIN users u ON u.id = o.user_id
      WHERE o.id = ?`)
    .get(orderId);
  if (!order) return null;

  const existing = db.prepare('SELECT * FROM receipts WHERE order_id = ?').get(orderId);
  if (existing) return existing;

  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  const receiptNumber = `BF-REC-${year}-${String(order.id).padStart(4, '0')}-${hex}`;
  const confirmedAt = order.validated_at || new Date().toISOString();
  const accessStartsAt = confirmedAt;
  const accessDays = Math.max(1, Number(getSettings().accessDays) || 30);
  const expiresAt =
    order.expires_at ||
    new Date(new Date(confirmedAt).getTime() + accessDays * 24 * 3600 * 1000).toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO receipts (
      receipt_number, order_id, user_id, reference, book_title, book_slug,
      chapter_number, chapter_title, amount_xof, currency, payment_method,
      status, access_type, confirmed_at, access_starts_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'XOF', ?, 'confirmed', 'chapter_30d', ?, ?, ?)
  `).run(
    receiptNumber,
    order.id,
    order.user_id,
    order.reference,
    order.book_title,
    order.book_slug,
    order.chapter_number,
    order.chapter_title,
    order.amount_xof,
    order.method,
    confirmedAt,
    accessStartsAt,
    expiresAt,
  );

  return db.prepare('SELECT * FROM receipts WHERE receipt_number = ?').get(receiptNumber);
}

export function listUserReceipts(userId, status = '', search = '') {
  let query = 'SELECT * FROM receipts WHERE user_id = ?';
  const params = [userId];

  if (status && ['confirmed', 'expired', 'refunded'].includes(status)) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (reference LIKE ? OR receipt_number LIKE ? OR book_title LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY created_at DESC, id DESC';
  return db.prepare(query).all(...params);
}

export function createClaim({ userId, category, orderReference = '', subject = '', message }) {
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  const count = db.prepare('SELECT COUNT(*) AS total FROM claims').get().total + 1;
  const claimNumber = `REC-${year}-${String(count).padStart(4, '0')}-${hex}`;

  db.prepare(`
    INSERT INTO claims (claim_number, user_id, category, order_reference, subject, message, status)
    VALUES (?, ?, ?, ?, ?, ?, 'OUVERT')
  `).run(
    claimNumber,
    userId,
    String(category || 'autre').slice(0, 50),
    String(orderReference || '').slice(0, 60),
    String(subject || '').slice(0, 160),
    String(message || '').slice(0, 5000),
  );

  return db.prepare('SELECT * FROM claims WHERE claim_number = ?').get(claimNumber);
}

export function listUserClaims(userId) {
  return db.prepare('SELECT * FROM claims WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(userId);
}

export function listAdminClaims(status = '') {
  let query = `
    SELECT c.*, u.email AS user_email, u.name AS user_name
    FROM claims c
    JOIN users u ON u.id = c.user_id`;
  const params = [];
  if (status) {
    query += ' WHERE c.status = ?';
    params.push(status);
  }
  query += " ORDER BY CASE c.status WHEN 'OUVERT' THEN 0 WHEN 'EN_COURS' THEN 1 WHEN 'EN_ATTENTE' THEN 2 ELSE 3 END, c.created_at DESC";
  return db.prepare(query).all(...params);
}

/* -------------------------------------------------------------------------- */
/*                     Capture de Leads WhatsApp                              */
/* -------------------------------------------------------------------------- */

export function saveLead({ phone, source = 'chapter1_gate', bookSlug = '', ip = '' }) {
  const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
  if (!cleanPhone) return null;
  const existing = db.prepare('SELECT * FROM leads WHERE phone = ?').get(cleanPhone);
  if (existing) return existing;

  const info = db.prepare(`
    INSERT INTO leads (phone, source, book_slug, ip)
    VALUES (?, ?, ?, ?)
  `).run(cleanPhone, String(source).slice(0, 50), String(bookSlug).slice(0, 100), String(ip).slice(0, 60));

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
}

export function listLeads(limit = 200) {
  return db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT ?').all(limit);
}
