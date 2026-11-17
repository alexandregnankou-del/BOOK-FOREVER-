# BOOK FOREVER

Librairie numérique d'ADISEN — section Littérature. Les deux premiers chapitres de chaque
roman sont offerts, la suite se débloque à l'unité (300 FCFA), par Wave ou Orange Money.

- **Site lecteurs** : accueil, bibliothèque, fiche roman, lecteur, contact, CGU, PWA installable
- **Console d'administration** : `/console` — romans, chapitres, manuscrits, messages, ventes, réglages
- **Pile technique** : Express + SQLite (better-sqlite3) côté serveur, React + Vite côté client

## Démarrage local

```bash
npm install
npm run build      # compile le client dans dist/
npm start          # http://localhost:3000
```

En développement, deux terminaux :

```bash
npm run dev                 # API sur :3000 (rechargement automatique)
npx vite                    # client sur :5173 (proxy /api → :3000)
```

Identifiants au premier lancement : `ADMIN_EMAIL` / `ADMIN_PASSWORD` (voir `.env.example`),
par défaut `alexadisenhouse@gmail.com` / `Adisen2026!`. **Changez ce mot de passe dès la
première connexion** (site → Mon compte → Mot de passe).

## Structure

```
server/
  index.mjs            serveur Express, rendu SPA, fichiers statiques
  config.mjs           variables d'environnement et valeurs par défaut
  db.mjs               schéma SQLite, réglages, utilitaires
  auth.mjs             sessions JWT (cookie httpOnly), rôles
  seed.mjs             création du catalogue depuis server/seed/books.json
  routes/public.mjs    catalogue, chapitres (paywall 402), contact
  routes/auth.mjs      inscription, connexion, mot de passe
  routes/me.mjs        achats, progression de lecture
  routes/admin.mjs     console : romans, chapitres, import, messages, ventes, réglages
client/
  src/pages/           Home, Library, Book, Reader, Login, Register, Account, Contact, Legal, Install, Console
  src/console/         Dashboard, Books, Messages, Orders, Settings
  src/styles.css       thème « papier & or »
public/
  media/covers/        couvertures des romans
  icons/, fonts/       icônes PWA, polices auto-hébergées
  sw.js                service worker (jamais de cache sur le HTML ni les chapitres)
tests/api.test.mjs     15 tests de bout en bout (paiement, paywall, import, réglages…)
docs/                  guide d'administration, mise en production
```

## Vérifier

```bash
npm test
```

## Déploiement

Voir [docs/DEPLOY.md](docs/DEPLOY.md). En résumé : dépôt GitHub → Render (Blueprint
`render.yaml`) → lien `https://book-forever.onrender.com`.

## Points d'attention

- `server/seed/books.json` contient le catalogue livré (titres, résumés, couvertures, chapitres
  offerts). Les chapitres payants s'ajoutent depuis la console, par import de manuscrit.
- Une base SQLite est créée dans `data/`. Sur Render, sans disque persistant, elle est
  réinitialisée à chaque déploiement : voir la section « Données » de `docs/DEPLOY.md`.
- Les paiements Wave / Orange Money sont vérifiés à la main dans la console (onglet Ventes) :
  aucun chapitre ne s'ouvre sur simple déclaration du lecteur.

## Application Android

`android-app/` contient la coque native (WebView) qui donne l'application installable.
Elle pointe vers le site : toute mise à jour du site est immédiatement dans l'application.

### Chaîne de compilation requise

Aucun SDK n'est préinstallé sur les serveurs d'exécution. Il faut, une fois :

```bash
# JDK 17
curl -L -o jdk.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
mkdir -p /opt/toolchain && tar xzf jdk.tar.gz -C /opt/toolchain

# Command-line tools + plateforme
curl -L -o cmdline.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
unzip -q cmdline.zip -d /opt/toolchain/cmdline
export JAVA_HOME=/opt/toolchain/jdk-17.0.21+9
yes | /opt/toolchain/cmdline/cmdline-tools/bin/sdkmanager --sdk_root=/opt/toolchain/sdk --licenses
/opt/toolchain/cmdline/cmdline-tools/bin/sdkmanager --sdk_root=/opt/toolchain/sdk \
  "platforms;android-34" "build-tools;34.0.0"
```

### Construction

```bash
export ANDROID_HOME=/opt/toolchain/sdk JAVA_HOME=/opt/toolchain/jdk-17.0.21+9
cd android-app && bash build.sh     # aapt2 → javac → d8 → zipalign → apksigner
cp build/book-forever.apk ../public/download/book-forever-v8.apk
```

L'APK est distribué par `/telecharger` (type MIME `application/vnd.android.package-archive`).

### Signature

Le keystore (`android-app/keystore/book-forever.jks`, mot de passe `bookforever`) n'est **pas
versionné** : sans lui, Android refuse les mises à jour et les lecteurs doivent désinstaller.
Une copie de sauvegarde et son mode d'emploi se trouvent dans `backups/apk-signing/`.

## Journal des versions

### v8 — 17 novembre 2026
- APK `8.0.0` (versionCode 8) compilé et signé : téléchargement des fichiers géré par Android
  (un WebView n'enregistre rien de lui-même), barre de progression réelle, reprise après veille,
  liens `sms:` et `intent:`.
- Serveur : un fichier absent sous `/download/`, `/media/`, `/assets/`… renvoie 404 au lieu de la
  page HTML — plus de faux `.apk` de 2 Ko.
- Archive web `book-forever-web-1.8.0.zip` publiée et liée depuis `/telecharger`.

### v7 — 17 novembre 2026
- Reprise de lecture sur l'accueil (chapitre + position de défilement).
- Favoris par lecteur, onglet « Mes favoris » dans la bibliothèque.
- Recherche dans la bibliothèque (titre, auteur, thème) + filtre par catégorie.
- Sommaire latéral dans le lecteur, partage natif d'un chapitre.
- Un fichier absent sous `/download/` renvoie un 404 explicite au lieu de la page HTML.
