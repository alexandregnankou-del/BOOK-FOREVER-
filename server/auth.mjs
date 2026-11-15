import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.mjs';
import config from './config.mjs';

const COOKIE = 'bf_session';

export function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}

export function createUser({ email, password, name = '', role = 'reader' }) {
  const info = db
    .prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
    .run(String(email).trim(), hashPassword(password), name, role);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
}

export function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(String(email || '').trim());
}

export function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.created_at };
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '30d' });
}

export function setSession(res, user) {
  res.cookie(COOKIE, signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 30 * 24 * 3600 * 1000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function currentUser(req) {
  const header = req.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const token = req.cookies?.[COOKIE] || bearer;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) || null;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Connexion requise.' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Connexion requise.' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé à l’administrateur.' });
  req.user = user;
  next();
}

export function ensureAdmin() {
  const existing = findByEmail(config.adminEmail);
  if (existing) {
    if (existing.role !== 'admin') {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
    }
    return existing.id;
  }
  const created = createUser({
    email: config.adminEmail,
    password: config.adminPassword,
    name: config.adminName,
    role: 'admin',
  });
  return created.id;
}
