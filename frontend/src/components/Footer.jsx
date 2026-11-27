/** Pied de page : annee calculee et lien vers la politique de confidentialite. */
import { Link } from 'react-router';

export default function Footer() {
  return (
    <footer className="footer">
      <p>
        &copy; {new Date().getFullYear()} Application Mes Taches - <Link to="/privacy">Confidentialite</Link>
      </p>
    </footer>
  );
}
