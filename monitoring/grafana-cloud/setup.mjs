// Cree dans Grafana Cloud : un tableau de bord par environnement et les alertes.
// Sources : sondes Synthetic Monitoring (Paris, Francfort) et logs de l'API dans Loki.
// Usage : GRAFANA_URL=https://xxx.grafana.net GRAFANA_SA_TOKEN=glsa_... [ALERT_EMAIL=...] node setup.mjs
// Relancable sans doublon (memes identifiants).
const GRAFANA = process.env.GRAFANA_URL;
const TOKEN = process.env.GRAFANA_SA_TOKEN;
if (!GRAFANA || !TOKEN) throw new Error('GRAFANA_URL et GRAFANA_SA_TOKEN requis');

const PROM = { type: 'prometheus', uid: 'grafanacloud-prom' };
const LOKI = { type: 'loki', uid: 'grafanacloud-logs' };
const FOLDER = 'taskapp';
const ENVS = ['production', 'preprod'];

async function api(method, path, body) {
  const res = await fetch(`${GRAFANA}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'X-Disable-Provenance': 'true' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, json: text ? JSON.parse(text) : null, text };
}

const logs = (env) => `{service="taskapp-api",env="${env}"}`;
const requests = (env) => `${logs(env)} |= "\\"message\\":\\"requete\\"" | json`;

function dashboard(env) {
  let id = 0;
  const panel = (type, title, pos, ds, targets, defaults = {}, options = {}) => ({
    id: ++id,
    type,
    title,
    gridPos: pos,
    datasource: ds,
    targets: targets.map(([expr, legend], i) => ({
      refId: String.fromCharCode(65 + i),
      datasource: ds,
      expr,
      legendFormat: legend,
    })),
    fieldConfig: { defaults, overrides: [] },
    options,
  });
  const stat = { reduceOptions: { calcs: ['lastNotNull'] }, colorMode: 'background' };
  const steps = (list) => ({ thresholds: { mode: 'absolute', steps: list.map(([color, value]) => ({ color, value })) } });
  const upDown = (job) =>
    panel(
      'stat',
      job.startsWith('api') ? 'API et base (sondes)' : 'Site web (sondes)',
      { x: job.startsWith('api') ? 0 : 6, y: 0, w: 6, h: 5 },
      PROM,
      [[`min(last_over_time(probe_success{job="${job}"}[15m]))`, 'etat']],
      {
        ...steps([['red', null], ['green', 1]]),
        mappings: [{ type: 'value', options: { 0: { text: 'HORS LIGNE' }, 1: { text: 'EN LIGNE' } } }],
      },
      stat,
    );
  return {
    uid: `taskapp-${env}`,
    title: `Mes Taches - ${env}`,
    tags: ['taskapp', env],
    refresh: '1m',
    time: { from: 'now-6h', to: 'now' },
    schemaVersion: 39,
    panels: [
      upDown(`api-${env}`),
      upDown(`web-${env}`),
      panel(
        'stat',
        'Disponibilite API (periode affichee)',
        { x: 12, y: 0, w: 6, h: 5 },
        PROM,
        [[`avg(avg_over_time(probe_success{job="api-${env}"}[$__range]))`, 'disponibilite']],
        { unit: 'percentunit', decimals: 2, ...steps([['red', null], ['orange', 0.99], ['green', 0.999]]) },
        stat,
      ),
      panel(
        'stat',
        'Certificat HTTPS : jours restants',
        { x: 18, y: 0, w: 6, h: 5 },
        PROM,
        [[`(min(last_over_time(probe_ssl_earliest_cert_expiry{job="api-${env}"}[15m])) - time()) / 86400`, 'jours']],
        { decimals: 0, ...steps([['red', null], ['orange', 14], ['green', 30]]) },
        stat,
      ),
      panel(
        'timeseries',
        'Temps de reponse vu par les sondes',
        { x: 0, y: 5, w: 12, h: 8 },
        PROM,
        [[`probe_duration_seconds{job=~"(api|web)-${env}"}`, '{{job}} {{probe}}']],
        { unit: 's' },
      ),
      panel(
        'timeseries',
        'Requetes par code HTTP',
        { x: 12, y: 5, w: 12, h: 8 },
        LOKI,
        [[`sum by (status) (count_over_time(${requests(env)} [$__auto]))`, '{{status}}']],
        { custom: { drawStyle: 'bars', fillOpacity: 60, stacking: { mode: 'normal' } } },
      ),
      panel(
        'timeseries',
        'Latence de l API (p50, p95), hors connexion et inscription',
        { x: 0, y: 13, w: 12, h: 8 },
        LOKI,
        [0.5, 0.95].map((q) => [
          `quantile_over_time(${q}, ${requests(env)} | route!~"/api/auth/(login|register)" | unwrap durationMs [5m]) by (env)`,
          `p${q * 100}`,
        ]),
        { unit: 'ms' },
      ),
      panel(
        'timeseries',
        'Evenements de securite',
        { x: 12, y: 13, w: 12, h: 8 },
        LOKI,
        [[`sum by (message) (count_over_time(${logs(env)} |= "audit:" | json | message=~"audit:.*" [$__auto]))`, '{{message}}']],
        { custom: { drawStyle: 'bars', fillOpacity: 60 } },
      ),
      panel('logs', 'Erreurs et alertes de securite (logs)', { x: 0, y: 21, w: 24, h: 9 }, LOKI, [
        [`{service="taskapp-api",env="${env}",level=~"warn|error"}`, ''],
      ], {}, { showTime: true, wrapLogMessage: true, sortOrder: 'Descending', enableLogDetails: true }),
    ],
  };
}

function rule({ uid, title, ds, expr, op = 'gt', threshold, forDuration, severity, summary, noData = 'OK' }) {
  return {
    uid,
    title,
    orgID: 1,
    folderUID: FOLDER,
    ruleGroup: 'taskapp',
    condition: 'C',
    for: forDuration,
    noDataState: noData,
    execErrState: 'Error',
    labels: { app: 'taskapp', severity },
    annotations: { summary },
    data: [
      {
        refId: 'A',
        relativeTimeRange: { from: 600, to: 0 },
        datasourceUid: ds.uid,
        model: { refId: 'A', expr, instant: true, range: false, queryType: 'instant' },
      },
      {
        refId: 'C',
        relativeTimeRange: { from: 600, to: 0 },
        datasourceUid: '__expr__',
        model: { refId: 'C', type: 'threshold', expression: 'A', conditions: [{ evaluator: { type: op, params: [threshold] } }] },
      },
    ],
  };
}

const all = '{service="taskapp-api",env=~"production|preprod"}';
const allRequests = `${all} |= "\\"message\\":\\"requete\\"" | json`;
const RULES = [
  rule({
    uid: 'taskapp-indispo', title: 'Service indisponible (sondes)', ds: PROM,
    expr: 'avg by (job) (avg_over_time(probe_success{job=~"(api|web)-(production|preprod)"}[10m]))',
    op: 'lt', threshold: 0.5, forDuration: '2m', severity: 'critique', noData: 'Alerting',
    summary: '{{ $labels.job }} ne repond plus (ou base injoignable)',
  }),
  rule({
    uid: 'taskapp-5xx', title: "Taux d'erreurs 5xx superieur a 5 %", ds: LOKI,
    expr: `sum by (env) (count_over_time(${allRequests} | status >= 500 [10m])) / sum by (env) (count_over_time(${allRequests} [10m]))`,
    threshold: 0.05, forDuration: '5m', severity: 'haute', summary: '{{ $labels.env }} : trop d erreurs serveur',
  }),
  rule({
    uid: 'taskapp-latence', title: 'Latence p95 superieure a 500 ms', ds: LOKI,
    expr: `quantile_over_time(0.95, ${allRequests} | route!~"/api/auth/(login|register)" | unwrap durationMs [10m]) by (env)`,
    threshold: 500, forDuration: '10m', severity: 'moyenne', summary: '{{ $labels.env }} : API lente',
  }),
  rule({
    uid: 'taskapp-bruteforce', title: 'Force brute : IP bloquee', ds: LOKI,
    expr: `sum by (env) (count_over_time(${all} |= "audit:limite_atteinte" [10m]))`,
    threshold: 0, forDuration: '0s', severity: 'haute',
    summary: '{{ $labels.env }} : le limiteur de connexion a bloque une IP',
  }),
  rule({
    uid: 'taskapp-jetons', title: 'Jetons falsifies', ds: LOKI,
    expr: `sum by (env) (count_over_time(${all} |= "audit:jeton_invalide" [10m]))`,
    threshold: 5, forDuration: '0s', severity: 'haute', summary: '{{ $labels.env }} : plus de 5 jetons falsifies en 10 min',
  }),
  rule({
    uid: 'taskapp-certificat', title: 'Certificat HTTPS expire dans moins de 14 jours', ds: PROM,
    expr: '(min by (job) (last_over_time(probe_ssl_earliest_cert_expiry{job=~"(api|web)-(production|preprod)"}[15m])) - time()) / 86400',
    op: 'lt', threshold: 14, forDuration: '1h', severity: 'moyenne', summary: '{{ $labels.job }} : certificat bientot expire',
  }),
];

const folder = await api('POST', '/api/folders', { uid: FOLDER, title: 'Mes Taches' });
console.log('dossier', folder.ok ? 'cree' : folder.status);

for (const env of ENVS) {
  const r = await api('POST', '/api/dashboards/db', { dashboard: dashboard(env), folderUid: FOLDER, overwrite: true });
  console.log('tableau de bord', env, r.ok ? `${GRAFANA}${r.json.url}` : `${r.status} ${r.text.slice(0, 200)}`);
}

for (const r of RULES) {
  let res = await api('POST', '/api/v1/provisioning/alert-rules', r);
  if (!res.ok) res = await api('PUT', `/api/v1/provisioning/alert-rules/${r.uid}`, r);
  console.log('alerte', r.title, res.ok ? 'OK' : `${res.status} ${res.text.slice(0, 200)}`);
}

if (process.env.ALERT_EMAIL) {
  const contact = {
    uid: 'taskapp-email', name: 'taskapp-email', type: 'email',
    settings: { addresses: process.env.ALERT_EMAIL }, disableResolveMessage: false,
  };
  let res = await api('POST', '/api/v1/provisioning/contact-points', contact);
  if (!res.ok) res = await api('PUT', `/api/v1/provisioning/contact-points/${contact.uid}`, contact);
  const policy = await api('PUT', '/api/v1/provisioning/policies', { receiver: contact.name, group_by: ['alertname'] });
  console.log('e-mail', res.ok && policy.ok ? 'configure' : `${res.status}/${policy.status}`);
} else {
  console.log('e-mail : ALERT_EMAIL absent, point de contact non configure');
}
