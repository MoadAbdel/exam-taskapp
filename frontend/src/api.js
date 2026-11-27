/**
 * Client HTTP de l'API.
 *
 * - URL relative `/api` : le frontend et l'API sont servis sur le meme domaine
 *   (Vercel en preprod et prod, nginx en Docker, proxy Vite en local). Plus d'URL localhost en dur.
 * - `VITE_API_URL` permet de viser une autre API si besoin.
 * - `withCredentials` : le cookie de session httpOnly est envoye automatiquement.
 *   Le jeton n'est plus stocke dans localStorage (lisible par un script XSS).
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 10000,
});

/**
 * Extrait un message lisible d'une erreur axios.
 * @param {unknown} err Erreur levee par axios.
 * @param {string} [fallback] Message par defaut.
 * @returns {string}
 */
export function errorMessage(err, fallback = 'Une erreur est survenue. Reessayez.') {
  if (err?.response?.data?.msg) return err.response.data.msg;
  if (err?.code === 'ECONNABORTED' || !err?.response) return 'Serveur injoignable. Verifiez votre connexion.';
  return fallback;
}

export default api;
