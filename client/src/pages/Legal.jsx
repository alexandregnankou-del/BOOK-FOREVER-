import { Link } from 'react-router-dom';
import { useSite } from '../site.jsx';

export default function Legal({ kind }) {
  const site = useSite();
  const contact = (
    <Link to="/contact">
      {site.contactEmail} — {site.contactPhone}
    </Link>
  );

  if (kind === 'terms') {
    return (
      <div className="wrap">
        <div className="legal">
          <span className="eyebrow">Informations légales</span>
          <h1>Conditions d’utilisation</h1>
          <p className="muted">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

          <h2>1. Objet</h2>
          <p>
            {site.siteName} est une librairie numérique éditée par {site.publisher} ({site.address}). Elle permet
            de lire les romans du catalogue en ligne, chapitre par chapitre, sur téléphone, tablette ou
            ordinateur.
          </p>

          <h2>2. Chapitres offerts et chapitres payants</h2>
          <p>
            Les deux premiers chapitres de chaque roman sont accessibles gratuitement. Les chapitres suivants sont
            vendus à l’unité au prix de {site.priceXof} FCFA par chapitre. Le prix affiché au moment de l’achat
            est celui qui s’applique.
          </p>

          <h2>3. Compte lecteur</h2>
          <p>
            Un compte (adresse e-mail et mot de passe) est nécessaire pour débloquer et conserver un chapitre. Vous
            êtes responsable de la confidentialité de votre mot de passe. Un achat est rattaché au compte utilisé
            lors du déblocage.
          </p>

          <h2>4. Paiement et déblocage</h2>
          <ul>
            <li>Les paiements sont reçus par Wave (lien marchand) ou Orange Money ({site.orangeNumber}).</li>
            <li>
              Chaque demande génère une référence unique. Le chapitre est ouvert après vérification manuelle du
              règlement, en général sous 30 minutes pendant les heures d’ouverture.
            </li>
            <li>
              Aucun prélèvement automatique : le pass, le pack de chapitres et l’abonnement s’activent après un
              transfert que vous faites vous-même, et ne se renouvellent jamais sans une nouvelle demande de
              votre part.
            </li>
            <li>
              En cas d’erreur de montant ou de référence, écrivez à {contact} avec la référence de la commande :
              nous corrigeons ou remboursons.
            </li>
          </ul>

          <h2>5. Absence de droit de rétractation après déblocage</h2>
          <p>
            Le contenu numérique est fourni immédiatement après validation du paiement. Conformément aux règles
            applicables aux contenus numériques, le chapitre débloqué n’est pas remboursable, sauf défaut technique
            de notre part ou double paiement.
          </p>

          <h2>6. Propriété intellectuelle</h2>
          <p>
            Les textes, couvertures et éléments graphiques du catalogue sont protégés par le droit d’auteur. Ils
            sont réservés à un usage personnel de lecture. Toute reproduction, revente, mise en ligne ou
            redistribution, totale ou partielle, est interdite sans autorisation écrite de l’éditeur ou de
            l’auteur.
          </p>

          <h2>7. Espace Auteurs, Inscription & Rémunération (Royalties)</h2>
          <p>
            {site.siteName} permet aux auteurs tiers de publier et commercialiser leurs romans numériques sur la plateforme selon les conditions suivantes :
          </p>
          <ul>
            <li>
              <strong>Frais d'inscription et de publication :</strong> Pour soumettre une œuvre et accéder aux services de distribution numérique, 
              l'auteur s'acquitte d'un forfait unique d'inscription de <strong>7 500 FCFA</strong> par ouvrage (payable après acceptation éditoriale). 
              Ces frais couvrent l'analyse éditoriale, la mise en page numérique sécurisée, l'adaptation de la couverture au format de la plateforme, 
              le découpage en chapitres et la diffusion sur le site web et l'application mobile.
            </li>
            <li>
              <strong>Répartition des revenus (Royalties) :</strong> Sur chaque vente de chapitre débloqué et payé par les lecteurs (au tarif unitaire de {site.priceXof || 300} FCFA) :
              <ul>
                <li><strong>80% du montant net</strong> revient directement à l'auteur de l'œuvre.</li>
                <li><strong>20% de commission</strong> est conservé par {site.siteName} pour couvrir les coûts d'hébergement, la maintenance des serveurs et les frais de traitement technique.</li>
              </ul>
            </li>
            <li>
              <strong>Modalités de reversement :</strong> Les gains de l'auteur sont reversés via Mobile Money (Wave ou Orange Money) sur le numéro indiqué par l'auteur, selon une périodicité convenue dès que le solde atteint le seuil minimum de reversement.
            </li>
            <li>
              <strong>Propriété des œuvres :</strong> L'auteur reste l'unique et exclusif titulaire de ses droits de propriété intellectuelle. Il accorde à {site.siteName} un droit non exclusif de diffusion numérique.
            </li>
          </ul>

          <h2>8. Comportement et accès</h2>
          <p>
            L’éditeur peut suspendre un compte en cas de tentative de contournement du paiement, de partage massif
            de contenus ou d’usage frauduleux du service.
          </p>

          <h2>9. Disponibilité</h2>
          <p>
            Le service est fourni « en l’état ». Des interruptions techniques peuvent survenir ; les chapitres
            achetés restent acquis sur le compte et redeviennent accessibles dès le rétablissement du service.
          </p>

          <h2>10. Droit applicable et contact</h2>
          <p>
            Les présentes conditions sont soumises au droit ivoirien. Pour toute question, réclamation ou demande
            relative à vos données : {contact}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="legal">
        <span className="eyebrow">Informations légales</span>
        <h1>Politique de confidentialité</h1>
        <p className="muted">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

        <h2>1. Données collectées</h2>
        <ul>
          <li>Compte lecteur : adresse e-mail, nom affiché, mot de passe stocké sous forme chiffrée (jamais en clair).</li>
          <li>Auteurs candidats & publiés : nom / nom de plume, adresse e-mail, numéro WhatsApp / téléphone, coordonnées Mobile Money (Wave / Orange Money) pour le reversement des 80% de royalties, synopsis et manuscrits soumis.</li>
          <li>Commandes : chapitre demandé, montant, moyen de paiement, référence, statut.</li>
          <li>Lecture : dernier chapitre ouvert, pour reprendre la lecture où vous l’avez laissée.</li>
          <li>Messages envoyés via le formulaire de contact : nom, e-mail, contenu du message.</li>
        </ul>

        <h2>2. Finalités du traitement</h2>
        <p>
          Ces données servent exclusivement à :
        </p>
        <ul>
          <li>Ouvrir les chapitres achetés et gérer l'accès aux lectures.</li>
          <li>Traiter les candidatures des auteurs, publier les œuvres validées (frais de 7 500 FCFA) et assurer le calcul ainsi que le reversement des 80% de royalties.</li>
          <li>Assurer l'assistance client, répondre aux messages et tenir la comptabilité légale des ventes.</li>
        </ul>
        <p>
          Aucune donnée personnelle n’est vendue, louée ni cédée à des tiers à des fins publicitaires ou commerciales.
        </p>

        <h2>3. Données financières et paiements</h2>
        <p>
          Les paiements (achat de chapitres à 300 FCFA ou inscription auteur à 7 500 FCFA) et les reversements de royalties s'effectuent directement via les réseaux sécurisés Mobile Money (Wave et Orange Money). Nous ne collectons ni ne stockons aucun code PIN, mot de passe ou identifiant bancaire confidentiel.
        </p>

        <h2>4. Conservation</h2>
        <p>
          Les données de compte et de commande sont conservées tant que le compte existe, puis archivées le temps
          nécessaire aux obligations comptables. Les messages de contact sont conservés deux ans.
        </p>

        <h2>5. Cookies</h2>
        <p>
          Un seul cookie technique est utilisé : il maintient votre session ouverte après connexion. Aucun cookie
          publicitaire ni traceur tiers n’est installé.
        </p>

        <h2>6. Vos droits</h2>
        <p>
          Vous pouvez demander l’accès, la correction ou la suppression de vos données, ainsi que la fermeture de
          votre compte, en écrivant à {contact}. La suppression du compte entraîne la perte des chapitres
          débloqués.
        </p>

        <h2>7. Sécurité</h2>
        <p>
          Les mots de passe sont chiffrés, les sessions signées, et l’accès à la console d’administration est
          réservé au personnel de l’éditeur.
        </p>

        <h2>8. Responsable du traitement</h2>
        <p>
          {site.publisher} — {site.address}. Contact : {contact}.
        </p>
      </div>
    </div>
  );
}
