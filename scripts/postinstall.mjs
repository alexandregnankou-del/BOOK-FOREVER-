/* Prépare les dossiers d'exécution après installation des dépendances.
   Ne bloque jamais un déploiement : toute erreur est signalée, pas fatale. */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

for (const dir of ['data', 'public/media/covers']) {
  try {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  } catch (error) {
    console.warn(`[postinstall] ${dir}: ${error.message}`);
  }
}

const envExample = path.join(root, '.env.example');
if (!fs.existsSync(envExample)) {
  console.log('[postinstall] .env.example absent — ignoré.');
}
