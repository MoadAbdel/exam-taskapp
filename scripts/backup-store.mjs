// Sauvegardes dans un stockage Vercel Blob PRIVE (Paris). Les archives sont deja chiffrees (gpg).
// Usage (variable BLOB_READ_WRITE_TOKEN requise, paquet @vercel/blob installe) :
//   node scripts/backup-store.mjs upload <fichier>   envoie, relit, compare l'empreinte, purge > 30 jours
//   node scripts/backup-store.mjs list               liste les sauvegardes
//   node scripts/backup-store.mjs download <fichier> recupere la plus recente
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { del, get, list, put } from '@vercel/blob';

const PREFIX = 'backups/';
const RETENTION_DAYS = 30;
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

async function all() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  return blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

async function read(pathname) {
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res?.stream) throw new Error(`Lecture impossible : ${pathname}`);
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

const [command, file] = process.argv.slice(2);

if (command === 'upload') {
  const data = await readFile(file);
  const pathname = `${PREFIX}taskapp_prod-${new Date().toISOString().replace(/[:.]/g, '-')}.archive.gz.gpg`;
  await put(pathname, data, { access: 'private', addRandomSuffix: false });
  if (sha(await read(pathname)) !== sha(data)) throw new Error('Empreinte differente apres envoi');
  console.log(`Envoyee et verifiee : ${pathname} (${data.length} octets)`);
  const limit = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;
  const old = (await all()).filter((b) => new Date(b.uploadedAt).getTime() < limit);
  if (old.length) await del(old.map((b) => b.url));
  console.log(`Purge : ${old.length} sauvegarde(s) de plus de ${RETENTION_DAYS} jours`);
} else if (command === 'list') {
  for (const b of await all()) console.log(new Date(b.uploadedAt).toISOString(), b.size, b.pathname);
} else if (command === 'download') {
  const [latest] = await all();
  if (!latest) throw new Error('Aucune sauvegarde');
  await writeFile(file, await read(latest.pathname));
  console.log(`Recuperee : ${latest.pathname} -> ${file}`);
} else {
  console.error('Commande : upload <fichier> | list | download <fichier>');
  process.exit(1);
}
