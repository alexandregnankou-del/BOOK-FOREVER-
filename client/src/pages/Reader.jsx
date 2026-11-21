import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatXof, whatsappHref } from '../api.js';
import { queueOrder, isNetworkFailure } from '../offline.js';
import { useSession } from '../session.jsx';
import { useSite } from '../site.jsx';

/* Les manuscrits sont arrivés avec des retours à la ligne de mise en page et des
   doubles espaces de justification. Sans ce traitement, chaque ligne devient un
   paragraphe et la lecture est hachée toutes les dix mots. On recolle les lignes,
   on rétablit les paragraphes sur la ponctuation, on garde le dialogue intact. */
function paragraphs(text) {
  const clean = (value) => value.replace(/[ \t\u00A0]+/g, ' ').trim();
  const blocks = [];

  for (const chunk of String(text || '').replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    let current = '';
    for (const rawLine of chunk.split('\n')) {
      const line = clean(rawLine);
      if (!line) continue;
      if (!current) {
        current = line;
        continue;
      }
      const dialogue = /^[—–]/.test(line);
      const endsSentence = /[.!?…»”"]$/.test(current);
      const startsUpper = /^[A-ZÀ-ÖØ-Þ«"“(]/.test(line);
      if (dialogue || (endsSentence && startsUpper && current.length > 80)) {
        blocks.push(current);
        current = line;
      } else {
        current += ` ${line}`;
      }
    }
    if (current) blocks.push(current);
  }
  return blocks;
}

const PREFS_KEY = 'bf.reader.prefs';
const CACHE_PREFIX = 'bf.chapter.';
const CACHE_MAX = 10;
const THEMES = ['sepia', 'light', 'dark'];
const THEME_ICONS = { sepia: '◐', light: '☀', dark: '☾' };

function readPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return {
      size: Math.min(1.4, Math.max(0.9, Number(raw.size) || 1)),
      theme: THEMES.includes(raw.theme) ? raw.theme : 'sepia',
      music: Boolean(raw.music),
    };
  } catch {
    return { size: 1, theme: 'sepia', music: false };
  }
}

function cacheChapter(slug, number, payload) {
  try {
    const key = `${CACHE_PREFIX}${slug}.${number}`;
    localStorage.setItem(key, JSON.stringify({ payload, at: Date.now() }));
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length > CACHE_MAX) {
      keys
        .sort((a, b) => (JSON.parse(localStorage.getItem(a)).at || 0) - (JSON.parse(localStorage.getItem(b)).at || 0))
        .slice(0, keys.length - CACHE_MAX)
        .forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    /* quota atteint : la lecture en ligne reste possible */
  }
}

function cachedChapter(slug, number) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${slug}.${number}`);
    return raw ? JSON.parse(raw).payload : null;
  } catch {
    return null;
  }
}

export default function Reader() {
  const { slug, number } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const site = useSite();
  const [state, setState] = useState({ loading: true, locked: false, data: null, error: '', offline: false });
  const [method, setMethod] = useState('wave_link');
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [prefs, setPrefs] = useState(readPrefs);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocItems, setTocItems] = useState([]);
  const [tocLoading, setTocLoading] = useState(false);
  const audioRef = useRef(null);
  const [shareNote, setShareNote] = useState('');
  const saved = useRef(0);
  const scrollTimer = useRef(0);
  const restored = useRef('');

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* stockage indisponible : les réglages restent valables pour la session */
    }
  }, [prefs]);

  const bumpSize = (delta) =>
    setPrefs((p) => ({ ...p, size: Math.min(1.4, Math.max(0.9, Math.round((p.size + delta) * 100) / 100)) }));
  const cycleTheme = () =>
    setPrefs((p) => ({ ...p, theme: THEMES[(THEMES.indexOf(p.theme) + 1) % THEMES.length] }));

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await api.chapter(slug, number);
      setState({ loading: false, locked: false, data, error: '', offline: false });
      cacheChapter(slug, number, data);
    } catch (err) {
      if (err.status === 402) {
        setState({ loading: false, locked: true, data: err.payload, error: '', offline: false });
      } else {
        const fallback = cachedChapter(slug, number);
        if (fallback) {
          setState({ loading: false, locked: false, data: fallback, error: '', offline: true });
        } else {
          setState({ loading: false, locked: false, data: null, error: err.message, offline: false });
        }
      }
    }
  }, [slug, number]);

  useEffect(() => {
    load();
  }, [load]);

  /* Position de défilement : mémorisée localement et envoyée au compte. */
  useEffect(() => {
    if (state.loading || state.locked || !state.data) return;
    const key = `${slug}-${number}`;
    const posKey = `bf.pos.${slug}.${number}`;

    if (restored.current !== key) {
      restored.current = key;
      const stored = Number(localStorage.getItem(posKey) || 0);
      if (stored > 0.02) {
        requestAnimationFrame(() => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          if (max > 0) window.scrollTo({ top: stored * max, behavior: 'auto' });
        });
      }
    }

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const ratio = Math.min(1, Math.max(0, window.scrollY / max));
      try {
        localStorage.setItem(posKey, String(ratio));
      } catch {
        /* stockage plein : la position n'est pas mémorisée */
      }
      window.clearTimeout(scrollTimer.current);
      scrollTimer.current = window.setTimeout(() => {
        if (!user) return;
        api.saveProgress({ bookSlug: slug, chapterNumber: Number(number), position: Number(ratio.toFixed(3)) }).catch(() => {});
      }, 1200);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(scrollTimer.current);
    };
  }, [state, slug, number, user]);

  /* Reprise de lecture : enregistre le chapitre ouvert. */
  useEffect(() => {
    if (!user || state.locked || !state.data) return;
    const key = `${slug}-${number}`;
    if (saved.current === key) return;
    saved.current = key;
    api.saveProgress({ bookSlug: slug, chapterNumber: Number(number), position: 0 }).catch(() => {});
  }, [user, state, slug, number]);

  const startPurchase = async () => {
    if (!user) {
      window.location.assign(`/connexion?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const res = await api.buy({ bookSlug: slug, chapterNumber: Number(number), method });
      setOrder(res);
    } catch (err) {
      setNotice(err.message || 'Impossible de créer la commande.');
    } finally {
      setBusy(false);
    }
  };

  const startFullPurchase = async () => {
    if (!user) {
      window.location.assign(`/connexion?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const res = await api.buyBookFull({ bookSlug: slug, method });
      setOrder(res);
    } catch (err) {
      setNotice(err.message || 'Impossible de créer la commande intégrale.');
    } finally {
      setBusy(false);
    }
  };

  /* Ouvre le chapitre avec un crédit du pack : aucun nouveau paiement. */
  const unlockWithCredit = async () => {
    if (!user) {
      navigate(`/connexion?next=${encodeURIComponent(`/lire/${slug}/${number}`)}`);
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await api.useCredit({ bookSlug: slug, chapterNumber: Number(number) });
      window.location.reload();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openToc = async () => {
    setTocOpen((open) => !open);
    if (tocItems.length || tocLoading) return;
    setTocLoading(true);
    try {
      const { chapters } = await api.book(slug);
      setTocItems(chapters || []);
    } catch {
      setTocItems([]);
    } finally {
      setTocLoading(false);
    }
  };

  const shareChapter = async () => {
    const chapter = state.data?.chapter;
    const book = state.data?.book;
    const url = window.location.href;
    const text = chapter ? `${chapter.title} — ${book.title}` : 'BOOK FOREVER';
    /* Le partage est compté côté serveur : la console doit voir ce qui circule. */
    const count = (channel) => api.share({ bookSlug: book?.slug || '', channel }).catch(() => {});
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        count('native');
        return;
      }
      await navigator.clipboard.writeText(url);
      count('copie');
      setShareNote('Lien copié');
      window.setTimeout(() => setShareNote(''), 2000);
    } catch {
      setShareNote('Partage indisponible');
      window.setTimeout(() => setShareNote(''), 2000);
    }
  };

  const blocks = useMemo(() => paragraphs(state.data?.chapter?.text), [state.data]);


  /* Blocage de la copie : le texte se lit, il ne se recopie pas. */
  useEffect(() => {
    const blocage = (event) => event.preventDefault();
    const touches = (event) => {
      const key = (event.key || '').toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'a', 'p', 's', 'u'].includes(key)) {
        event.preventDefault();
      }
    };
    document.addEventListener('copy', blocage);
    document.addEventListener('cut', blocage);
    document.addEventListener('contextmenu', blocage);
    document.addEventListener('selectstart', blocage);
    document.addEventListener('keydown', touches);
    return () => {
      document.removeEventListener('copy', blocage);
      document.removeEventListener('cut', blocage);
      document.removeEventListener('contextmenu', blocage);
      document.removeEventListener('selectstart', blocage);
      document.removeEventListener('keydown', touches);
    };
  }, []);

  /* Musique de fond : jamais imposée, jamais en autoplay forcé. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    let ramp = null;
    const fadeTo = (target) => {
      if (ramp) clearInterval(ramp);
      ramp = setInterval(() => {
        const next = audio.volume + (target > audio.volume ? 0.03 : -0.05);
        audio.volume = Math.max(0, Math.min(target, next));
        if (Math.abs(audio.volume - target) < 0.02) {
          audio.volume = target;
          clearInterval(ramp);
        }
      }, 60);
    };
    const start = () => {
      audio.volume = 0;
      const attempt = audio.play();
      if (attempt && attempt.then) attempt.then(() => fadeTo(0.32)).catch(() => {});
    };
    if (prefs.music) {
      start();
      const onGesture = () => {
        if (audio.paused) start();
      };
      document.addEventListener('pointerdown', onGesture, { once: true });
      window.addEventListener('keydown', onGesture, { once: true });
    } else {
      fadeTo(0);
      audio.pause();
    }
    const onVisibility = () => {
      if (document.hidden) audio.pause();
      else if (prefs.music) start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (ramp) clearInterval(ramp);
    };
  }, [prefs.music]);

  if (state.loading) {
    return (
      <div className="reader">
        <p className="empty">Ouverture du chapitre…</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="reader">
        <div className="paywall">
          <div className="paywall-card">
            <h1>{state.error}</h1>
            <Link to="/bibliotheque" className="btn btn-ghost">
              Retour à la bibliothèque
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.locked) {
    const payload = state.data;
    const book = payload.book;
    const chapter = payload.chapter;
    const waveOn = payload.paywall.methods.find((m) => m.id === 'wave_link')?.enabled;
    const orangeOn = payload.paywall.methods.find((m) => m.id === 'orange_money_direct')?.enabled;
    const waLink = order
      ? whatsappHref(
          site.contactPhone,
          `Bonjour, je viens de payer ${formatXof(order.instructions.amountXof)} pour « ${book.title} », chapitre ${chapter.number}. Référence : ${order.instructions.reference}`,
        )
      : null;

    return (
      <div className="reader">
        <div className="reader-bar">
          <div className="wrap bar">
            <Link to={`/roman/${book.slug}`} className="btn btn-ghost btn-sm">
              ← {book.title}
            </Link>
            <span className="grow">
              Chapitre {chapter.number} · {chapter.title}
            </span>
          </div>
        </div>

        <div className="paywall">
          <div className="paywall-card">
            <span className="eyebrow">Commande & Déblocage</span>
            <h1>{chapter.title}</h1>
            <p className="muted">
              {book.title} — Chapitre {chapter.number}
            </p>

            {!order ? (
              <>
                {/* APERÇU DU PANIER / RÉCAPITULATIF DE COMMANDE (Loi 2013-546 & 2016-412) */}
                <div className="order-summary-card">
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gold, #c9a227)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Aperçu de votre commande
                  </div>
                  <div className="order-summary-row">
                    <span>Ouvrage & Chapitre</span>
                    <strong>{book.title} (Ch. {chapter.number})</strong>
                  </div>
                  <div className="order-summary-row">
                    <span>Prix unitaire</span>
                    <span>{formatXof(chapter.priceXof)}</span>
                  </div>
                  <div className="order-summary-row">
                    <span>Durée de lecture</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>Accès temporaire : 30 jours</span>
                  </div>
                  <div className="order-summary-row">
                    <span>Frais supplémentaires</span>
                    <span>0 FCFA</span>
                  </div>
                  <div className="order-summary-row total">
                    <span>Total à payer</span>
                    <span>{formatXof(chapter.priceXof)}</span>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <label style={{ display: 'block', fontSize: '0.86rem', color: '#ded7cd', marginBottom: 8, fontWeight: 600 }}>
                    1. Choisissez votre moyen de paiement :
                  </label>
                  <div className="methods">
                    <button
                      type="button"
                      className={`method ${method === 'wave_link' ? 'selected' : ''}`}
                      onClick={() => setMethod('wave_link')}
                      disabled={!waveOn}
                    >
                      <strong>Wave</strong>
                      <span>{waveOn ? 'Lien marchand direct' : 'Indisponible'}</span>
                    </button>
                    <button
                      type="button"
                      className={`method ${method === 'orange_money_direct' ? 'selected' : ''}`}
                      onClick={() => setMethod('orange_money_direct')}
                      disabled={!orangeOn}
                    >
                      <strong>Orange Money</strong>
                      <span>{orangeOn ? site.orangeNumber : 'Indisponible'}</span>
                    </button>
                  </div>
                </div>

                {notice && <div className="alert error" style={{ marginTop: 12 }}>{notice}</div>}

                <div style={{ marginTop: 16 }}>
                  <p className="muted" style={{ fontSize: '0.8rem', lineHeight: 1.45, marginBottom: 12 }}>
                    En validant, vous recevrez un <strong>accusé de réception électronique</strong> avec votre référence unique,
                    puis un <strong>reçu officiel téléchargeable</strong> dès confirmation du paiement.
                  </p>
                  
                  <div style={{ display: 'grid', gap: 10 }}>
                    <button type="button" className="btn btn-gold btn-block" onClick={startPurchase} disabled={busy}>
                      {busy ? 'Préparation…' : user ? `1. Débloquer ce chapitre (${formatXof(chapter.priceXof)})` : 'Se connecter pour commander'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-block"
                      style={{
                        background: 'linear-gradient(135deg, #c9a227, #9b7a1c)',
                        color: '#14110e',
                        fontWeight: 700,
                        border: 'none',
                        padding: '12px 16px',
                        cursor: 'pointer',
                      }}
                      onClick={startFullPurchase}
                      disabled={busy}
                    >
                      ⚡ 2. Débloquer TOUT le roman — 1 500 FCFA (Économisez 66%)
                    </button>
                  </div>
                </div>

                {user && (payload.paywall.credits || 0) > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    style={{ marginTop: 10 }}
                    onClick={unlockWithCredit}
                    disabled={busy}
                  >
                    Ouvrir avec un crédit ({payload.paywall.credits} restant
                    {payload.paywall.credits > 1 ? 's' : ''})
                  </button>
                )}

                <p className="muted" style={{ fontSize: '0.78rem', marginTop: 14, textAlign: 'center' }}>
                  Conforme aux <Link to="/cgv" target="_blank">Conditions Générales de Vente</Link> et aux{' '}
                  <Link to="/mentions-legales" target="_blank">Mentions Légales</Link>.
                </p>

                {payload.paywall.offers && (
                  <div className="paywall-offers">
                    <span className="hint">
                      Plusieurs chapitres d’avance ?{' '}
                      <Link to="/compte">
                        pack {payload.paywall.offers.pack.credits} chapitres à{' '}
                        {formatXof(payload.paywall.offers.pack.priceXof)}
                      </Link>{' '}
                      ou{' '}
                      <Link to="/compte">
                        pass {payload.paywall.offers.pass.days} jours à{' '}
                        {formatXof(payload.paywall.offers.pass.priceXof)}
                      </Link>
                      .
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="instructions">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold, #c9a227)', marginBottom: 8 }}>
                  <span style={{ fontSize: '1.2rem' }}>📋</span>
                  <strong>Accusé de réception de commande</strong>
                </div>
                <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 10px' }}>
                  Votre commande a bien été enregistrée. Effectuez votre règlement avec les instructions ci-dessous :
                </p>
                <div className="reference">{order.instructions.reference}</div>
                {order.reused && <p className="muted">Vous aviez déjà une commande en attente pour ce chapitre.</p>}
                <ol>
                  {order.instructions.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                {order.instructions.url && (
                  <p style={{ marginTop: 12 }}>
                    <a href={order.instructions.url} target="_blank" rel="noreferrer" className="btn btn-gold btn-sm">
                      Ouvrir la page Wave
                    </a>
                  </p>
                )}
                {order.instructions.number && (
                  <p style={{ marginTop: 12 }}>
                    Numéro marchand : <strong>{order.instructions.number}</strong>
                  </p>
                )}
                {waLink && (
                  <p style={{ marginTop: 12 }}>
                    <a className="btn btn-whatsapp btn-sm" href={waLink} target="_blank" rel="noreferrer">
                      Envoyer la référence sur WhatsApp
                    </a>
                  </p>
                )}
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: 14 }}>
                  💡 Dès validation serveur, votre reçu électronique officiel sera disponible dans{' '}
                  <Link to="/compte">Mon compte → Mes reçus</Link> et le chapitre s'ouvrira immédiatement.
                </p>
                <p style={{ marginTop: 10, textAlign: 'center' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOrder(null)}>
                    ← Modifier ou corriger la commande
                  </button>
                </p>
              </div>
            )}

            <p style={{ marginTop: 18 }}>
              <Link to={`/lire/${slug}/1`} className="btn btn-ghost btn-sm">
                Relire depuis le début
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { chapter, book, navigation } = state.data;

  return (
    <div className="reader" data-theme={prefs.theme} style={{ '--reader-size': `${prefs.size}rem` }}>
      <audio ref={audioRef} src="/audio/lecture.mp3" loop preload="none" />
      <div className="reader-bar">
        <div className="wrap bar">
          <Link to={`/roman/${book.slug}`} className="btn btn-ghost btn-sm" aria-label="Retour au roman">
            ←
          </Link>
          <span className="grow">
            {chapter.number}. {chapter.title}
          </span>
          <div className="reader-tools">
            <button type="button" className="tool" onClick={openToc} aria-label="Sommaire" title="Sommaire">
              ☰
            </button>
            <button type="button" className="tool" onClick={shareChapter} aria-label="Partager" title="Partager">
              ↗
            </button>
            <button
              type="button"
              className={`tool${prefs.music ? ' on' : ''}`}
              onClick={() => setPrefs((p) => ({ ...p, music: !p.music }))}
              aria-label="Musique de fond"
              aria-pressed={prefs.music}
              title={prefs.music ? 'Couper la musique' : 'Musique de fond'}
            >
              {prefs.music ? '♫' : '♪'}
            </button>
            <button type="button" className="tool" onClick={() => bumpSize(-0.05)} aria-label="Réduire le texte">
              A−
            </button>
            <button type="button" className="tool" onClick={() => bumpSize(0.05)} aria-label="Agrandir le texte">
              A+
            </button>
            <button
              type="button"
              className="tool"
              onClick={cycleTheme}
              aria-label={`Thème ${prefs.theme}`}
              title={`Thème : ${prefs.theme}`}
            >
              {THEME_ICONS[prefs.theme]}
            </button>
          </div>
        </div>
      </div>

      {tocOpen && (
        <>
          <button type="button" className="toc-backdrop" onClick={() => setTocOpen(false)} aria-label="Fermer le sommaire" />
          <aside className="toc-panel" role="dialog" aria-label="Sommaire">
            <div className="toc-head">
              <strong>Sommaire</strong>
              <button type="button" className="toc-close" onClick={() => setTocOpen(false)} aria-label="Fermer">
                ×
              </button>
            </div>
            {tocLoading ? (
              <p className="muted" style={{ padding: 16 }}>
                Chargement…
              </p>
            ) : (
              <ul>
                {tocItems.map((item) => (
                  <li key={item.id || item.number}>
                    <Link
                      to={`/lire/${slug}/${item.number}`}
                      className={`${item.number === Number(number) ? 'current' : ''} ${item.unlocked ? '' : 'locked'}`}
                      onClick={() => setTocOpen(false)}
                    >
                      <span className="num">{String(item.number).padStart(2, '0')}</span>
                      <span className="t">{item.title}</span>
                      <span className="s" aria-hidden="true">
                        {item.number === Number(number) ? '•' : item.unlocked ? '' : '🔒'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </>
      )}

      {shareNote && <div className="share-note">{shareNote}</div>}

      {state.offline && (
        <div className="offline-banner">
          Version hors ligne — ce chapitre a été enregistré lors de votre dernière visite.
        </div>
      )}

      <article className="reader-body">
        <span className="eyebrow">
          {book.title} · Chapitre {chapter.number}
        </span>
        <h1>{chapter.title}</h1>
        <div className="byline">{book.author}</div>

        <div className="prose">
          {blocks.map((block, i) => (
            <p key={i}>{block}</p>
          ))}
        </div>

        <button type="button" className="to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ↑ Haut du chapitre
        </button>

        <div className="reader-nav">
          {navigation.previous ? (
            <Link to={`/lire/${slug}/${navigation.previous.number}`} className="btn btn-ghost btn-sm">
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          {navigation.next ? (
            <Link to={`/lire/${slug}/${navigation.next.number}`} className="btn btn-gold btn-sm">
              Chapitre suivant →
            </Link>
          ) : (
            <Link to={`/roman/${slug}`} className="btn btn-ghost btn-sm">
              Fin du roman
            </Link>
          )}
        </div>
        <p className="reader-protect">Texte protégé · reproduction interdite</p>
      </article>
    </div>
  );
}
