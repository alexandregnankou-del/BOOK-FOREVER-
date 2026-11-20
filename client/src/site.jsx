import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const FALLBACK = {
  siteName: 'BOOK FOREVER',
  siteTagline: 'Lire · Rêver · Toujours',
  contactEmail: 'alexandregnankou@gmail.com',
  contactPhone: '+225 0703025007',
  waveLink: 'https://pay.wave.com/m/M_ci_WwpCpr9rnJw1/c/ci/',
  orangeNumber: '0706486904',
  priceXof: 300,
  freeChapters: 2,
  address: 'Abidjan, Côte d’Ivoire',
  publisher: 'ADISEN — section Littérature',
  waveEnabled: true,
  orangeEnabled: true,
  supportHours: 'Lundi – samedi, 8h – 20h',
  accessDays: 30,
  offers: {
    monthly: { priceXof: 2000, days: 30 },
    pass: { priceXof: 500, days: 7 },
    pack: { priceXof: 1200, credits: 5 },
    referral: { target: 3, reward: 1 },
  },
  channelUrl: '',
  spotlight: null,
};

const SiteContext = createContext(FALLBACK);

export function SiteProvider({ children }) {
  const [site, setSite] = useState(FALLBACK);

  /* La console peut changer la mise en avant : on puise à nouveau la
     configuration sans recharger la page. */
  const refreshSite = () =>
    api
      .site()
      .then((data) => setSite({ ...FALLBACK, ...data }))
      .catch(() => {});

  useEffect(() => {
    refreshSite();
  }, []);

  useEffect(() => {
    if (site.siteName) document.title = `${site.siteName} — Lire autrement, chapitre après chapitre`;
  }, [site.siteName]);

  return <SiteContext.Provider value={{ ...site, refreshSite }}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}
