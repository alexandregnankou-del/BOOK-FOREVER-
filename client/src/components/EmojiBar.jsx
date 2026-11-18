import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useSession } from '../session.jsx';

const EMOJIS = [
  { key: '❤️', label: 'J’aime' },
  { key: '🔥', label: 'Brûlant' },
  { key: '😭', label: 'Bouleversant' },
  { key: '😍', label: 'Adorable' },
  { key: '👏', label: 'Bravo' },
];

function compact(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')} M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')} k`;
  return String(n);
}

export default function EmojiBar({ slug, audience }) {
  const { user } = useSession();
  const [state, setState] = useState({
    views: audience?.views || 0,
    hearts: audience?.hearts || 0,
    breakdown: audience?.breakdown || [],
    myReaction: audience?.myReaction || null,
    followers: audience?.followers || 0,
    following: audience?.following || false,
  });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (audience) setState((prev) => ({ ...prev, ...audience }));
  }, [audience]);

  const react = async (emoji) => {
    if (!user) {
      setNotice('Connectez-vous pour réagir.');
      return;
    }
    try {
      const same = state.myReaction === emoji;
      const res = same ? await api.unreaction(slug) : await api.reactBook(slug, emoji);
      setState((prev) => ({
        ...prev,
        hearts: res.totalReactions,
        breakdown: res.reactions,
        myReaction: res.myReaction,
      }));
    } catch (err) {
      setNotice(err.message);
    }
  };

  const follow = async () => {
    if (!user) {
      setNotice('Connectez-vous pour suivre cet auteur.');
      return;
    }
    try {
      const res = state.following
        ? await api.unfollowAuthor(audience.authorName || '')
        : await api.followAuthor(audience.authorName || '');
      setState((prev) => ({ ...prev, followers: res.followers, following: res.following }));
    } catch (err) {
      setNotice(err.message);
    }
  };

  return (
    <div className="emoji-bar">
      <div className="emoji-row">
        {EMOJIS.map((item) => {
          const found = state.breakdown.find((row) => row.emoji === item.key);
          return (
            <button
              key={item.key}
              type="button"
              className={`emoji-chip${state.myReaction === item.key ? ' active' : ''}`}
              onClick={() => react(item.key)}
              title={item.label}
              aria-pressed={state.myReaction === item.key}
            >
              <span className="emoji-glyph">{item.key}</span>
              {found ? <span className="emoji-count">{compact(found.total)}</span> : null}
            </button>
          );
        })}
      </div>

      <p className="emoji-meta">
        <span>👁 {compact(state.views)} vues</span>
        <span>❤️ {compact(state.hearts)} réactions</span>
        {audience?.authorName ? (
          <button type="button" className="follow-link" onClick={follow}>
            {state.following ? 'Suivi ✓' : 'Suivre l’auteur'} · {compact(state.followers)}
          </button>
        ) : null}
      </p>
      {notice && <p className="hint">{notice}</p>}
    </div>
  );
}
