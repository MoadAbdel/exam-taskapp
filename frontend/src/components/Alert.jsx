/**
 * Message de retour pour l'utilisateur (erreur ou succes).
 * `role="alert"` : les lecteurs d'ecran annoncent le message (accessibilite).
 * @param {{type?: 'error'|'success', children: import('react').ReactNode}} props
 */
export default function Alert({ type = 'error', children }) {
  if (!children) return null;
  return (
    <p role={type === 'error' ? 'alert' : 'status'} className={`alert alert-${type}`}>
      {children}
    </p>
  );
}
