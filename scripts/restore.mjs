#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../server/db.mjs';

/**
 * Script de restauration de données BOOK FOREVER
 * Usage : node scripts/restore.mjs [chemin_du_fichier_backup.json]
 */

const backupArg = process.argv[2];
if (!backupArg) {
  console.error('Usage : node scripts/restore.mjs <chemin_du_fichier_backup.json>');
  process.exit(1);
}

const backupPath = path.resolve(backupArg);
if (!fs.existsSync(backupPath)) {
  console.error(`Erreur : Fichier introuvable à ${backupPath}`);
  process.exit(1);
}

console.log(`[Restore] Lecture du fichier : ${backupPath}`);
const raw = fs.readFileSync(backupPath, 'utf-8');
const backup = JSON.parse(raw);

// Vérification d'intégrité
const { checksum, ...payload } = backup;
const calculatedChecksum = crypto.createHash('sha256').update(JSON.stringify(payload, null, 2)).digest('hex');

if (checksum && checksum !== calculatedChecksum) {
  console.warn(`[Restore] ⚠️ Avertissement : Le checksum du fichier (${checksum}) diffère du calcul (${calculatedChecksum}).`);
} else {
  console.log('[Restore] 🔒 Checksum d’intégrité validé avec succès.');
}

const tables = backup.tables;
if (!tables) {
  console.error('Erreur : Structure de backup invalide.');
  process.exit(1);
}

console.log('[Restore] Début de la restauration transactionnelle...');

db.pragma('foreign_keys = OFF');

const restoreTx = db.transaction(() => {
  // Restauration des romans
  if (tables.books && tables.books.length > 0) {
    const insertBook = db.prepare(`
      INSERT OR REPLACE INTO books (id, slug, title, author, tagline, synopsis, cover, category_slug, category_name, price_xof, free_chapters, status, download_allowed, sort_order, created_at, updated_at)
      VALUES (@id, @slug, @title, @author, @tagline, @synopsis, @cover, @category_slug, @category_name, @price_xof, @free_chapters, @status, @download_allowed, @sort_order, @created_at, @updated_at)
    `);
    for (const b of tables.books) insertBook.run(b);
  }

  // Restauration des chapitres
  if (tables.chapters && tables.chapters.length > 0) {
    const insertChapter = db.prepare(`
      INSERT OR REPLACE INTO chapters (id, book_id, number, title, text, is_free, words, status, created_at, updated_at)
      VALUES (@id, @book_id, @number, @title, @text, @is_free, @words, @status, @created_at, @updated_at)
    `);
    for (const c of tables.chapters) insertChapter.run(c);
  }

  // Restauration des commandes
  if (tables.orders && tables.orders.length > 0) {
    const insertOrder = db.prepare(`
      INSERT OR REPLACE INTO orders (id, reference, user_id, book_id, chapter_id, amount_xof, method, status, provider_ref, note, created_at, validated_at)
      VALUES (@id, @reference, @user_id, @book_id, @chapter_id, @amount_xof, @method, @status, @provider_ref, @note, @created_at, @validated_at)
    `);
    for (const o of tables.orders) insertOrder.run(o);
  }

  // Restauration des reçus
  if (tables.receipts && tables.receipts.length > 0) {
    const insertReceipt = db.prepare(`
      INSERT OR REPLACE INTO receipts (id, receipt_number, order_id, user_id, reference, book_title, book_slug, chapter_number, chapter_title, amount_xof, currency, payment_method, status, access_type, confirmed_at, access_starts_at, expires_at, created_at)
      VALUES (@id, @receipt_number, @order_id, @user_id, @reference, @book_title, @book_slug, @chapter_number, @chapter_title, @amount_xof, @currency, @payment_method, @status, @access_type, @confirmed_at, @access_starts_at, @expires_at, @created_at)
    `);
    for (const r of tables.receipts) insertReceipt.run(r);
  }

  // Restauration des réclamations
  if (tables.claims && tables.claims.length > 0) {
    const insertClaim = db.prepare(`
      INSERT OR REPLACE INTO claims (id, claim_number, user_id, category, order_reference, subject, message, status, admin_reply, created_at, updated_at, resolved_at)
      VALUES (@id, @claim_number, @user_id, @category, @order_reference, @subject, @message, @status, @admin_reply, @created_at, @updated_at, @resolved_at)
    `);
    for (const cl of tables.claims) insertClaim.run(cl);
  }
});

restoreTx();
db.pragma('foreign_keys = ON');

console.log('[Restore] ✅ Restauration terminée avec succès.');
