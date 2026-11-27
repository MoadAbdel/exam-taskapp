/** Politique de confidentialite (information des personnes, RGPD articles 12 et 13). */
import { Link } from 'react-router';

export default function Privacy() {
  return (
    <article className="container legal">
      <h1>Confidentialite et donnees personnelles</h1>

      <h2>Responsable du traitement</h2>
      <p>
        L&apos;editeur de l&apos;application Mes Taches (projet de formation). Contact et demandes :{' '}
        <a href="https://github.com/MoadAbdel/exam-taskapp/issues">formulaire de demande</a> (n&apos;y indiquez aucune
        donnee personnelle, un canal prive vous sera propose).
      </p>

      <h2>Donnees traitees</h2>
      <ul>
        <li>
          Compte : nom d&apos;utilisateur (un pseudonyme suffit) et mot de passe, stocke uniquement sous forme de hash.
        </li>
        <li>Contenu : vos taches.</li>
        <li>Securite : adresse IP, date et type d&apos;evenement (connexion, echec, suppression).</li>
      </ul>
      <p>Aucun e-mail, aucune publicite, aucun outil de mesure d&apos;audience, aucune vente de donnees.</p>

      <h2>Finalites et bases legales</h2>
      <ul>
        <li>Fournir le service : execution du contrat (article 6.1.b).</li>
        <li>Proteger les comptes et le service : interet legitime (article 6.1.f).</li>
      </ul>

      <h2>Durees de conservation</h2>
      <ul>
        <li>Compte et taches : jusqu&apos;a la suppression du compte.</li>
        <li>Evenements de securite : 90 jours.</li>
        <li>Journaux techniques de supervision : 14 jours au plus, adresses IP tronquees.</li>
        <li>Sauvegardes chiffrees : 30 jours.</li>
      </ul>

      <h2>Sous-traitants</h2>
      <ul>
        <li>Vercel (hebergement, traitement a Paris).</li>
        <li>MongoDB Atlas (base de donnees, Paris).</li>
        <li>Grafana Labs (supervision, region Union europeenne).</li>
        <li>Vercel Blob (sauvegardes chiffrees, stockage prive a Paris).</li>
      </ul>
      <p>
        Certains de ces prestataires sont des societes americaines. Les transferts eventuels sont encadres par leurs
        accords de traitement des donnees (cadre UE - Etats-Unis ou clauses contractuelles types).
      </p>

      <h2>Cookies</h2>
      <p>
        Un seul cookie, <code>token</code> : il maintient votre session (1 heure). Strictement necessaire au service, il
        est dispense de consentement. Aucun autre cookie ni traceur.
      </p>

      <h2>Vos droits</h2>
      <p>
        Acces, portabilite et effacement : page <Link to="/account">Mon compte</Link>. Rectification : modifiez vos
        taches. Pour l&apos;opposition ou la limitation, utilisez le formulaire de demande. Vous pouvez aussi saisir la{' '}
        <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.
      </p>
    </article>
  );
}
