import { useCallback, useEffect, useState } from 'react';
import { api, formatDate, formatXof, METHOD_LABELS, STATUS_LABELS } from '../api.js';

const FILTERS = [
  ['', 'Toutes'],
  ['pending', 'En attente'],
  ['paid', 'Payées'],
  ['rejected', 'Refusées'],
  ['refunded', 'Remboursées'],
];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { orders: list } = await api.admin.orders(filter);
      setOrders(list);
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action, order) => {
    setBusy(true);
    setNotice({ type: '', message: '' });
    try {
      if (action === 'validate') {
        await api.admin.validateOrder(order.id);
        setNotice({ type: 'ok', message: `${order.reference} validée — chapitre ouvert pour ${order.user_email}.` });
      } else if (action === 'reject') {
        const note = window.prompt('Motif du refus ?', 'Paiement non retrouvé sur le relevé');
        if (note === null) return;
        await api.admin.rejectOrder(order.id, note);
        setNotice({ type: 'ok', message: `${order.reference} refusée.` });
      } else {
        const note = window.prompt('Motif du remboursement ?', 'Remboursé');
        if (note === null) return;
        await api.admin.refundOrder(order.id, note);
        setNotice({ type: 'ok', message: `${order.reference} marquée remboursée.` });
      }
      load();
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="console-head">
        <div>
          <span className="eyebrow">Paiements</span>
          <h1>Ventes</h1>
        </div>
        <div className="tabs" style={{ margin: 0, border: 'none' }}>
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {notice.message && <div className={`alert ${notice.type}`}>{notice.message}</div>}

      <p className="muted" style={{ fontSize: '0.84rem' }}>
        Vérifiez le règlement sur votre relevé Wave / Orange Money avant de valider : la référence ci-dessous doit
        correspondre au libellé du paiement reçu.
      </p>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Lecteur</th>
              <th>Chapitre</th>
              <th>Montant</th>
              <th>Moyen</th>
              <th>Date</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>{order.reference}</td>
                <td>{order.user_email}</td>
                <td>
                  {order.book_title}
                  <br />
                  <span className="muted" style={{ fontSize: '0.76rem' }}>
                    ch. {order.chapter_number} — {order.chapter_title}
                  </span>
                </td>
                <td>{formatXof(order.amount_xof)}</td>
                <td>{METHOD_LABELS[order.method] || order.method}</td>
                <td>{formatDate(order.created_at)}</td>
                <td>
                  <span className={`pill ${order.status === 'paid' ? 'free' : order.status === 'pending' ? '' : 'warn'}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {order.status === 'pending' && (
                    <>
                      <button type="button" className="btn btn-gold btn-sm" disabled={busy} onClick={() => act('validate', order)}>
                        Valider
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ marginLeft: 6 }}
                        disabled={busy}
                        onClick={() => act('reject', order)}
                      >
                        Refuser
                      </button>
                    </>
                  )}
                  {order.status === 'paid' && (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act('refund', order)}>
                      Rembourser
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  Aucune commande dans cette vue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
