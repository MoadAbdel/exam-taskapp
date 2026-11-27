/**
 * Tests d'integration de l'API (node:test + supertest + MongoDB en memoire).
 * Chaque test correspond a un bug ou une faille corrige (voir CHANGELOG.md).
 */
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let request;
let disconnectDB;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = mongod.getUri('taskapp_test');
  process.env.JWT_SECRET = 'test-secret-de-plus-de-trente-deux-caracteres';
  app = require('../app');
  ({ disconnectDB } = require('../config/db'));
  request = require('supertest');
});

after(async () => {
  await disconnectDB();
  await mongod.stop();
});

/** Cree un compte et renvoie un agent qui garde le cookie de session. */
async function signup(username, password = 'motdepasse1') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ username, password });
  assert.equal(res.status, 201);
  return agent;
}

describe('sante', () => {
  test('GET /api/health repond ok avec la base', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.db, 'up');
  });

  test('route inconnue : 404 JSON', async () => {
    const res = await request(app).get('/api/inconnue');
    assert.equal(res.status, 404);
  });

  test('en-tetes de securite presents (helmet)', async () => {
    const res = await request(app).get('/api/health');
    assert.ok(res.headers['strict-transport-security']);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

describe('authentification', () => {
  test('inscription refusee si champs vides', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: '', password: '' });
    assert.equal(res.status, 400);
    assert.match(res.body.msg, /obligatoire/);
  });

  test('inscription refusee si mot de passe faible', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'faible', password: '123' });
    assert.equal(res.status, 400);
  });

  test('inscription : cookie httpOnly, pas de jeton dans le corps', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'alice', password: 'motdepasse1' });
    assert.equal(res.status, 201);
    assert.equal(res.body.token, undefined);
    assert.equal(res.body.user.password, undefined);
    const cookie = res.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
  });

  test('inscription en double : 409', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'alice', password: 'motdepasse1' });
    assert.equal(res.status, 409);
  });

  test('connexion avec mauvais mot de passe : 401 et message clair', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'mauvais123' });
    assert.equal(res.status, 401);
    assert.match(res.body.msg, /incorrect/);
  });

  test('injection NoSQL dans la connexion refusee', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });

  test('connexion, /me puis deconnexion', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ username: 'alice', password: 'motdepasse1' });
    assert.equal(login.status, 200);
    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.user.username, 'alice');
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  test('jeton falsifie refuse avec 401 (et non 418)', async () => {
    const res = await request(app).get('/api/tasks').set('Cookie', 'token=abc.def.ghi');
    assert.equal(res.status, 401);
  });

  test('JSON invalide : 400 et non 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username":');
    assert.equal(res.status, 400);
  });
});

describe('taches', () => {
  test('acces sans session : 401', async () => {
    await request(app).get('/api/tasks').expect(401);
  });

  test('CRUD complet sur ses propres taches', async () => {
    const agent = await signup('bob');
    const created = await agent.post('/api/tasks').send({ title: '  Acheter du pain  ' });
    assert.equal(created.status, 201);
    assert.equal(created.body.title, 'Acheter du pain');

    const list = await agent.get('/api/tasks');
    assert.equal(list.body.length, 1);

    const updated = await agent.put(`/api/tasks/${created.body._id}`).send({ isCompleted: true });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.isCompleted, true);
    assert.equal(updated.body.title, 'Acheter du pain'); // champs non envoyes conserves

    await agent.delete(`/api/tasks/${created.body._id}`).expect(200);
    const after = await agent.get('/api/tasks');
    assert.equal(after.body.length, 0);
  });

  test('titre vide refuse', async () => {
    const agent = await signup('carol');
    const res = await agent.post('/api/tasks').send({ title: '   ' });
    assert.equal(res.status, 400);
  });

  test('HTML / script refuse (XSS)', async () => {
    const agent = await signup('dave');
    const res = await agent.post('/api/tasks').send({ title: "<script>alert('test')</script>" });
    assert.equal(res.status, 400);
  });

  test('champ inconnu refuse (pas de modification du proprietaire)', async () => {
    const agent = await signup('erin');
    const res = await agent.post('/api/tasks').send({ title: 'ok', user: '000000000000000000000000' });
    assert.equal(res.status, 400);
  });

  test('IDOR : un autre utilisateur ne peut ni modifier ni supprimer', async () => {
    const owner = await signup('owner');
    const intruder = await signup('intruder');
    const task = (await owner.post('/api/tasks').send({ title: 'Privee' })).body;

    await intruder.put(`/api/tasks/${task._id}`).send({ title: 'Pirate' }).expect(404);
    await intruder.delete(`/api/tasks/${task._id}`).expect(404);

    const still = await owner.get('/api/tasks');
    assert.equal(still.body[0].title, 'Privee');
  });

  test('identifiant mal forme : 404 et non 500', async () => {
    const agent = await signup('frank');
    await agent.delete('/api/tasks/pas-un-id').expect(404);
  });

  test('mise a jour vide refusee', async () => {
    const agent = await signup('gina');
    const task = (await agent.post('/api/tasks').send({ title: 'x' })).body;
    await agent.put(`/api/tasks/${task._id}`).send({}).expect(400);
  });
});
