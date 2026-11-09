import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticOut = join(root, '.vercel', 'output', 'static');
const publicOut = join(root, 'public');

if (!existsSync(staticOut)) {
	console.error(
		'[sync-publish-output] Missing .vercel/output/static — adapter-vercel did not emit Build Output API files.'
	);
	process.exit(1);
}

rmSync(publicOut, { recursive: true, force: true });
mkdirSync(publicOut, { recursive: true });
cpSync(staticOut, publicOut, { recursive: true });

// Marker so hosts that only stat the folder still see a completed static export.
writeFileSync(join(publicOut, '.publish-output'), 'ok\n');

console.log('[sync-publish-output] Synced .vercel/output/static → public/');
