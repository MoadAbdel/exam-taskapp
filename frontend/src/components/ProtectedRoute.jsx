/**
 * Route protegee : affiche son contenu seulement si l'utilisateur est connecte.
 * Sinon, redirige vers /login (corrige l'acces direct a /tasks sans session).
 */
import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

/** @param {{children: import('react').ReactNode}} props */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="status">Chargement...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
