'use strict';

const fs = require('fs');
const path = require('path');

const mainJs = path.join(__dirname, 'dist', 'apps', 'api', 'main.js');

if (!fs.existsSync(mainJs)) {
  console.error(
    'Compiled API not found at dist/apps/api/main.js.\n' +
      'From the backend-saas folder run:\n' +
      '  npm install\n' +
      '  npm run build\n' +
      'Then run this file again, or use: npm run start:prod\n',
  );
  process.exit(1);
}

require(mainJs);
