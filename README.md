# ADISEN — site officiel (lancement littérature)

Site statique, sans dépendance et sans appel externe : il fonctionne en double-cliquant
sur `index.html`, ou sur n'importe quel hébergement.

## Contenu

- `index.html` — page unique : hero, la maison, les romans, comment lire, contact, pied de page
- `styles.css` — mise en forme (bleu nuit, doré, blanc cassé), responsive, contrastes AA
- `script.js` — menu mobile et apparition des sections (désactivée si « réduire les animations »)
- `assets/covers/` — les 5 couvertures réelles, reprises de BOOK FOREVER
- `assets/og-image.jpg` — aperçu 1200×630 pour le partage WhatsApp et Facebook
- `assets/favicon.svg` — icône
- `robots.txt`

## Données

Tout provient de l'API publique de BOOK FOREVER, au 26 novembre 2026 :
5 romans, 300 FCFA le chapitre, pass 7 jours 500 F, pack 5 chapitres 1 200 F,
abonnement 30 jours 2 000 F, chaîne WhatsApp et contacts.

Aucun chiffre, aucun avis, aucune statistique n'a été inventé.

## Ce qui a été retiré

Mode, vêtement, art, studio, produits non disponibles, liste d'attente, titres
non publiés. Une seule phrase les mentionne comme « en préparation », sans promesse.

## À vérifier avant publication

1. **Domaine.** `og:url`, `og:image` et `canonical` pointent vers
   `https://adisen-officiel.site.accio.ai`. Si le site est publié ailleurs,
   remplacez ces trois valeurs par le nouveau domaine — sinon l'aperçu de partage
   pointera vers l'ancien.
2. **Adresse e-mail de la maison.** La page utilise `alexadisenhouse@gmail.com`
   pour ADISEN et `alexandregnankou@gmail.com` (BOOK FOREVER) pour le support
   lecture. Harmonisez si vous préférez une seule adresse.
3. **Mentions légales.** Les liens renvoient vers les pages existantes de
   BOOK FOREVER. Si ADISEN doit avoir ses propres mentions, il faudra les rédiger :
   je ne les ai pas inventées.
