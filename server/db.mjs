import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import config from './config.mjs';


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


export const DEFAULT_SETTINGS = {
  siteName: 'BOOK FOREVER',
  siteTagline: 'Lire · Rêver · Toujours',
  contactEmail: config.defaults.contactEmail,
  contactPhone: config.defaults.contactPhone,
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

export function publicSite() {
  const s = getSettings();
  return {
    siteName: s.siteName,
    siteTagline: s.siteTagline,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    waveLink: s.waveLink,
    orangeNumber: s.orangeNumber,
    priceXof: Number(s.priceXof),
    freeChapters: Number(s.freeChapters),
    address: s.address,
    publisher: s.publisher,
    waveEnabled: s.waveEnabled === '1',
    orangeEnabled: s.orangeEnabled === '1',
    supportHours: s.supportHours,
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
