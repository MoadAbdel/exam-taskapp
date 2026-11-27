// Test de bout en bout dans un vrai navigateur + captures d'ecran pour le rendu.
// Usage : node scripts/e2e-captures.mjs https://exam-taskapp.vercel.app docs/captures
// Prerequis : npm i -D playwright (ou un dossier ou playwright est installe, via NODE_PATH).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const BASE = process.argv[2] ?? 'https://exam-taskapp.vercel.app';
const OUT = process.argv[3] ?? 'docs/captures';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 720 }, locale: 'fr-FR' });
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('dialog', (d) => {
  consoleErrors.push(`dialog inattendu (XSS ?) : ${d.message()}`);
  d.dismiss();
});
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const user = `demo${Date.now().toString().slice(-6)}`;
page.on('response', (r) => r.url().includes('/api/') && r.status() >= 400 && console.log('API', r.status(), r.url()));
process.on('uncaughtException', async (err) => {
  console.error('ECHEC :', err.message.split('\n')[0]);
  console.error('Page :', page.url(), (await page.locator('body').innerText()).replace(/\n/g, ' | ').slice(0, 400));
  await page.screenshot({ path: `${OUT}/echec.png`, fullPage: true });
  process.exit(1);
});

// 1. Acces direct a /tasks sans session -> redirection vers la connexion.
await page.goto(`${BASE}/tasks`);
await page.getByRole('heading', { name: 'Connexion' }).waitFor();
await shot('01-connexion');

// 2. Formulaire vide -> message.
await page.getByRole('button', { name: 'Se connecter' }).click();
await page.getByRole('alert').waitFor();
await shot('02-formulaire-vide');

// 3. Mauvais identifiants -> message de l'API.
await page.getByLabel("Nom d'utilisateur").fill('inconnu');
await page.getByLabel('Mot de passe').fill('mauvais123');
await page.getByRole('button', { name: 'Se connecter' }).click();
await page.getByText('Nom d\'utilisateur ou mot de passe incorrect.').waitFor();
await shot('03-mauvais-identifiants');

// 4. Inscription avec mot de passe faible puis valide.
await page.getByRole('link', { name: 'Inscription' }).click();
await page.getByLabel("Nom d'utilisateur").fill(user);
await page.getByLabel('Mot de passe').fill('123');
await page.getByRole('button', { name: 'Creer mon compte' }).click();
await page.getByRole('alert').waitFor();
await shot('04-mot-de-passe-faible');
await page.getByLabel('Mot de passe').fill('motdepasse1');
await page.getByRole('button', { name: 'Creer mon compte' }).click();
await page.getByText(`Bonjour, ${user}`).waitFor();

// 5. Ajout de taches : visibles sans rafraichir.
for (const t of ['Preparer la soutenance', 'Verifier la supervision', 'Relire le CHANGELOG']) {
  await page.getByLabel('Nouvelle tache').fill(t);
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await page.getByText(t).waitFor();
}

// 6. Tentative XSS -> refusee par l'API, message affiche, aucun script execute.
await page.getByLabel('Nouvelle tache').fill("<script>alert('test')</script>");
await page.getByRole('button', { name: 'Ajouter' }).click();
await page.getByText('ne doit pas contenir').waitFor();
await shot('05-xss-refuse');
await page.getByLabel('Nouvelle tache').fill('');

// 7. Cocher, modifier.
await page.getByRole('checkbox', { name: /Verifier la supervision/ }).check();
await page.getByText('Verifier la supervision').locator('xpath=ancestor::li').getByRole('button', { name: 'Modifier' }).click();
await page.getByLabel('Nouveau titre').fill('Verifier la supervision et les alertes');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Verifier la supervision et les alertes').waitFor();
await shot('06-liste-taches');

// 8. Persistance : la liste survit au rechargement (donnees en base Atlas).
await page.reload();
await page.getByText('Verifier la supervision et les alertes').waitFor();
assert.equal(await page.getByRole('checkbox', { name: /Verifier la supervision/ }).isChecked(), true);

// 9. Suppression.
await page.getByRole('button', { name: 'Supprimer "Relire le CHANGELOG"' }).click();
await page.getByText('Relire le CHANGELOG').waitFor({ state: 'detached' });

// 10. Le jeton n'est pas lisible par JavaScript.
assert.equal(await page.evaluate(() => document.cookie.includes('token')), false);
assert.equal(await page.evaluate(() => localStorage.length), 0);

// 11. Mobile.
await page.setViewportSize({ width: 390, height: 780 });
await shot('07-mobile');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
assert.equal(overflow, false, 'scroll horizontal sur mobile');

// 12. Deconnexion -> retour a la connexion, /tasks inaccessible.
await page.setViewportSize({ width: 1100, height: 720 });
await page.getByRole('button', { name: 'Deconnexion' }).click();
await page.getByRole('heading', { name: 'Connexion' }).waitFor();
await page.goto(`${BASE}/tasks`);
await page.getByRole('heading', { name: 'Connexion' }).waitFor();

// 13. Sonde de sante.
await page.goto(`${BASE}/api/health`);
await shot('08-api-health');

await browser.close();
assert.deepEqual(consoleErrors.filter((e) => !/40[01]/.test(e)), [], `erreurs console : ${consoleErrors}`);
console.log(`OK : parcours complet valide sur ${BASE} (utilisateur ${user}), captures dans ${OUT}`);
