/**
 * @module config/lokiTransport
 * @description Transport Winston vers Grafana Loki (Grafana Cloud).
 * Les logs sont mis en file puis envoyes par lots a l'API `POST /loki/api/v1/push`.
 * - Sur Vercel : envoi apres chaque reponse via `waitUntil` (aucune attente pour l'utilisateur).
 * - Ailleurs (Docker, local) : envoi toutes les 5 secondes.
 * Etiquettes Loki volontairement peu nombreuses (service, env, level) ; le detail reste dans la ligne JSON.
 * Une panne de Loki ne bloque jamais l'application : le lot est abandonne et l'erreur affichee sur stderr.
 */
const Transport = require('winston-transport');

class LokiTransport extends Transport {
  /**
   * @param {object} opts
   * @param {string} opts.url URL de base Loki (ex. https://logs-prod-xxx.grafana.net).
   * @param {string} opts.user Identifiant de l'instance Loki.
   * @param {string} opts.token Jeton Grafana Cloud (droit logs:write).
   * @param {object} opts.labels Etiquettes fixes (service, env).
   * @param {number} [opts.maxBatch=200] Taille maximale d'un lot.
   * @param {Function} [opts.fetchImpl=fetch] Implementation de fetch (remplacable en test).
   */
  constructor(opts) {
    super(opts);
    this.endpoint = `${opts.url.replace(/\/$/, '')}/loki/api/v1/push`;
    this.auth = `Basic ${Buffer.from(`${opts.user}:${opts.token}`).toString('base64')}`;
    this.labels = opts.labels;
    this.maxBatch = opts.maxBatch || 200;
    this.fetchImpl = opts.fetchImpl || fetch;
    this.queue = [];
  }

  /** Met une entree en file (appele par Winston). */
  log(info, callback) {
    const { level, message, timestamp, ...rest } = info;
    const ts = BigInt(Date.parse(timestamp || new Date().toISOString())) * 1000000n;
    const line = JSON.stringify({ level, message, ...rest });
    this.queue.push({ level, ts: (ts + BigInt(this.queue.length)).toString(), line });
    if (this.queue.length >= this.maxBatch) this.flush();
    callback();
  }

  /**
   * Envoie les entrees en file a Loki, groupees par niveau.
   * @returns {Promise<void>}
   */
  async flush() {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    const byLevel = new Map();
    for (const e of batch) {
      if (!byLevel.has(e.level)) byLevel.set(e.level, []);
      byLevel.get(e.level).push([e.ts, e.line]);
    }
    const streams = [...byLevel].map(([level, values]) => ({ stream: { ...this.labels, level }, values }));
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ streams }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) process.stderr.write(`Loki : envoi refuse (HTTP ${res.status})\n`);
    } catch (err) {
      process.stderr.write(`Loki : envoi impossible (${err.message})\n`);
    }
  }
}

module.exports = LokiTransport;
