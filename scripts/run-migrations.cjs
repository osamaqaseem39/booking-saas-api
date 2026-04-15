/**
 * Loads `.env` from repo root (if present) then runs TypeORM CLI migrations.
 * Resolves the compiled DataSource file from known Nest build output layouts.
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

const typeormCli = path.join(root, 'node_modules', 'typeorm', 'cli.js');
const dataSourceCandidates = [
  path.join(root, 'dist', 'apps', 'api', 'database', 'typeorm.config.js'),
  path.join(
    root,
    'dist',
    'apps',
    'api',
    'apps',
    'api',
    'src',
    'database',
    'typeorm.config.js',
  ),
];
const ds = dataSourceCandidates.find((p) => existsSync(p));

if (!ds) {
  console.error(
    `Unable to find compiled TypeORM DataSource. Checked:\n- ${dataSourceCandidates.join('\n- ')}`,
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [typeormCli, 'migration:run', '-d', ds],
  { stdio: 'inherit', cwd: root, env: process.env },
);

process.exit(result.status ?? 1);
