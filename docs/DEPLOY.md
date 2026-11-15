# Mise en production

Objectif : un lien stable, `https://book-forever.onrender.com`, qui ne dépend plus d'un tunnel
temporaire.

## 1. Dépôt GitHub

Le dépôt doit contenir **tout** le projet (dossiers `server/`, `client/`, `public/`,
`tests/`, `docs/`, fichiers `package.json`, `package-lock.json`, `render.yaml`, `vite.config.js`).

Deux façons de le remplir :

- **Depuis un ordinateur** : `git clone`, copier les fichiers, `git add . && git commit -m "BOOK FOREVER" && git push`.
- **Depuis GitHub web** : *Add file → Upload files*, glisser le dossier décompressé, valider le commit.

Ne déposez jamais `node_modules/`, `dist/` ni `data/` : ils sont dans `.gitignore` et Render les
reconstruit.

## 2. Render

1. [render.com](https://render.com) → **New** → **Blueprint**.
2. Sélectionnez le dépôt : Render lit `render.yaml` et propose le service `book-forever`.
3. Renseignez `ADMIN_PASSWORD` quand il le demande (mot de passe fort, notez-le).
4. **Apply** : le premier déploiement prend 2 à 4 minutes (installation, compilation du client,
   création de la base, chargement du catalogue).

Le service redémarre automatiquement à chaque `git push` sur la branche principale.

## 3. Vérification après déploiement

```bash
curl https://book-forever.onrender.com/api/health      # {"ok":true,...}
curl https://book-forever.onrender.com/api/books       # 3 romans
curl -o /dev/null -w "%{http_code}\n" https://book-forever.onrender.com/
curl -o /dev/null -w "%{http_code}\n" https://book-forever.onrender.com/console
```

Puis : connexion avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`, changement du mot de passe, import des
manuscrits, publication.

> Le plan gratuit met le service en veille après 15 minutes sans visite : la première ouverture
> peut prendre 30 à 50 secondes. C'est normal, le service se réveille seul.

## 4. Données — le point à décider

Le plan **free** n'a pas de disque persistant. À chaque redéploiement (nouveau `git push`,
redémarrage de la plateforme), la base SQLite est recréée :

- le **catalogue** est reconstitué automatiquement depuis `server/seed/books.json` ;
- les **comptes lecteurs, achats et messages** sont perdus.

Pour une boutique qui encaisse de l'argent, c'est inacceptable dès les premières ventes.
Solution : plan **Starter** (≈ 7 $/mois) + disque persistant.

1. Render → service `book-forever` → **Settings** → *Instance Type* → **Starter**.
2. Décommentez dans `render.yaml` :

```yaml
      - key: DATA_DIR
        value: /var/data
    disk:
      name: book-forever-data
      mountPath: /var/data
      sizeGB: 1
```

3. Commit, `git push` : la base vit désormais sur le disque et survit aux déploiements.

Sauvegarde manuelle (à faire une fois par semaine si les ventes comptent) :

```bash
# depuis votre machine, avec le CLI Render installé
render ssh book-forever
cp /var/data/book-forever.db /var/data/backup-$(date +%F).db
```

## 5. Domaine personnalisé (facultatif)

Render → **Settings → Custom Domain** → ajoutez `bookforever.ci` (ou un sous-domaine), puis créez
chez votre registrar l'enregistrement CNAME indiqué. Le certificat HTTPS est automatique.
Une fois le domaine actif, mettez à jour les liens publics et régénérez le QR code :

```bash
python3 -c "import segno; segno.make('https://bookforever.ci', error='h').save('public/icons/qr-site.png', scale=8, border=2, dark='#14110E', light='#FBF7F0')"
```

## 6. E-mails aux lecteurs (facultatif)

1. Créez un compte sur [resend.com](https://resend.com) (offre gratuite : 3 000 e-mails/mois).
2. Vérifiez votre domaine d'envoi, puis créez une clé API.
3. Render → **Environment** → ajoutez `RESEND_API_KEY` et `MAIL_FROM`.
4. Les réponses saisies dans l'onglet Messages partent alors automatiquement au lecteur.

## 7. Paiement automatique (facultatif)

Le déblocage manuel fonctionne sans aucune clé. Pour automatiser :

- **Wave** : `WAVE_API_KEY` + `WAVE_WEBHOOK_SECRET` (compte marchand Wave Business).
- **Orange Money** : `ORANGE_CLIENT_ID`, `ORANGE_CLIENT_SECRET`, `ORANGE_MERCHANT_KEY`
  (contrat marchand Orange CI).

Tant que ces clés sont absentes, chaque commande reste en attente et doit être validée dans la
console — c'est le comportement actuel, volontairement prudent.

## 8. Ce qui reste à faire côté éditeur

- Importer les manuscrits complets (les chapitres payants ne sont pas dans le dépôt).
- Changer le mot de passe administrateur.
- Décider du plan Render (free ou Starter + disque).
- Renseigner `RESEND_API_KEY` si les réponses doivent partir par e-mail.
