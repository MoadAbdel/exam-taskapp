/** Tests RGPD : export, effacement, minimisation des donnees. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { maskIp, maskName } = require('../config/privacy');

let mongod;
let app;
let request;
before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = mongod.getUri('rgpd_test');
  process.env.JWT_SECRET = 'test-secret-de-plus-de-trente-deux-caracteres';
  app = require('../app');
  request = require('supertest');
});
after(async () => {
  await require('../config/db').disconnectDB();
  await mongod.stop();
});

test('masquage des IP et des noms', () => {
  assert.equal(maskIp('203.0.113.45'), '203.0.113.0');
  assert.equal(maskIp('::ffff:203.0.113.45'), '203.0.113.0');
  assert.equal(maskIp('2001:db8:1:2::9'), '2001:db8:1::');
  assert.equal(maskName('alice'), 'al***');
});

test('export puis suppression du compte', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ username: 'rgpd', password: 'motdepasse1' }).expect(201);
  await agent.post('/api/tasks').send({ title: 'secrete' }).expect(201);

  const exp = await agent.get('/api/account/export').expect(200);
  assert.match(exp.headers['content-disposition'], /attachment/);
  assert.equal(exp.body.account.username, 'rgpd');
  assert.equal(exp.body.tasks[0].title, 'secrete');
  assert.equal(JSON.stringify(exp.body).includes('$2'), false); // jamais le hash

  await agent.delete('/api/account').send({ password: 'faux12345' }).expect(403);
  await agent.delete('/api/account').send({ password: 'motdepasse1' }).expect(204);

  const User = require('../models/User');
  const Task = require('../models/Task');
  const AuditLog = require('../models/AuditLog');
  assert.equal(await User.countDocuments(), 0);
  assert.equal(await Task.countDocuments(), 0);
  const events = await AuditLog.find().lean();
  assert.ok(events.length);
  assert.equal(
    events.some((e) => e.username === 'rgpd' || e.userId),
    false,
  );
});

test('droits reserves a la personne connectee', async () => {
  await request(app).get('/api/account/export').expect(401);
  await request(app).delete('/api/account').send({ password: 'x' }).expect(401);
});
