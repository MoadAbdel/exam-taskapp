/**
 * Page "Mes taches" (route protegee).
 *
 * Corrige :
 * - une tache ajoutee n'apparaissait qu'apres rafraichissement (addTask etait vide) ;
 * - erreur de chargement non geree (promesse rejetee, ecran vide) ;
 * - aucun moyen de marquer une tache terminee ou de la modifier ;
 * - mises a jour de la liste basees sur un etat perime : on utilise la forme fonctionnelle de setTasks ;
 * - session expiree : retour a la connexion avec un message.
 */
import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api';
import TaskForm from '../components/TaskForm';
import TaskItem from '../components/TaskItem';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

export default function Tasks() {
  const { setUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /** Gere une erreur d'API : session expiree -> deconnexion locale, sinon message. */
  const handleError = useCallback(
    (err) => {
      if (err?.response?.status === 401) {
        setUser(null);
        return;
      }
      setError(errorMessage(err));
    },
    [setUser],
  );

  useEffect(() => {
    api
      .get('/tasks')
      .then((res) => setTasks(res.data))
      .catch(handleError)
      .finally(() => setLoading(false));
  }, [handleError]);

  const createTask = async (title) => {
    const res = await api.post('/tasks', { title });
    setTasks((prev) => [res.data, ...prev]);
  };

  const updateTask = async (id, changes) => {
    try {
      setError('');
      const res = await api.put(`/tasks/${id}`, changes);
      setTasks((prev) => prev.map((t) => (t._id === id ? res.data : t)));
    } catch (err) {
      handleError(err);
    }
  };

  const deleteTask = async (id) => {
    try {
      setError('');
      await api.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      handleError(err);
    }
  };

  const remaining = tasks.filter((t) => !t.isCompleted).length;

  return (
    <section className="container">
      <h1>Mes taches</h1>
      <TaskForm onCreate={createTask} />
      <Alert>{error}</Alert>
      {loading ? (
        <p className="status">Chargement...</p>
      ) : tasks.length === 0 ? (
        <p className="status">Aucune tache pour le moment.</p>
      ) : (
        <>
          <p className="status" aria-live="polite">
            {remaining} tache(s) a faire sur {tasks.length}
          </p>
          <ul className="task-list">
            {tasks.map((task) => (
              <TaskItem key={task._id} task={task} onUpdate={updateTask} onDelete={deleteTask} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
