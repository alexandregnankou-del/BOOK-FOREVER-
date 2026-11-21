# BOOK FOREVER — Politique et Procédure de Sauvegarde Externe

Ce document détaille la stratégie et les procédures de sauvegarde externe et de restauration des données de BOOK FOREVER, assurant la résilience et la continuité de service indépendamment des limites des offres hébergeurs (notamment Supabase / SQLite / Render).

---

## 1. Objectifs & Données couvertes

La procédure de sauvegarde exporte et protège l'ensemble des données vitales :
- **Catalogue & Contenu :** Romans, métadonnées, chapitres intégraux et textes.
- **Transactions & Traçabilité :** Commandes, références, statuts de paiement.
- **Reçus Électroniques :** Reçus certifiés conformes à la Loi n° 2013-546, dates d'expiration (+30 jours).
- **Service Client :** Réclamations, numéros de dossier, échanges et résolutions.
- **Profils Lecteurs & Auteurs :** Historiques de lecture, favoris, statuts auteurs.

*Remarque de sécurité :* Les clés d'API tierces (Wave, Orange, Resend) et les mots de passe maîtres d'administration ne sont jamais inclus dans les exports accessibles.

---

## 2. Commandes de Sauvegarde et Restauration

### A. Générer une sauvegarde externe
```bash
node scripts/backup.mjs
```
Cette commande :
1. Extrait l'ensemble des tables métier.
2. Calcule une empreinte de sécurité **SHA-256**.
3. Génère un fichier timestampé sous `backups/backup-book-forever-YYYY-MM-DD-HHmmss.json`.

### B. Restaurer une sauvegarde
```bash
node scripts/restore.mjs backups/backup-book-forever-YYYY-MM-DD-HHmmss.json
```
Cette commande :
1. Valide l'intégrité du fichier et son checksum SHA-256.
2. Exécute une transaction atomique SQLite (`INSERT OR REPLACE`) garantissant l'absence de corruption de données.

---

## 3. Plan de Reprise d'Activité (PRA)

En cas de réinitialisation de serveur ou de migration :
1. Cloner le dépôt source `BOOK-FOREVER-`.
2. Installer les dépendances : `npm install`.
3. Initialiser la base de données : `npm run seed`.
4. Appliquer le dernier fichier de sauvegarde : `node scripts/restore.mjs backups/[dernier-fichier].json`.
5. Vérifier la conformité : `npm test`.
