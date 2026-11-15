# Guide d'administration

La console est séparée du site public : elle est accessible à `/console` et n'est visible que
par un compte de rôle `admin`. Elle n'est pas indexée et n'apparaît pas dans la navigation du
site pour les lecteurs.

## Connexion

- Adresse : `https://[votre-domaine]/console`
- E-mail : `ADMIN_EMAIL` (par défaut `alexadisenhouse@gmail.com`)
- Mot de passe : celui défini au déploiement, ou `Adisen2026!` par défaut au premier lancement.

**Changez le mot de passe immédiatement** : site → Mon compte → Mot de passe. Le même compte
sert au site public et à la console.

## Tableau de bord

Revenus encaissés, chapitres vendus, activité des 30 derniers jours, lecteurs inscrits, état des
prestataires (Wave, Orange Money, envoi d'e-mails). Les boutons mènent directement aux paiements
à traiter ou à la publication.

## Romans & chapitres

- **Nouveau roman** : titre, auteur (laissez libre pour publier un partenaire), accroche, résumé,
  catégorie, prix du chapitre, nombre de chapitres offerts, statut. La couverture s'ajoute par
  URL (`/media/covers/…`) ou en déposant un fichier (3 Mo maximum).
- **Publier / dépublier** : le statut `Publié` rend le roman visible dans la bibliothèque ;
  `Brouillon` le garde privé ; `Archivé` le retire sans le supprimer.
- **Chapitres** : cliquez sur un roman pour lister ses chapitres. Chaque ligne peut être ouverte
  (titre, texte, gratuit ou payant, brouillon ou publié) ou supprimée.
- **Importer un manuscrit** : collez le texte entier. Le découpage se fait sur les lignes
  `Chapitre 1`, `Chapitre 2`… (ou `CHAPITRE PREMIER`). Deux modes : remplacer les chapitres
  existants ou ajouter à la suite. Les chapitres importés sont publiés, et les deux premiers
  (ou le nombre configuré) sont marqués offerts.

Numérotation : un chapitre ajouté à la main prend automatiquement le numéro suivant.

## Messages

Chaque envoi du formulaire de contact arrive ici avec le nom et l'e-mail du lecteur. Ouvrir un
message le marque comme lu ; la réponse est enregistrée sous le message (statut « Répondu »).
L'envoi réel par e-mail nécessite `RESEND_API_KEY` ; sans cette clé, la réponse est conservée
dans la console et le bouton « Répondre depuis ma messagerie » ouvre votre client mail.

## Ventes

C'est le cœur du contrôle des paiements.

1. Le lecteur choisit un chapitre payant, sélectionne Wave ou Orange Money, et reçoit une
   **référence** (`BF-2026-XXXXXXXX`) à indiquer dans son paiement.
2. Vous vérifiez le règlement sur votre relevé Wave / Orange Money.
3. Onglet **Ventes → En attente** : si la référence correspond, cliquez **Valider**. Le chapitre
   s'ouvre immédiatement pour ce lecteur, définitivement.
4. Si le paiement est introuvable : **Refuser** (le lecteur peut recommencer).
5. Après un litige : **Rembourser** sur une commande payée.

Un paiement automatique (Wave API, Orange API, CinetPay) ne peut jamais être validé à la main :
la validation manuelle est réservée aux encaissements vérifiés hors plateforme.

## Réglages

Tout ce qui est public se règle ici, sans toucher au code : nom du site, signature, e-mail et
téléphone d'assistance, éditeur, adresse, horaires, lien marchand Wave, numéro Orange Money,
prix du chapitre, chapitres offerts, activation de chaque moyen de paiement. Les changements
sont immédiats sur la page Contact, le pied de page, les CGU et la fenêtre de paiement.

## Bonnes pratiques

- Choisissez un mot de passe long et unique ; ne le partagez pas dans une conversation.
- Vérifiez une commande sur le relevé **avant** de valider : la référence est la seule preuve.
- Relisez un chapitre importé (ponctuation, sauts de paragraphe) avant de le rendre payant.
- Sauvegardez la base : `data/book-forever.db` (voir `docs/DEPLOY.md`).
