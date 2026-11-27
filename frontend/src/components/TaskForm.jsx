/**
 * Formulaire d'ajout de tache.
 *
 * Corrige : un titre vide etait envoye (erreur 500 cote serveur, rien a l'ecran) ;
 * les erreurs n'etaient visibles que dans la console.
 *
 * @param {{onCreate: (title: string) => Promise<void>}} props
 *   `onCreate` cree la tache et met a jour la liste du parent.
 */
import { useState } from 'react';
import Alert from './Alert';
import { errorMessage } from '../api';

export default function TaskForm({ onCreate }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Le titre de la tache est obligatoire.');
      return;
    }
    setError('');
    setPending(true);
    try {
      await onCreate(title.trim());
      setTitle('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="task-form" noValidate>
      <Alert>{error}</Alert>
      <label htmlFor="new-task" className="sr-only">
        Nouvelle tache
      </label>
      <div className="inline">
        <input
          id="new-task"
          type="text"
          placeholder="Ajouter une tache..."
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="btn btn-inline" disabled={pending}>
          Ajouter
        </button>
      </div>
    </form>
  );
}
