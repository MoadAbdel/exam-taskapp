/**
 * Formulaire commun de connexion et d'inscription.
 *
 * Corrige :
 * - formulaire vide envoye au serveur : champs `required` + verification avant envoi ;
 * - aucun retour en cas d'erreur : le message de l'API est affiche dans une zone `role="alert"` ;
 * - double envoi : le bouton est desactive pendant la requete.
 *
 * @param {{title: string, submitLabel: string, onSubmit: (u: string, p: string) => Promise<void>,
 *   passwordHint?: string, autoCompletePassword: string, footer?: import('react').ReactNode}} props
 */
import { useState } from 'react';
import Alert from './Alert';
import { errorMessage } from '../api';

export default function AuthForm({ title, submitLabel, onSubmit, passwordHint, autoCompletePassword, footer }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Renseignez le nom d'utilisateur et le mot de passe.");
      return;
    }
    setError('');
    setPending(true);
    try {
      await onSubmit(username.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <section className="container">
      <h1>{title}</h1>
      <form onSubmit={handleSubmit} noValidate>
        <Alert>{error}</Alert>
        <div className="form-group">
          <label htmlFor="username">Nom d&apos;utilisateur</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            maxLength={30}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete={autoCompletePassword}
            required
            maxLength={72}
            aria-describedby={passwordHint ? 'password-hint' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {passwordHint && (
            <small id="password-hint" className="hint">
              {passwordHint}
            </small>
          )}
        </div>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Patientez...' : submitLabel}
        </button>
      </form>
      {footer}
    </section>
  );
}
