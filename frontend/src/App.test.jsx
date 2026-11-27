/**
 * Tests du frontend : l'API est simulee (vi.mock), on verifie le comportement visible.
 * Chaque test couvre un bug corrige (voir CHANGELOG.md).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import api from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig();
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const user = { _id: 'u1', username: 'alice' };
const apiError = (status, msg) => Object.assign(new Error(msg), { response: { status, data: { msg } } });

beforeEach(() => {
  vi.resetAllMocks();
  window.history.pushState({}, '', '/');
});

describe('session', () => {
  test('visiteur non connecte : redirige vers la connexion', async () => {
    api.get.mockRejectedValueOnce(apiError(401, 'Authentification requise.'));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inscription' })).toBeInTheDocument();
  });

  test('formulaire de connexion vide : message, aucun appel API', async () => {
    api.get.mockRejectedValueOnce(apiError(401, 'x'));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Se connecter' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Renseignez');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('mauvais identifiants : le message de l API est affiche', async () => {
    api.get.mockRejectedValueOnce(apiError(401, 'x'));
    api.post.mockRejectedValueOnce(apiError(401, "Nom d'utilisateur ou mot de passe incorrect."));
    render(<App />);
    await userEvent.type(await screen.findByLabelText("Nom d'utilisateur"), 'alice');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'faux12345');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('incorrect');
  });

  test('connexion reussie puis deconnexion', async () => {
    api.get.mockRejectedValueOnce(apiError(401, 'x')).mockResolvedValueOnce({ data: [] });
    api.post.mockResolvedValueOnce({ data: { user } }).mockResolvedValueOnce({});
    render(<App />);
    await userEvent.type(await screen.findByLabelText("Nom d'utilisateur"), 'alice');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Bonjour, alice')).toBeInTheDocument();
    expect(await screen.findByText('Aucune tache pour le moment.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Deconnexion' }));
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });

  test('inscription : compte cree et connecte', async () => {
    window.history.pushState({}, '', '/register');
    api.get.mockRejectedValueOnce(apiError(401, 'x')).mockResolvedValueOnce({ data: [] });
    api.post.mockResolvedValueOnce({ data: { user } });
    render(<App />);
    await userEvent.type(await screen.findByLabelText("Nom d'utilisateur"), 'alice');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await userEvent.click(screen.getByRole('button', { name: 'Creer mon compte' }));
    expect(await screen.findByText('Bonjour, alice')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/register', { username: 'alice', password: 'motdepasse1' });
  });
});

describe('RGPD', () => {
  test('politique de confidentialite accessible sans compte', async () => {
    window.history.pushState({}, '', '/privacy');
    api.get.mockRejectedValueOnce(apiError(401, 'x'));
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Confidentialite et donnees/ })).toBeInTheDocument();
  });

  test('mon compte : export propose et suppression confirmee par mot de passe', async () => {
    window.history.pushState({}, '', '/account');
    api.get.mockResolvedValueOnce({ data: { user } });
    api.delete.mockResolvedValueOnce({});
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Telecharger mes donnees' })).toHaveAttribute(
      'href',
      '/api/account/export',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer definitivement' }));
    expect(screen.getByRole('alert')).toHaveTextContent('mot de passe');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'motdepasse1');
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer definitivement' }));
    expect(await screen.findByRole('heading', { name: 'Inscription' })).toBeInTheDocument();
    expect(api.delete).toHaveBeenCalledWith('/account', { data: { password: 'motdepasse1' } });
  });
});

describe('taches', () => {
  const tasks = [{ _id: 't1', title: 'Courses', isCompleted: false }];

  beforeEach(() => {
    window.history.pushState({}, '', '/tasks');
  });

  test('ajout : la tache apparait sans rafraichir la page', async () => {
    api.get.mockResolvedValueOnce({ data: { user } }).mockResolvedValueOnce({ data: [] });
    api.post.mockResolvedValueOnce({ data: { _id: 't2', title: 'Nouvelle', isCompleted: false } });
    render(<App />);
    await userEvent.type(await screen.findByLabelText('Nouvelle tache'), 'Nouvelle');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText('Nouvelle')).toBeInTheDocument();
  });

  test('ajout d un titre vide bloque', async () => {
    api.get.mockResolvedValueOnce({ data: { user } }).mockResolvedValueOnce({ data: [] });
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));
    expect(screen.getByRole('alert')).toHaveTextContent('obligatoire');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('cocher, modifier puis supprimer une tache', async () => {
    api.get.mockResolvedValueOnce({ data: { user } }).mockResolvedValueOnce({ data: tasks });
    api.put
      .mockResolvedValueOnce({ data: { ...tasks[0], isCompleted: true } })
      .mockResolvedValueOnce({ data: { ...tasks[0], isCompleted: true, title: 'Courses bio' } });
    api.delete.mockResolvedValueOnce({});
    render(<App />);

    await userEvent.click(await screen.findByRole('checkbox'));
    await waitFor(() => expect(screen.getByText('Courses').closest('li')).toHaveClass('completed'));

    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const input = screen.getByLabelText('Nouveau titre');
    await userEvent.clear(input);
    await userEvent.type(input, 'Courses bio');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Courses bio')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
    expect(await screen.findByText('Aucune tache pour le moment.')).toBeInTheDocument();
  });

  test('titre contenant du HTML : affiche comme texte, jamais execute', async () => {
    const xss = "<img src=x onerror=alert('test')>";
    api.get.mockResolvedValueOnce({ data: { user } }).mockResolvedValueOnce({
      data: [{ _id: 't3', title: xss, isCompleted: false }],
    });
    render(<App />);
    expect(await screen.findByText(xss)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  test('echec de mise a jour : la case revient a son etat et un message s affiche', async () => {
    api.get.mockResolvedValueOnce({ data: { user } }).mockResolvedValueOnce({ data: tasks });
    api.put.mockRejectedValueOnce(apiError(500, 'Erreur interne du serveur.'));
    render(<App />);
    const box = await screen.findByRole('checkbox');
    await userEvent.click(box);
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur interne');
    expect(box).not.toBeChecked();
  });

  test('erreur serveur au chargement : message visible', async () => {
    api.get.mockResolvedValueOnce({ data: { user } }).mockRejectedValueOnce(apiError(500, 'Erreur interne du serveur.'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur interne');
  });

  test('session expiree : retour a la connexion', async () => {
    api.get.mockResolvedValueOnce({ data: { user } }).mockRejectedValueOnce(apiError(401, 'Session expiree'));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });
});
