import React from 'react';

/**
 * Garde-fou d'affichage : si une page casse au rendu, on montre un écran lisible
 * avec deux issues (recharger, vider le cache) au lieu d'une page blanche muette.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    /* Visible dans la console du navigateur pour le diagnostic. */
    console.error('[BOOK FOREVER] rendu interrompu :', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        data-bf-boundary="1"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#14110E',
          color: '#F5EFE6',
          font: '15px/1.6 system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p style={{ letterSpacing: '.3em', color: '#C9A227', fontSize: 12, margin: 0 }}>BOOK FOREVER</p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '14px 0 10px' }}>
            Cette page n’a pas pu s’afficher
          </h1>
          <p style={{ color: '#C4B8A4', margin: '0 0 14px' }}>
            Vos achats et vos lectures sont intacts. Rechargez la page ; si l’écran reste vide, videz le cache de
            l’application.
          </p>
          <p
            style={{
              color: 'rgba(196,184,164,.6)',
              fontSize: 11.5,
              fontFamily: 'ui-monospace, monospace',
              margin: '0 0 20px',
              wordBreak: 'break-word',
            }}
          >
            {`${typeof window !== 'undefined' ? window.location.pathname : ''} · ${String(
              error?.message || error || 'erreur inconnue',
            ).slice(0, 200)}`}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '13px 26px',
              borderRadius: 999,
              border: 0,
              background: '#C9A227',
              color: '#14110E',
              fontWeight: 600,
              marginRight: 10,
            }}
          >
            Recharger
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            style={{
              padding: '13px 22px',
              borderRadius: 999,
              border: '1px solid rgba(201,162,39,.5)',
              background: 'transparent',
              color: '#F5EFE6',
              fontWeight: 500,
              marginRight: 10,
            }}
          >
            Accueil
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map((key) => caches.delete(key)));
                }
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map((reg) => reg.unregister()));
                }
              } catch {
                /* rien de bloquant */
              }
              window.location.reload();
            }}
            style={{
              padding: '13px 22px',
              borderRadius: 999,
              border: '1px solid rgba(201,162,39,.5)',
              background: 'transparent',
              color: '#F5EFE6',
              fontWeight: 500,
            }}
          >
            Vider le cache
          </button>
        </div>
      </div>
    );
  }
}
