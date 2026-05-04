'use strict';
/**
 * Vercel (and similar hosts) expect a root-level Node entry file.
 * The Nest API is built via `npm run build` (output path may vary by Nest/OS).
 */
const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, 'dist', 'apps', 'api', 'main.js'),
  path.join(__dirname, 'dist', 'apps', 'api', 'apps', 'api', 'src', 'main.js'),
];

const entry = candidates.find((p) => fs.existsSync(p));

if (!entry) {
  throw new Error(
    `[boot] Compiled API entry not found. Tried:\n${candidates.join('\n')}`,
  );
}

require(entry);
