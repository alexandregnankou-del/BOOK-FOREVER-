/**
 * Limiteur de débit en mémoire, sans dépendance.
 *
 * Sur l'offre gratuite de Render, le service redémarre souvent : un compteur en
 * mémoire n'est pas parfait, mais il suffit à rendre inexploitable l'envoi massif
 * de messages ou la création de comptes en série depuis une même adresse.
 */
export function rateLimiter({ windowMs = 10 * 60 * 1000, max = 5, name = 'default' } = {}) {
  const hits = new Map();

  return function limiter(req, res, next) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.ip || 'inconnu';
    const key = `${name}|${ip}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.firstAt > windowMs) {
      hits.set(key, { count: 1, firstAt: now });
      if (hits.size > 10000) hits.clear();
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - entry.firstAt)) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Trop de demandes depuis cette connexion. Réessayez plus tard.' });
    }
    return next();
  };
}
