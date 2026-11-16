/* Filet de sécurité : si le build n'a pas été lancé par la plateforme
   (commande de build vide, déploiement manuel…), on construit le front
   au démarrage plutôt que de servir un site vide. */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const indexHtml = path.join(root, 'dist', 'index.html');

if (fs.existsSync(indexHtml)) {
  process.exit(0);
}

console.log('[start] dist/ absent — construction du front…');
try {
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  console.log('[start] front construit.');
} catch (error) {
  console.error('[start] build impossible :', error.message);
  process.exit(0); // on laisse le serveur démarrer pour ne pas masquer l'erreur
}
