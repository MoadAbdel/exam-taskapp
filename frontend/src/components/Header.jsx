/**
 * Barre de navigation.
 * Affiche Connexion / Inscription pour un visiteur, et le nom + Deconnexion pour un utilisateur connecte.
 * Corrige : lien Inscription absent, deconnexion sans redirection, balise header imbriquee.
 */
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="header">
      <Link to={user ? '/tasks' : '/login'} className="brand">
        Mes Taches
      </Link>
      <nav aria-label="Navigation principale">
        <ul className="nav-list">
          {user ? (
            <>
              <li className="nav-user">Bonjour, {user.username}</li>
              <li>
                <Link to="/tasks" className="nav-link">
                  Mes taches
                </Link>
              </li>
              <li>
                <button type="button" onClick={handleLogout} className="nav-link nav-button">
                  Deconnexion
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link to="/login" className="nav-link">
                  Connexion
                </Link>
              </li>
              <li>
                <Link to="/register" className="nav-link">
                  Inscription
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}
