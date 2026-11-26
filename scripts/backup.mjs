#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, getSettings } from '../server/db.mjs';
import config from '../server/config.mjs';

/**
 * Script de sauvegarde externe des données critiques de BOOK FOREVER
 * Exporte : Romans, Chapitres, Commandes, Reçus, Réclamations, Profils Auteurs, Progrès de lecture.
 * Exclut : Secrets d'authentification serveur et hashs sensibles d'administration.
 */

const outputDir = path.join(process.cwd(), 'backups');
fs.mkdirSync(outputDir, { recursive: true });

const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');
const backupFilename = `backup-book-forever-${timestamp}.json`;
const backupFilePath = path.join(outputDir, backupFilename);

console.log('[Backup] Démarrage de la sauvegarde externe...');

const books = db.prepare('SELECT * FROM books ORDER BY id').all();
const chapters = db.prepare('SELECT * FROM chapters ORDER BY book_id, number').all();
const orders = db.prepare('SELECT * FROM orders ORDER BY id').all();
const receipts = db.prepare('SELECT * FROM receipts ORDER BY id').all();
const claims = db.prepare('SELECT * FROM claims ORDER BY id').all();
const progress = db.prepare('SELECT * FROM progress ORDER BY id').all();
const subscriptions = db.prepare('SELECT * FROM subscriptions ORDER BY id').all();
const creditOrders = db.prepare('SELECT * FROM credit_orders ORDER BY id').all();
const creditUses = db.prepare('SELECT * FROM credit_uses ORDER BY id').all();
const favorites = db.prepare('SELECT * FROM favorites ORDER BY id').all();

// Utilisateurs : on exporte les profils publics et métadonnées en préservant l'intégrité sans exposer les secrets
const users = db.prepare(`
  SELECT id, email, name, role, pen_name, bio, author_status, author_requested_at, referral_code, referred_by, created_at
  FROM users
  ORDER BY id
`).all();

const settings = getSettings();

const payload = {
  version: '1.0.0',
  createdAt: now.toISOString(),
  environment: process.env.NODE_ENV || 'production',
  tables: {
    books,
    chapters,
    orders,
    receipts,
    claims,
    progress,
    subscriptions,
    creditOrders,
    creditUses,
    favorites,
    users,
    settings,
  },
  counts: {
    books: books.length,
    chapters: chapters.length,
    orders: orders.length,
    receipts: receipts.length,
    claims: claims.length,
    users: users.length,
  },
};

const jsonContent = JSON.stringify(payload, null, 2);
const checksum = crypto.createHash('sha256').update(jsonContent).digest('hex');

const finalData = {
  checksum,
  ...payload,
};

fs.writeFileSync(backupFilePath, JSON.stringify(finalData, null, 2), 'utf-8');

console.log(`[Backup] ✅ Sauvegarde réussie dans : ${backupFilePath}`);
console.log(`[Backup] 📊 Statistiques : ${books.length} romans, ${chapters.length} chapitres, ${orders.length} commandes, ${receipts.length} reçus, ${claims.length} réclamations.`);
console.log(`[Backup] 🔒 SHA-256 Checksum : ${checksum}`);
