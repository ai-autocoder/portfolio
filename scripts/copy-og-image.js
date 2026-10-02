/**
 * Copy the shared social-preview image to a stable, unhashed path in dist/.
 *
 * og:image and twitter:image must be absolute URLs, and Parcel doesn't
 * bundle absolute URLs, so nothing else puts the file where they point:
 * https://francescoanzalone.dev/media/img/og-default.jpg
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src/media/img/og-default.jpg');
const target = join(root, 'dist/media/img/og-default.jpg');

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log('Copied og-default.jpg to dist/media/img/');
