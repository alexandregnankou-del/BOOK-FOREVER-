import { Link } from 'react-router-dom';
import { useSite } from '../site.jsx';

export default function Rules() {
  const site = useSite();

  return (
    <div className="page">
      <div className="wrap">
        <div className="legal">
          <span className="eyebrow">Charte</span>
          <h1>Règles à respecter</h1>
          <p className="muted">
            Ces règles protègent les auteurs, les lecteurs et la maison. Elles s’appliquent à toute personne qui
            ouvre un compte ou lit un chapitre sur {site.siteName}.
          </p>

          <h2>1. Lire, oui — copier, non</h2>
          <p>
            Les chapitres sont protégés par le droit d’auteur. La copie, la capture d’écran systématique, la
            réécriture, la traduction ou la diffusion d’un texte, en tout ou partie, sont interdites sans
            autorisation écrite de l’éditeur et de l’auteur.
          </p>
          <p>
            Le site et l’application désactivent volontairement la sélection et la copie du texte de lecture.
            Ce n’est pas une brimade : c’est la seule façon de faire vivre un catalogue vendu au chapitre.
          </p>

          <h2>2. Un compte, une personne</h2>
          <p>
            Un compte est personnel. Le partage d’identifiants, la revente d’accès ou la mise en commun d’un
            compte entre plusieurs personnes sont interdits. Un chapitre débloqué l’est pour un compte, pas pour
            un groupe.
          </p>

          <h2>3. Payer honnêtement</h2>
          <p>
            Une déclaration de paiement doit correspondre à un transfert réellement effectué. Déclarer un paiement
            sans avoir payé, ou fournir une fausse référence, entraîne la fermeture du compte et l’annulation des
            accès, sans préjudice de poursuites.
          </p>

          <h2>4. Respecter les personnes</h2>
          <p>
            Les messages adressés à la maison — assistance, candidature d’auteur — ne doivent contenir ni insultes,
            ni propos haineux, ni contenu illicite. Les manuscrits envoyés doivent être votre travail ; la
            reproduction d’une œuvre d’autrui est écartée d’office.
          </p>

          <h2>5. Ne pas contourner la technique</h2>
          <p>
            Toute tentative d’extraire le catalogue de façon automatisée (aspiration du site, script de
            téléchargement massif, contournement des protections) est interdite et peut être signalée.
          </p>

          <h2>6. Ce que nous nous engageons à faire</h2>
          <p>
            En contrepartie : publier des textes relus, indiquer clairement le prix avant tout achat, ouvrir un
            chapitre dès la validation du paiement, et répondre aux messages d’assistance pendant les heures
            indiquées ({site.supportHours}).
          </p>

          <h2>7. Sanctions</h2>
          <p>
            En cas de manquement : avertissement, suspension temporaire, puis fermeture définitive du compte.
            Les chapitres débloqués sont perdus en cas de fermeture, sans remboursement.
          </p>

          <h2>8. Nous joindre</h2>
          <p>
            Pour signaler une diffusion non autorisée, demander une autorisation de reproduction, ou poser une
            question sur ces règles : <Link to="/contact">{site.contactEmail}</Link> — {site.contactPhone}.
          </p>

          <p className="hint" style={{ marginTop: 26 }}>
            Voir aussi les <Link to="/conditions">conditions d’utilisation</Link> et la{' '}
            <Link to="/confidentialite">politique de confidentialité</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
