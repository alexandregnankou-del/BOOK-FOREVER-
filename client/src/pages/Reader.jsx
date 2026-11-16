import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatXof } from '../api.js';
import { useSession } from '../session.jsx';
import { useSite } from '../site.jsx';

function paragraphs(text) {
  return String(text || '')
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean);
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
    };
  } catch {
    return { size: 1, theme: 'sepia' };
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
  const saved = useRef(0);

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
      navigate(`/connexion?next=${encodeURIComponent(`/lire/${slug}/${number}`)}`);
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const res = await api.buy({ bookSlug: slug, chapterNumber: Number(number), method });
      setOrder(res);
    } catch (err) {
      if (err.status === 409) setNotice('Ce chapitre est déjà débloqué. Rechargez la page.');
      else setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const blocks = useMemo(() => paragraphs(state.data?.chapter?.text), [state.data]);

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
            <h2>{state.error}</h2>
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
            <span className="eyebrow">Chapitre {chapter.number}</span>
            <h2>{payload.paywall.title}</h2>
            <p className="muted">
              {chapter.title} — {formatXof(chapter.priceXof)}. Déblocage définitif sur votre compte, à relire
              autant de fois que vous voulez.
            </p>

            {!order ? (
              <>
                <div className="methods">
                  <button
                    type="button"
                    className={`method ${method === 'wave_link' ? 'selected' : ''}`}
                    onClick={() => setMethod('wave_link')}
                    disabled={!waveOn}
                  >
                    <strong>Wave</strong>
                    <span>{waveOn ? 'Lien marchand ADISEN HOUSE' : 'Indisponible'}</span>
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
                {notice && <div className="alert error">{notice}</div>}
                <button type="button" className="btn btn-gold btn-block" onClick={startPurchase} disabled={busy}>
                  {busy ? 'Préparation…' : user ? `Débloquer pour ${formatXof(chapter.priceXof)}` : 'Se connecter pour débloquer'}
                </button>
                <p className="muted" style={{ fontSize: '0.78rem', marginTop: 12 }}>
                  Aucun prélèvement automatique. Le chapitre s’ouvre après vérification du paiement (moins de 30
                  min en journée).
                </p>
              </>
            ) : (
              <div className="instructions">
                <strong>Référence à indiquer :</strong>
                <div className="reference">{order.instructions.reference}</div>
                {order.reused && <p className="muted">Vous aviez déjà une demande en cours pour ce chapitre.</p>}
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
                <p className="muted" style={{ fontSize: '0.8rem' }}>
                  Gardez cette référence : elle relie votre paiement à votre compte. Votre demande apparaît aussi
                  dans <Link to="/compte">Mon compte → Achats</Link>.
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
      <div className="reader-bar">
        <div className="wrap bar">
          <Link to={`/roman/${book.slug}`} className="btn btn-ghost btn-sm" aria-label="Retour au roman">
            ←
          </Link>
          <span className="grow">
            {chapter.number}. {chapter.title}
          </span>
          <div className="reader-tools">
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
      </article>
    </div>
  );
}
