import React, { useEffect, useRef } from 'react';
import { useSite } from '../site.jsx';

/**
 * Composant d'affichage publicitaire Adsterra / Google AdSense / Sponsor local
 */
export default function AdBanner({ zoneId, type = 'native' }) {
  const site = useSite();
  const adRef = useRef(null);
  const activeZoneId = zoneId || site?.adsterraZoneId || '';

  useEffect(() => {
    if (!adRef.current || !activeZoneId) return;

    try {
      const container = adRef.current;
      container.innerHTML = '';

      if (type === 'native' || type === 'banner') {
        const confScript = document.createElement('script');
        confScript.type = 'text/javascript';
        confScript.innerHTML = `
          atOptions = {
            'key' : '${activeZoneId}',
            'format' : 'iframe',
            'height' : 250,
            'width' : 300,
            'params' : {}
          };
        `;
        const invokeScript = document.createElement('script');
        invokeScript.type = 'text/javascript';
        invokeScript.src = `//www.highperformanceformat.com/${activeZoneId}/invoke.js`;
        invokeScript.async = true;

        container.appendChild(confScript);
        container.appendChild(invokeScript);
      }
    } catch (e) {
      console.warn('[Adsterra] Erreur de chargement publicitaire', e);
    }
  }, [activeZoneId, type]);

  return (
    <div
      className="ad-banner-container"
      style={{
        margin: '28px auto 20px',
        padding: '14px',
        maxWidth: 340,
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 10,
        border: '1px dashed rgba(201, 162, 39, 0.25)',
      }}
    >
      <span
        style={{
          fontSize: '0.68rem',
          color: '#8c7d6e',
          display: 'block',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Recommandation & Sponsor
      </span>

      <div ref={adRef} style={{ minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Encart éditorial de secours */}
        <div style={{ fontSize: '0.82rem', color: '#b5a494', lineHeight: 1.45 }}>
          📖 Vous aimez ce roman ? Invitez vos amis et recevez <strong>1 chapitre offert</strong> !
        </div>
      </div>
    </div>
  );
}
