import React from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site.jsx';

export default function MentionsLegales() {
  const site = useSite();

  return (
    <div className="wrap">
      <div className="legal">
        <span className="eyebrow">Cadre réglementaire & Transparence</span>
        <h1>Mentions légales</h1>
        <p className="muted">
          Conformément aux dispositions de la <strong>Loi ivoirienne n° 2013-546 du 30 juillet 2013</strong> relative aux
          transactions électroniques et de la <strong>Loi n° 2016-412</strong> relative à la consommation.
        </p>

        <h2>1. Éditeur de la plateforme</h2>
        <table className="legal-table" style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', fontWeight: 600, width: '35%' }}>
                Dénomination / Éditeur
              </td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
                {site.publisher || 'ADISEN — section Littérature'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>
                Responsable éditorial
              </td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
                Alexandre Anderson G.
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>
                Siège / Adresse professionnelle
              </td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
                {site.address || 'Abidjan, Côte d’Ivoire'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>
                Adresse e-mail
              </td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
                <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>
                Téléphone & WhatsApp professionnel
              </td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
                {site.contactPhone}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', fontWeight: 600 }}>
                Identifiants d'enregistrement (RCCM / NIF)
              </td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
                En cours d’immatriculation & validation auprès des registres compétents de la République de Côte d'Ivoire.
              </td>
            </tr>
          </tbody>
        </table>

        <h2>2. Hébergement du service numérique</h2>
        <p>
          La plateforme BOOK FOREVER est hébergée par la société <strong>Render Services, Inc.</strong><br />
          Siège social : 525 Brannan St Suite 300, San Francisco, CA 94107, États-Unis.<br />
          Site web : <a href="https://render.com" target="_blank" rel="noreferrer">render.com</a>.
        </p>

        <h2>3. Activité commerciale et service fourni</h2>
        <p>
          BOOK FOREVER propose un service de distribution numérique d’œuvres littéraires sous forme de micro-lectures
          par chapitre. Chaque roman comporte 2 chapitres offerts en accès libre, puis des chapitres payants déblocables
          à l'unité au tarif de <strong>300 FCFA</strong> (durée de validité de lecture de 30 jours).
        </p>

        <h2>4. Propriété intellectuelle</h2>
        <p>
          L’ensemble des contenus (romans, textes, visuels, extraits sonores, éléments graphiques et code source)
          présents sur le site et l’application sont la propriété exclusive de leurs auteurs respectifs et de l’éditeur.
          Toute reproduction, diffusion, capture ou réutilisation non expressément autorisée est formellement interdite.
        </p>

        <h2>5. Données personnelles et protection de la vie privée</h2>
        <p>
          Le traitement des données à caractère personnel collectées sur BOOK FOREVER respecte les dispositions de la
          Loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel.
          Consultez notre <Link to="/confidentialite">Politique de confidentialité</Link> pour connaître vos droits.
        </p>

        <h2>6. Service client et médiation</h2>
        <p>
          Pour toute réclamation, signalement ou question relative à une commande :<br />
          - Formulaire de réclamation : <Link to="/reclamations">Ouvrir un dossier de réclamation</Link><br />
          - Assistance directe par e-mail : <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a><br />
          - Horaires de traitement : {site.supportHours || 'Lundi – samedi, 8h – 20h'}.
        </p>
      </div>
    </div>
  );
}
