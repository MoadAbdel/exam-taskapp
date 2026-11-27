/**
 * @module config/privacy
 * @description Minimisation des donnees personnelles (RGPD, article 5) avant qu'elles ne sortent de la base.
 */

/**
 * Tronque une adresse IP : IPv4 sans le dernier octet, IPv6 reduite a ses 3 premiers groupes.
 * @param {string} [ip]
 * @returns {string|undefined}
 */
function maskIp(ip) {
  if (!ip) return ip;
  const v4 = ip.match(/^(?:::ffff:)?(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) return `${v4[1]}.0`;
  return ip.includes(':') ? `${ip.split(':').slice(0, 3).join(':')}::` : 'masquee';
}

/**
 * Masque un nom d'utilisateur (2 premiers caracteres conserves).
 * @param {string} [name]
 * @returns {string|undefined}
 */
function maskName(name) {
  return name ? `${name.slice(0, 2)}***` : name;
}

module.exports = { maskIp, maskName };
