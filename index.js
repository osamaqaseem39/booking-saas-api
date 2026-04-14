'use strict';
/**
 * Vercel (and similar hosts) expect a root-level Node entry file.
 * The Nest API is built to `dist/apps/api` via `npm run build`.
 */
require('./dist/apps/api/main.js');
