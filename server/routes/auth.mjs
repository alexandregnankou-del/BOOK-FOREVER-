import express from 'express';
import bcrypt from 'bcryptjs';
import { db, registerReferral } from '../db.mjs';
import { createUser, findByEmail, publicUser, setSession, clearSession, currentUser, hashPassword } from '../auth.mjs';

export const authRoutes = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- v50 : anti-force brute sur la connexion ----------
   10 échecs pour un même couple adresse + e-mail sur 15 minutes. En mémoire :
   le compteur repart de zéro au redémarrage, ce qui suffit à rendre une
   attaque par dictionnaire impraticable. */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map();

function loginKey(req, email) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip || 'inconnu';
  return `${ip}|${String(email || '').toLowerCase()}`;
}

function loginBlocked(key) {
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginFailures.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function noteLoginFailure(key) {
  const entry = loginFailures.get(key);
  if (!entry || Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
  if (loginFailures.size > 5000) loginFailures.clear();
}

authRoutes.post('/register', (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  if (findByEmail(email)) return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse. Connectez-vous.' });
  const user = createUser({ email, password, name: name || email.split('@')[0] });
  /* Parrainage : le code est facultatif, un code inconnu n'empêche pas l'inscription. */
  let referral = null;
  try {
    referral = registerReferral(user.id, req.body?.ref);
  } catch (err) {
    console.error('[parrainage]', err.message);
  }
  setSession(res, user);
  res.status(201).json({ user: publicUser(user), referral: referral || null });
});

authRoutes.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  const key = loginKey(req, email);
  if (loginBlocked(key)) {
    return res.status(429).json({
      error: 'Trop de tentatives. Réessayez dans un quart d’heure.',
    });
  }
  const user = findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    noteLoginFailure(key);
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
  }
  loginFailures.delete(key);
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

authRoutes.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRoutes.get('/me', (req, res) => {
  const user = currentUser(req);
  res.json({ user: publicUser(user) });
});

authRoutes.post('/password', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Connexion requise.' });
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  if (!bcrypt.compareSync(current, user.password_hash)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
  }
  if (next.length < 8) return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
  res.json({ ok: true, message: 'Mot de passe mis à jour.' });
});
