/** Page d'inscription. Le compte cree est connecte directement. */
import { Link, Navigate, useNavigate } from 'react-router';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/tasks" replace />;

  return (
    <AuthForm
      key="register" // nouvelle instance : l'erreur et les champs de la page Connexion ne sont pas repris
      title="Inscription"
      submitLabel="Creer mon compte"
      autoCompletePassword="new-password"
      passwordHint="8 caracteres minimum, avec au moins une lettre et un chiffre."
      onSubmit={async (u, p) => {
        await register(u, p);
        navigate('/tasks', { replace: true });
      }}
      footer={
        <>
          <p className="hint">
            Un pseudonyme suffit. Vos donnees servent uniquement au service :{' '}
            <Link to="/privacy">politique de confidentialite</Link>.
          </p>
          <p className="switch">
            Deja inscrit ? <Link to="/login">Se connecter</Link>
          </p>
        </>
      }
    />
  );
}
