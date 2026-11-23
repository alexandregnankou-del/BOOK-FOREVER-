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
paymentRoutes.post('/webhook/wave', express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), (req, res) => {
  const signature = req.headers['wave-signature'];
  const webhookSecret = process.env.WAVE_WEBHOOK_SECRET;

  if (webhookSecret && signature && req.rawBody) {
    const hmac = crypto.createHmac('sha256', webhookSecret).update(req.rawBody).digest('hex');
    if (hmac !== signature) {
      console.warn('[Wave Webhook] Signature invalide');
      return res.status(401).json({ error: 'Signature invalide' });
    }
  }

  const event = req.body;
  if (event?.type === 'checkout.session.completed') {
    const session = event.data?.object || event.data;
    const clientRef = session?.client_reference;
    if (clientRef) {
      const order = db.prepare('SELECT * FROM orders WHERE reference = ?').get(clientRef);
      if (order && order.status !== 'paid') {
        const accessDays = Math.max(1, Number(getSettings().accessDays) || 30);
        db.prepare(`
          UPDATE orders
          SET status = 'paid', provider = 'wave_api', validated_at = CURRENT_TIMESTAMP,
              expires_at = date('now', '+' || ? || ' days'),
              verification_status = 'wave_webhook_verified'
          WHERE id = ?
        `).run(accessDays, order.id);

        generateReceiptForOrder(order.id);

        if (order.note && order.note.includes('Intégrale')) {
          const allChapters = db.prepare("SELECT id FROM chapters WHERE book_id = ? AND is_free = 0 AND status = 'published'").all(order.book_id);
          for (const ch of allChapters) {
            if (ch.id !== order.chapter_id) {
              db.prepare(`
                INSERT OR REPLACE INTO orders (reference, user_id, book_id, chapter_id, amount_xof, method, status, validated_at, expires_at, note)
                VALUES (?, ?, ?, ?, 0, 'wave_api', 'paid', CURRENT_TIMESTAMP, date('now', '+' || ? || ' days'), 'Inclus dans Intégrale')
              `).run(`${order.reference}-CH${ch.id}`, order.user_id, order.book_id, ch.id, accessDays);
            }
          }
        }
        console.log(`[Wave Webhook] Commande ${order.reference} validée automatiquement.`);
      }
    }
  }

  res.status(200).json({ received: true });
});

/**
 * Webhook IPN CinetPay
 */
paymentRoutes.post('/webhook/cinetpay', async (req, res) => {
  const { cpm_trans_id, cpm_site_id, cpm_trans_status } = req.body || {};
  if (!cpm_trans_id) return res.status(400).json({ error: 'Identifiant de transaction manquant' });

  const cinetpayApiKey = process.env.CINETPAY_API_KEY;
  const cinetpaySiteId = process.env.CINETPAY_SITE_ID;

  let isVerified = false;
  if (cinetpayApiKey && cinetpaySiteId) {
    try {
      const checkResp = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: cinetpayApiKey,
          site_id: cinetpaySiteId,
          transaction_id: cpm_trans_id,
        }),
      });
      const checkData = await checkResp.json();
      if (checkData.code === '00' && checkData.data?.status === 'ACCEPTED') {
        isVerified = true;
      }
    } catch (err) {
      console.error('[CinetPay Check Error]', err);
    }
  } else if (cpm_trans_status === 'ACCEPTED') {
    isVerified = true;
  }

  if (isVerified) {
    const order = db.prepare('SELECT * FROM orders WHERE reference = ?').get(cpm_trans_id);
    if (order && order.status !== 'paid') {
      const accessDays = Math.max(1, Number(getSettings().accessDays) || 30);
      db.prepare(`
        UPDATE orders
        SET status = 'paid', provider = 'cinetpay', validated_at = CURRENT_TIMESTAMP,
            expires_at = date('now', '+' || ? || ' days'),
            verification_status = 'cinetpay_ipn_verified'
        WHERE id = ?
      `).run(accessDays, order.id);

      generateReceiptForOrder(order.id);

      if (order.note && order.note.includes('Intégrale')) {
        const allChapters = db.prepare("SELECT id FROM chapters WHERE book_id = ? AND is_free = 0 AND status = 'published'").all(order.book_id);
        for (const ch of allChapters) {
          if (ch.id !== order.chapter_id) {
            db.prepare(`
              INSERT OR REPLACE INTO orders (reference, user_id, book_id, chapter_id, amount_xof, method, status, validated_at, expires_at, note)
              VALUES (?, ?, ?, ?, 0, 'cinetpay', 'paid', CURRENT_TIMESTAMP, date('now', '+' || ? || ' days'), 'Inclus dans Intégrale')
            `).run(`${order.reference}-CH${ch.id}`, order.user_id, order.book_id, ch.id, accessDays);
          }
        }
      }
      console.log(`[CinetPay Webhook] Commande ${order.reference} validée automatiquement.`);
    }
  }

  res.status(200).json({ received: true });
});
