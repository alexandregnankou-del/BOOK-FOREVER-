import express from 'express';
import crypto from 'node:crypto';
import { db, getSettings, generateReceiptForOrder } from '../db.mjs';
import config from '../config.mjs';

export const paymentRoutes = express.Router();

/**
 * Normalisation et validation du numéro ivoirien
 * Doit comporter 10 chiffres et commencer par 01, 05 ou 07
 */
export function normalizeIvorianPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^0-9]/g, '');
  // Format international avec 0 inclus : 22507XXXXXXXX (13 chiffres)
  if (digits.length === 13 && digits.startsWith('225')) {
    const local = digits.slice(3);
    if (/^(01|05|07)\d{8}$/.test(local)) return local;
  }
  // Format international sans 0 : 2257XXXXXXXX (12 chiffres)
  if (digits.length === 12 && digits.startsWith('225')) {
    const local = '0' + digits.slice(3);
    if (/^(01|05|07)\d{8}$/.test(local)) return local;
  }
  // Format local : 10 chiffres (07XXXXXXXX, 05XXXXXXXX, 01XXXXXXXX)
  if (digits.length === 10 && /^(01|05|07)\d{8}$/.test(digits)) {
    return digits;
  }
  return null;
}

/**
 * Initialisation d'une session de paiement automatisé Wave ou CinetPay
 */
paymentRoutes.post('/checkout', async (req, res) => {
  const { reference, provider = 'wave' } = req.body || {};
  if (!reference) return res.status(400).json({ error: 'Référence de commande requise.' });

  const order = db.prepare('SELECT o.*, b.title AS book_title, c.title AS chapter_title, c.number AS chapter_number, b.slug AS book_slug FROM orders o JOIN books b ON b.id = o.book_id JOIN chapters c ON c.id = o.chapter_id WHERE o.reference = ?').get(reference);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  if (order.status === 'paid') return res.status(400).json({ error: 'Cette commande est déjà réglée.' });

  const settings = getSettings();
  const amount = order.amount_xof;
  const successUrl = `${config.baseUrl || 'https://book-forever.onrender.com'}/lire/${order.book_slug}/${order.chapter_number}?paid=1&ref=${order.reference}`;
  const cancelUrl = `${config.baseUrl || 'https://book-forever.onrender.com'}/lire/${order.book_slug}/${order.chapter_number}?canceled=1`;

  // 1. Intégration Wave Checkout
  if (provider === 'wave' || provider === 'wave_api') {
    const waveApiKey = process.env.WAVE_API_KEY;
    if (waveApiKey) {
      try {
        const response = await fetch('https://api.wave.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${waveApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: String(amount),
            currency: 'XOF',
            error_url: cancelUrl,
            success_url: successUrl,
            client_reference: order.reference,
          }),
        });
        const session = await response.json();
        if (session.wave_launch_url) {
          return res.json({
            ok: true,
            provider: 'wave',
            launchUrl: session.wave_launch_url,
            sessionId: session.id,
          });
        }
      } catch (err) {
        console.error('[Wave API Error]', err);
      }
    }

    // Fallback Wave Direct Link configuré dans les réglages
    const waveDirectLink = settings.waveLink || 'https://wave.com/m/M_082F_oB2fT3g';
    return res.json({
      ok: true,
      provider: 'wave_link',
      launchUrl: waveDirectLink,
      reference: order.reference,
      amount,
      instructions: `Effectuez votre transfert de ${amount} FCFA sur Wave en indiquant la référence ${order.reference}.`,
    });
  }

  // 2. Intégration CinetPay
  if (provider === 'cinetpay') {
    const cinetpayApiKey = process.env.CINETPAY_API_KEY;
    const cinetpaySiteId = process.env.CINETPAY_SITE_ID;
    if (cinetpayApiKey && cinetpaySiteId) {
      try {
        const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apikey: cinetpayApiKey,
            site_id: cinetpaySiteId,
            transaction_id: order.reference,
            amount: amount,
            currency: 'XOF',
            description: `Achat ${order.book_title} - Chapitre ${order.chapter_number}`,
            return_url: successUrl,
            notify_url: `${config.baseUrl || 'https://book-forever.onrender.com'}/api/payments/webhook/cinetpay`,
            channels: 'ALL',
          }),
        });
        const data = await response.json();
        if (data.code === '201' && data.data?.payment_url) {
          return res.json({
            ok: true,
            provider: 'cinetpay',
            launchUrl: data.data.payment_url,
            paymentToken: data.data.payment_token,
          });
        }
      } catch (err) {
        console.error('[CinetPay API Error]', err);
      }
    }

    // Fallback Orange Money / Mobile Money manuel
    return res.json({
      ok: true,
      provider: 'orange_manual',
      orangeNumber: settings.orangeNumber || '0706486904',
      reference: order.reference,
      amount,
      instructions: `Transférez ${amount} FCFA au ${settings.orangeNumber || '0706486904'} avec le motif ${order.reference}.`,
    });
  }

  res.status(400).json({ error: 'Prestataire de paiement non pris en charge.' });
});

/**
 * Commande et micro-paiement direct pour lecteur invité (sans mot de passe requis)
 */
paymentRoutes.post('/guest-checkout', async (req, res) => {
  const { bookSlug, chapterNumber = 3, method = 'wave_link', isFull = false } = req.body || {};
  const book = db.prepare("SELECT id, title, slug, price_xof FROM books WHERE slug = ? AND status = 'published'").get(bookSlug);
  if (!book) return res.status(404).json({ error: 'Roman introuvable.' });

  const chapter = db.prepare('SELECT id, number, title FROM chapters WHERE book_id = ? AND number = ?').get(book.id, Number(chapterNumber));
  if (!chapter) return res.status(404).json({ error: 'Chapitre introuvable.' });

  const settings = getSettings();
  const amount = isFull ? Number(settings.bookFullPrice || 1500) : (chapter.price_xof || Number(settings.priceXof || 300));
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  const year = new Date().getFullYear();
  const reference = isFull ? `BF-FULL-GUEST-${year}-${hex}` : `BF-GUEST-${year}-${hex}`;

  let guestUser = db.prepare("SELECT id FROM users WHERE email = 'guest@book-forever.local'").get();
  if (!guestUser) {
    const info = db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES ('guest@book-forever.local', 'GUEST_NO_LOGIN', 'Lecteur Invité', 'reader')").run();
    guestUser = { id: info.lastInsertRowid };
  }

  const note = isFull ? `Intégrale invité ${book.title}` : `Chapitre ${chapter.number} invité`;
  db.prepare(`
    INSERT INTO orders (reference, user_id, book_id, chapter_id, amount_xof, method, status, note)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(reference, guestUser.id, book.id, chapter.id, amount, method, note);

  const waveDirectLink = settings.waveLink || 'https://wave.com/m/M_082F_oB2fT3g';
  const launchUrl = `${waveDirectLink}?amount=${amount}&memo=${reference}`;

  res.status(201).json({
    ok: true,
    order: { reference, amountXof: amount, method, status: 'pending' },
    launchUrl,
    instructions: {
      reference,
      amountXof: amount,
      number: settings.orangeNumber || '0706486904',
      steps: [
        `Ouvrez Wave ou Orange Money et effectuez un transfert de ${amount} FCFA.`,
        `Indiquez impérativement la référence « ${reference} » dans le motif/commentaire.`,
        `Dès réception, votre chapitre se débloque automatiquement sans recharger la page.`,
      ],
      url: launchUrl,
    },
  });
});

/**
 * Webhook Wave Business Checkout
 * Événement : checkout.session.completed
 */
/** Comparaison en temps constant, pour ne pas fuiter la signature attendue. */
function memeSignature(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (x.length === 0 || x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

/** Débloque la commande une seule fois. Renvoie true si c'est bien cette requête qui a payé. */
function marquerPayee(order, provider, verificationStatus) {
  const accessDays = Math.max(1, Number(getSettings().accessDays) || 30);
  /* v55 : achat définitif par défaut → expires_at NULL. */
  const permanentAccess = process.env.PURCHASE_ACCESS !== 'days';
  const expiration = permanentAccess ? 'NULL' : "date('now', '+' || ? || ' days')";
  const params = permanentAccess
    ? [provider, verificationStatus, order.id]
    : [provider, accessDays, verificationStatus, order.id];

  const info = db
    .prepare(
      `UPDATE orders
          SET status = 'paid', provider = ?, validated_at = CURRENT_TIMESTAMP,
              expires_at = ${expiration}, verification_status = ?
        WHERE id = ? AND status != 'paid'`,
    )
    .run(...params);

  if (info.changes === 0) return false;

  generateReceiptForOrder(order.id);

  if (order.note && order.note.includes('Intégrale')) {
    const chapitres = db
      .prepare("SELECT id FROM chapters WHERE book_id = ? AND is_free = 0 AND status = 'published'")
      .all(order.book_id);
    for (const ch of chapitres) {
      if (ch.id === order.chapter_id) continue;
      db.prepare(
        `INSERT OR IGNORE INTO orders
           (reference, user_id, book_id, chapter_id, amount_xof, method, status, validated_at, expires_at, note)
         VALUES (?, ?, ?, ?, 0, ?, 'paid', CURRENT_TIMESTAMP, ${expiration}, 'Inclus dans Intégrale')`,
      ).run(...(permanentAccess
        ? [`${order.reference}-CH${ch.id}`, order.user_id, order.book_id, ch.id, provider]
        : [`${order.reference}-CH${ch.id}`, order.user_id, order.book_id, ch.id, provider, accessDays]));
    }
  }
  return true;
}

/**
 * Vérifie que le prestataire annonce bien le montant et la devise attendus.
 * Échoue fermé : si le champ est absent, on refuse.
 */
function montantConforme(order, montantRecu, deviseRecue) {
  const attendu = Number(order.amount_xof);
  const recu = Number(montantRecu);
  if (!Number.isFinite(recu)) return { ok: false, raison: 'montant absent' };
  if (recu !== attendu) return { ok: false, raison: `montant ${recu} au lieu de ${attendu}` };
  const devise = String(deviseRecue || '').toUpperCase();
  if (!devise) return { ok: false, raison: 'devise absente' };
  if (devise !== 'XOF') return { ok: false, raison: `devise ${devise}` };
  return { ok: true };
}

/**
 * Webhook Wave.
 * Échoue fermé : sans secret configuré, le receveur est inactif (503).
 * Sans signature, ou avec une signature qui ne correspond pas : 401.
 */
paymentRoutes.post(
  '/webhook/wave',
  (req, res) => {
    const secret = process.env.WAVE_WEBHOOK_SECRET;
    if (!secret) {
      console.warn('[Wave Webhook] Receveur inactif : WAVE_WEBHOOK_SECRET absent.');
      return res.status(503).json({ error: 'Webhook non configuré.' });
    }

    const signature = req.headers['wave-signature'];
    if (!signature || !req.rawBody) {
      console.warn('[Wave Webhook] Requête sans signature.');
      return res.status(401).json({ error: 'Signature absente.' });
    }

    const attendu = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    if (!memeSignature(attendu, signature)) {
      console.warn('[Wave Webhook] Signature invalide.');
      return res.status(401).json({ error: 'Signature invalide.' });
    }

    const event = req.body || {};
    if (event.type !== 'checkout.session.completed') {
      return res.status(200).json({ received: true, ignored: 'type inattendu' });
    }

    const session = event.data?.object || event.data || {};
    const reference = session.client_reference;
    if (!reference) return res.status(200).json({ received: true, ignored: 'sans référence' });

    const order = db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference);
    if (!order) return res.status(200).json({ received: true, ignored: 'commande inconnue' });

    const controle = montantConforme(order, session.amount, session.currency);
    if (!controle.ok) {
      console.warn(`[Wave Webhook] Rejeté (${reference}) : ${controle.raison}`);
      return res.status(409).json({ error: 'Montant ou devise incohérent.', detail: controle.raison });
    }

    if (!marquerPayee(order, 'wave_api', 'wave_webhook_verified')) {
      return res.status(200).json({ received: true, alreadyPaid: true });
    }

    console.log(`[Wave Webhook] Commande ${order.reference} validée automatiquement.`);
    return res.status(200).json({ received: true, paid: true });
  },
);

/**
 * Webhook CinetPay.
 * Échoue fermé : sans clés API configurées, le receveur est inactif (503).
 * Le statut annoncé dans le corps n'est jamais cru : on réinterroge CinetPay.
 */
paymentRoutes.post('/webhook/cinetpay', async (req, res) => {
  const cpm_trans_id = String(req.body?.cpm_trans_id || '');
  if (!cpm_trans_id) return res.status(400).json({ error: 'Identifiant de transaction manquant.' });

  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apiKey || !siteId) {
    console.warn('[CinetPay Webhook] Receveur inactif : clés API absentes.');
    return res.status(503).json({ error: 'CinetPay non configuré.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE reference = ?').get(cpm_trans_id);
  if (!order) return res.status(200).json({ received: true, ignored: 'commande inconnue' });

  let checkData = null;
  try {
    const checkResp = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: apiKey, site_id: siteId, transaction_id: cpm_trans_id }),
    });
    checkData = await checkResp.json();
  } catch (err) {
    console.error('[CinetPay Check Error]', err);
    return res.status(502).json({ error: 'Vérification impossible auprès du prestataire.' });
  }

  const donnees = checkData?.data || {};
  if (checkData?.code !== '00' || donnees.status !== 'ACCEPTED') {
    return res.status(202).json({ received: true, verified: false, status: donnees.status || null });
  }

  const controle = montantConforme(order, donnees.amount, donnees.currency);
  if (!controle.ok) {
    console.warn(`[CinetPay Webhook] Rejeté (${cpm_trans_id}) : ${controle.raison}`);
    return res.status(409).json({ error: 'Montant ou devise incohérent.', detail: controle.raison });
  }

  if (!marquerPayee(order, 'cinetpay', 'cinetpay_ipn_verified')) {
    return res.status(200).json({ received: true, alreadyPaid: true });
  }

  console.log(`[CinetPay Webhook] Commande ${order.reference} validée automatiquement.`);
  return res.status(200).json({ received: true, paid: true });
});
