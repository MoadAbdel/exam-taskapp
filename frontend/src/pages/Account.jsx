/** Mon compte : export des donnees et suppression du compte (droits RGPD). Route protegee. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import api, { errorMessage } from '../api';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

export default function Account() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const remove = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Saisissez votre mot de passe pour confirmer.');
      return;
    }
    try {
      await api.delete('/account', { data: { password } });
      navigate('/register', { replace: true });
      setUser(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="container">
      <h1>Mon compte</h1>
      <p>
        Connecte en tant que <strong>{user.username}</strong>. <Link to="/privacy">Politique de confidentialite</Link>
      </p>

      <h2>Mes donnees</h2>
      <p>Telechargez votre compte, vos taches et vos evenements de securite au format JSON.</p>
      <a className="btn btn-link" href="/api/account/export" download>
        Telecharger mes donnees
      </a>

      <h2>Supprimer mon compte</h2>
      <p>Action definitive : le compte et toutes les taches sont effaces.</p>
      <form onSubmit={remove} noValidate>
        <Alert>{error}</Alert>
        <div className="form-group">
          <label htmlFor="confirm-password">Mot de passe</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-danger">
          Supprimer definitivement
        </button>
      </form>
    </section>
  );
}
