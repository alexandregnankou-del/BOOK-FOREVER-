/* Vérification de rendu : compile l'application et s'assure que chaque page
   produit du HTML sans erreur React (protection contre l'écran blanc). */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App.jsx';

const pages = [
  ['/', ['BOOK FOREVER', 'Chaque histoire']],
  ['/bibliotheque', ['Bibliothèque', 'Choisissez votre prochaine histoire']],
  ['/roman/les-larmes-d-une-plume', ['BOOK FOREVER', 'Chargement']],
  ['/lire/les-larmes-d-une-plume/1', ['Ouverture du chapitre']],
  ['/connexion', ['Connexion', 'Mot de passe']],
  ['/inscription', ['Créer un compte']],
  ['/contact', ['Assistance', 'Écrire à l’éditeur']],
  ['/conditions', ['Conditions d’utilisation']],
  ['/confidentialite', ['Politique de confidentialité']],
  ['/installer', ['sur votre téléphone']],
  ['/console', ['Vérification de la session']],
  ['/page-inconnue', ['Cette page n’existe pas']],
];

let failures = 0;
for (const [path, expected] of pages) {
  try {
    const html = renderToString(
      <App Router={({ children }) => <StaticRouter location={path}>{children}</StaticRouter>} />,
    );
    const missing = expected.filter((needle) => !html.includes(needle));
    if (missing.length) {
      failures += 1;
      console.error(`✗ ${path} — contenu manquant : ${missing.join(', ')}`);
    } else {
      console.log(`✓ ${path} (${html.length} caractères)`);
    }
  } catch (error) {
    failures += 1;
    console.error(`✗ ${path} — erreur de rendu : ${error.message}`);
  }
}

if (failures) {
  console.error(`\n${failures} page(s) en échec.`);
  process.exit(1);
}
console.log('\nToutes les pages se rendent correctement.');
