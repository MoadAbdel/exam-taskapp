/** Page de connexion. Redirige vers /tasks apres succes ou si deja connecte. */
import { Link, Navigate, useNavigate } from 'react-router';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/tasks" replace />;

  return (
    <AuthForm
      key="login" // nouvelle instance a chaque changement de page (pas d'etat partage avec l'inscription)
      title="Connexion"
      submitLabel="Se connecter"
      autoCompletePassword="current-password"
      onSubmit={async (u, p) => {
        await login(u, p);
        navigate('/tasks', { replace: true });
      }}
      footer={
        <p className="switch">
          Pas encore de compte ? <Link to="/register">Creer un compte</Link>
        </p>
      }
    />
  );
}
