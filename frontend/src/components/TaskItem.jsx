/**
 * Une ligne de la liste : case "terminee", titre modifiable, suppression.
 * Le titre est rendu comme texte par React (jamais en HTML) : pas d'injection de script.
 *
 * @param {{task: {_id: string, title: string, isCompleted: boolean},
 *   onUpdate: (id: string, changes: object) => Promise<void>,
 *   onDelete: (id: string) => Promise<void>}} props
 */
import { useState } from 'react';

export default function TaskItem({ task, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const save = async (e) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title || title === task.title) {
      setDraft(task.title);
      setEditing(false);
      return;
    }
    await onUpdate(task._id, { title });
    setEditing(false);
  };

  return (
    <li className={`task-item ${task.isCompleted ? 'completed' : ''}`}>
      <input
        type="checkbox"
        checked={task.isCompleted}
        onChange={() => onUpdate(task._id, { isCompleted: !task.isCompleted })}
        aria-label={`Marquer "${task.title}" comme ${task.isCompleted ? 'a faire' : 'terminee'}`}
      />
      {editing ? (
        <form onSubmit={save} className="edit-form">
          <input
            aria-label="Nouveau titre"
            value={draft}
            maxLength={200}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setDraft(task.title), setEditing(false))}
          />
          <button type="submit" className="btn-small">
            Enregistrer
          </button>
        </form>
      ) : (
        <span className="task-title">{task.title}</span>
      )}
      {!editing && (
        <button type="button" className="btn-small btn-secondary" onClick={() => setEditing(true)}>
          Modifier
        </button>
      )}
      <button
        type="button"
        className="btn-small btn-danger"
        onClick={() => onDelete(task._id)}
        aria-label={`Supprimer "${task.title}"`}
      >
        Supprimer
      </button>
    </li>
  );
}
