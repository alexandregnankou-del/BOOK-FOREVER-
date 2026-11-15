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
};

const SiteContext = createContext(FALLBACK);

export function SiteProvider({ children }) {
  const [site, setSite] = useState(FALLBACK);

  useEffect(() => {
    api
      .site()
      .then((data) => setSite({ ...FALLBACK, ...data }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (site.siteName) document.title = `${site.siteName} — Lire autrement, chapitre après chapitre`;
  }, [site.siteName]);

  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}
