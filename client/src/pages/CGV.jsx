import React from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site.jsx';

export default function CGV() {
  const site = useSite();
  const contact = (
    <Link to="/contact">
      {site.contactEmail} — {site.contactPhone}
    </Link>
  );

  return (
    <div className="wrap">
      <div className="legal">
        <span className="eyebrow">Cadre contractuel</span>
        <h1>Conditions Générales de Vente (CGV)</h1>
        <p className="muted">
          Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')} — Conformité Loi n° 2013-546 (Transactions électroniques)
          et Loi n° 2016-412 (Consommation en République de Côte d'Ivoire).
        </p>

        <h2>1. Objet & Champ d'application</h2>
        <p>
          Les présentes Conditions Générales de Vente régissent l'ensemble des transactions commerciales et commandes de chapitres
          numériques effectuées par les utilisateurs (« Le Lecteur ») sur la plateforme <strong>{site.siteName}</strong>,
          éditée par <strong>{site.publisher || 'ADISEN — section Littérature'}</strong>.
        </p>

        <h2>2. Caractéristiques des biens et services numériques</h2>
        <ul>
          <li>
            <strong>Accès gratuit d'évaluation :</strong> Les deux (2) premiers chapitres de chaque roman du catalogue sont accessibles
            librement et gratuitement, sans obligation d'achat ni création de compte préalable.
          </li>
          <li>
            <strong>Déblocage à l'unité :</strong> Les chapitres suivants sont des contenus numériques consultables en ligne sur le
            lecteur web et l'application mobile.
          </li>
          <li>
            <strong>Droit de lecture temporaire de 30 jours :</strong> L'achat d'un chapitre confère un droit d'accès personnel, non exclusif
            et sécurisé de lecture d'une durée continue de <strong>trente (30) jours</strong> à compter de la confirmation effective du paiement.
          </li>
          <li>
            <strong>Historique d'achat permanent :</strong> Même après l'expiration de la période de lecture de 30 jours, la trace de
            la commande et le reçu électronique certifié demeurent conservés et consultables sans limitation de durée dans la rubrique
            « Mes transactions » du compte lecteur.
          </li>
        </ul>

        <h2>3. Tarification & Formules d'accès</h2>
        <p>
          Les prix sont indiqués en <strong>Francs CFA (XOF)</strong>, toutes taxes comprises. La grille tarifaire est structurée comme suit :
        </p>
        <ul>
          <li><strong>Chapitre à l'unité :</strong> 300 FCFA par chapitre. Chaque chapitre acheté reste accessible 30 jours sur le compte du lecteur.</li>
          <li><strong>Pass Finir un roman (7 jours) :</strong> 500 FCFA pour lire sans limite pendant 7 jours.</li>
          <li><strong>Pack 5 chapitres :</strong> 1 200 FCFA (soit 240 FCFA le chapitre sous forme de crédits réutilisables).</li>
          <li><strong>Roman Intégral :</strong> 1 500 FCFA pour débloquer l'ensemble des chapitres d'un roman d'un seul coup.</li>
          <li><strong>Abonnement Mensuel Catalogue :</strong> 2 000 FCFA pour 30 jours d'accès illimité à l'ensemble des romans.</li>
          <li><strong>Pass VIP Club Littéraire :</strong> 5 000 FCFA pour 30 jours d'accès illimité, lectures en avant-première et salon exclusif.</li>
        </ul>
        <p>
          {site.siteName} se réserve le droit de modifier ses tarifs à tout moment,
          étant entendu que le tarif applicable est celui expressément affiché et validé par le lecteur lors du récapitulatif de commande.
        </p>

        <h2>4. Parcours de commande et vérification préalable</h2>
        <p>Conformément aux obligations légales d'information précontractuelle, le parcours d'achat se déroule en plusieurs étapes claires :</p>
        <ol>
          <li><strong>Sélection du chapitre :</strong> Le lecteur choisit le roman et le chapitre qu'il souhaite débloquer.</li>
          <li>
            <strong>Récapitulatif de commande (Aperçu du panier) :</strong> Un écran de synthèse présente le roman, le numéro de chapitre,
            le prix exact (300 FCFA), la durée de lecture (30 jours) et le mode de règlement. Le lecteur peut vérifier, modifier son choix
            ou annuler avant de confirmer.
          </li>
          <li><strong>Acceptation des CGV :</strong> Le lecteur valide expressément les présentes conditions.</li>
          <li>
            <strong>Accusé de réception de commande :</strong> Une référence unique de commande (ex: <code>BF-2026-XXXX</code>) est générée
            avec les instructions de règlement (statut : En attente de paiement).
          </li>
        </ol>

        <h2>5. Modalités de paiement acceptées</h2>
        <p>
          Les règlements s'effectuent par Mobile Money via les opérateurs agréés en Côte d'Ivoire et dans la zone UEMOA :
        </p>
        <ul>
          <li><strong>Wave :</strong> Via lien marchand sécurisé direct.</li>
          <li><strong>Orange Money :</strong> Vers le numéro marchand officiel ({site.orangeNumber || '0706486904'}).</li>
        </ul>
        <p>
          Le lecteur s'engage à indiquer impérativement sa <strong>référence de commande</strong> lors de l'envoi de son transfert afin
          de permettre l'identification immédiate de sa transaction.
        </p>

        <h2>6. Validation serveur et Reçu électronique certifié</h2>
        <p>
          Le droit de lecture est débloqué dès la validation effective du paiement par le serveur. Dès confirmation :
        </p>
        <ul>
          <li>Le chapitre passe en statut « Débloqué » dans la bibliothèque du lecteur.</li>
          <li>
            Un <strong>Reçu électronique certifié</strong> portant un numéro unique (ex: <code>BF-REC-2026-XXXX</code>), le montant,
            le moyen de paiement, la date exacte de confirmation et la date d'expiration (+30 jours) est généré et stocké dans l'espace
            « Mes transactions ». Ce reçu est consultable et téléchargeable au format imprimable/PDF.
          </li>
        </ul>

        <h2>7. Droit de rétractation et contenu numérique immédiat</h2>
        <p>
          Conformément à la réglementation sur les contrats de fourniture de contenus numériques non fournis sur un support matériel,
          le lecteur reconnaît et accepte expressément qu'en validant sa commande et en obtenant l'accès immédiat au chapitre littéraire
          dès validation du paiement, il renonce expressément à son droit de rétractation pour le chapitre concerné.
        </p>

        <h2>8. Procédure de réclamation et politique de remboursement</h2>
        <p>
          En cas d'anomalie technique (ex : double débit, chapitre payé non ouvert après 30 minutes, erreur de référence) :
        </p>
        <ul>
          <li>
            Le lecteur peut ouvrir immédiatement un dossier d'assistance dans la rubrique <Link to="/reclamations">Aide & Réclamations</Link>{' '}
            ou par e-mail à {contact}.
          </li>
          <li>Un numéro de dossier unique lui est attribué avec un suivi en temps réel (OUVERT, EN COURS, RESOLU).</li>
          <li>
            Après vérification, {site.siteName} procède soit à l'ouverture manuelle immédiate des droits, soit au remboursement intégral
            de la somme indûment perçue via le même moyen de paiement Mobile Money.
          </li>
        </ul>

        <h2>9. Archivage, Intégrité et Preuve</h2>
        <p>
          Les registres informatisés, commandes, transactions et reçus conservés dans les systèmes de {site.siteName} dans des conditions
          raisonnables de sécurité seront considérés comme les preuves des communications, des commandes et des paiements intervenus entre
          les parties, conformément à la Loi n° 2013-546.
        </p>

        <h2>10. Droit applicable et juridiction compétente</h2>
        <p>
          Les présentes CGV sont soumises à la législation de la République de Côte d'Ivoire. Tout litige relatif à leur interprétation
          ou à leur exécution fera l'objet d'une tentative de règlement amiable avant toute saisine des juridictions compétentes d'Abidjan.
        </p>
      </div>
    </div>
  );
}
