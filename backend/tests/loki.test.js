/** Tests du transport Winston vers Grafana Loki (fetch simule : aucun appel reseau). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const LokiTransport = require('../config/lokiTransport');

function makeTransport(fetchImpl) {
  return new LokiTransport({
    url: 'https://logs.example.net/',
    user: '123',
    token: 'secret',
    labels: { service: 'taskapp-api', env: 'test' },
    fetchImpl,
  });
}

const log = (t, info) => new Promise((resolve) => t.log(info, resolve));

test('envoie un lot groupe par niveau avec authentification et etiquettes', async () => {
  const calls = [];
  const t = makeTransport(async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 204 };
  });
  await log(t, { level: 'http', message: 'requete', status: 200, timestamp: '2026-11-27T10:00:00.000Z' });
  await log(t, { level: 'warn', message: 'audit:connexion_echec', ip: '1.2.3.4' });
  await log(t, { level: 'http', message: 'requete', status: 201 });
  await t.flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://logs.example.net/loki/api/v1/push');
  assert.equal(calls[0].opts.headers.Authorization, `Basic ${Buffer.from('123:secret').toString('base64')}`);
  const { streams } = JSON.parse(calls[0].opts.body);
  const http = streams.find((s) => s.stream.level === 'http');
  assert.deepEqual(http.stream, { service: 'taskapp-api', env: 'test', level: 'http' });
  assert.equal(http.values.length, 2);
  assert.equal(http.values[0][0], '1795773600000000000');
  assert.equal(JSON.parse(http.values[0][1]).status, 200);
  assert.equal(streams.find((s) => s.stream.level === 'warn').values.length, 1);
  assert.equal(t.queue.length, 0);
});

test('file vide : aucun appel', async () => {
  let called = false;
  const t = makeTransport(async () => {
    called = true;
    return { ok: true };
  });
  await t.flush();
  assert.equal(called, false);
});

test('panne de Loki : aucune exception, lot abandonne', async () => {
  const t = makeTransport(async () => {
    throw new Error('reseau coupe');
  });
  await log(t, { level: 'info', message: 'x' });
  await t.flush();
  assert.equal(t.queue.length, 0);
});

test('lot plein : envoi automatique', async () => {
  let calls = 0;
  const t = makeTransport(async () => {
    calls += 1;
    return { ok: true };
  });
  t.maxBatch = 3;
  for (let i = 0; i < 3; i++) await log(t, { level: 'info', message: `m${i}` });
  assert.equal(calls, 1);
});
