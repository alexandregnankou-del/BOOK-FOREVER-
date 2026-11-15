import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.mjs';
import { createUser, findByEmail, publicUser, setSession, clearSession, currentUser, hashPassword } from '../auth.mjs';

export const authRoutes = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRoutes.post('/register', (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  if (findByEmail(email)) return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse. Connectez-vous.' });
  const user = createUser({ email, password, name: name || email.split('@')[0] });
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

authRoutes.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  const user = findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
  }
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
