/**
 * Loads `.env` from repo root (if present) then runs TypeORM CLI migrations.
 * Uses the same DataSource as the API (`dist/apps/api/database/typeorm.config.js`).
 *
 * Spawns `node …/typeorm/cli.js` (not `npx` + shell) so `POSTGRES_*` from `.env`
 * reliably reaches the CLI on Windows.
 */
const path = require('path');
const { existsSync } = require('fs');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
if (existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const ds = path.join(root, 'dist', 'apps', 'api', 'database', 'typeorm.config.js');
const typeormCli = path.join(root, 'node_modules', 'typeorm', 'cli.js');

const result = spawnSync(
  process.execPath,
  [typeormCli, 'migration:run', '-d', ds],
  { stdio: 'inherit', cwd: root, env: process.env },
);

process.exit(result.status ?? 1);
