import { useEffect, useState } from 'react';
import { api, formatDate } from '../api.js';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState({ type: '', message: '' });

  const load = () =>
    api.admin
      .messages()
      .then(({ messages: list }) => setMessages(list))
      .catch((err) => setNotice({ type: 'error', message: err.message }));

  useEffect(() => {
    load();
  }, []);

  const openMessage = async (message) => {
    setOpen(message);
    setReply(message.reply || '');
    if (message.status === 'new') {
      await api.admin.updateMessage(message.id, { status: 'read' });
      load();
    }
  };

  const send = async () => {
    if (!reply.trim()) return;
    const { emailed } = await api.admin.updateMessage(open.id, { status: 'answered', reply });
    setNotice({
      type: 'ok',
      message: emailed
        ? 'Réponse enregistrée et envoyée par e-mail.'
        : 'Réponse enregistrée. L’envoi par e-mail nécessite une clé Resend (RESEND_API_KEY).',
    });
    setOpen(null);
    setReply('');
    load();
  };

  return (
    <>
      <div className="console-head">
        <div>
          <span className="eyebrow">Lecteurs</span>
          <h1>Messages reçus</h1>
        </div>
        <span className="pill">{messages.filter((m) => m.status === 'new').length} nouveaux</span>
      </div>

      {notice.message && <div className={`alert ${notice.type}`}>{notice.message}</div>}

      <div className="split" style={{ gridTemplateColumns: '1fr 1.1fr', alignItems: 'start' }}>
        <div className="panel">
          {messages.length === 0 && <p className="empty">Aucun message.</p>}
          {messages.map((message) => (
            <div
              key={message.id}
              className="row-item"
              style={{ cursor: 'pointer', background: open?.id === message.id ? 'rgba(185,139,46,0.07)' : undefined }}
              onClick={() => openMessage(message)}
            >
              <div className="grow">
                <strong>{message.name}</strong>
                <span>
                  {message.subject || 'Sans objet'} · {formatDate(message.created_at)}
                </span>
              </div>
              <span className={`pill ${message.status === 'answered' ? 'free' : message.status === 'new' ? '' : 'dark'}`}>
                {message.status === 'answered' ? 'Répondu' : message.status === 'new' ? 'Nouveau' : 'Lu'}
              </span>
            </div>
          ))}
        </div>

        <div className="panel">
          {!open ? (
            <p className="empty">Sélectionnez un message.</p>
          ) : (
            <>
              <h2 style={{ fontSize: '1.15rem' }}>{open.subject || 'Sans objet'}</h2>
              <p className="muted" style={{ fontSize: '0.84rem' }}>
                {open.name} · {open.email} · {formatDate(open.created_at)}
              </p>
              <p style={{ whiteSpace: 'pre-line', background: '#faf6ef', padding: 14, borderRadius: 10 }}>
                {open.body}
              </p>
              <div className="field">
                <label>Réponse</label>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} style={{ minHeight: 120 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-gold btn-sm" onClick={send}>
                  Enregistrer la réponse
                </button>
                <a href={`mailto:${open.email}`} className="btn btn-ghost btn-sm">
                  Répondre depuis ma messagerie
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
