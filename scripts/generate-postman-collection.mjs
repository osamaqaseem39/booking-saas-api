import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uuid = () => crypto.randomUUID();

const authHeaders = (tenant = true) => {
  const h = [{ key: 'Authorization', value: 'Bearer {{token}}' }];
  if (tenant) h.push({ key: 'X-Tenant-Id', value: '{{tenant_id}}' });
  return h;
};

const jsonHeader = { key: 'Content-Type', value: 'application/json' };

function req(name, method, pathStr, opts = {}) {
  const segments = pathStr.split('/').filter(Boolean);
  const baseHeaders = opts.headers ?? authHeaders(opts.tenant !== false);
  const headers = opts.body
    ? baseHeaders.some((h) => h.key === 'Content-Type')
      ? baseHeaders
      : [...baseHeaders, jsonHeader]
    : baseHeaders;
  const item = {
    name,
    request: {
      method,
      header: headers,
      url: {
        raw: '{{base_url}}' + pathStr + (opts.query ? '?' + opts.query : ''),
        host: ['{{base_url}}'],
        path: segments,
      },
      description: opts.description || '',
    },
    response: [],
  };
  if (opts.query) {
    item.request.url.query = opts.query.split('&').map((p) => {
      const [key, value = ''] = p.split('=');
      return { key, value };
    });
  }
  if (opts.body) {
    item.request.body = {
      mode: 'raw',
      raw: opts.body,
      options: { raw: { language: 'json' } },
    };
  }
  if (opts.noauth) item.request.auth = { type: 'noauth' };
  if (opts.events) item.event = opts.events;
  return item;
}

const tokenScript = {
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [
      'if (pm.response.code === 200 || pm.response.code === 201) {',
      '    var jsonData = pm.response.json();',
      '    if (jsonData.token) pm.collectionVariables.set("token", jsonData.token);',
      '    if (jsonData.refreshToken) pm.collectionVariables.set("refresh_token", jsonData.refreshToken);',
      '    if (jsonData.user && jsonData.user.id) pm.collectionVariables.set("user_id", jsonData.user.id);',
      '    if (jsonData.userId) pm.collectionVariables.set("user_id", jsonData.userId);',
      '}',
    ],
  },
};

const collection = {
  info: {
    _postman_id: uuid(),
    name: 'Velay API',
    description:
      'Velay API (velay-api) — dashboard and admin endpoints. Set collection variables in a private Postman environment (do not commit secrets). Default base: http://localhost:3000',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: '1. Health',
      item: [req('Health check', 'GET', '/health', { tenant: false, headers: [] })],
    },
    {
      name: '2. Auth',
      item: [
        req('Login', 'POST', '/auth/login', {
          noauth: true,
          tenant: false,
          headers: [],
          body: '{\n  "email": "{{login_email}}",\n  "password": "{{login_password}}"\n}',
          events: [tokenScript],
        }),
        req('Refresh token', 'POST', '/auth/refresh', {
          noauth: true,
          tenant: false,
          headers: [],
          body: '{\n  "refreshToken": "{{refresh_token}}"\n}',
          events: [tokenScript],
        }),
        req('Bootstrap first owner', 'POST', '/auth/bootstrap-first-owner', {
          noauth: true,
          tenant: false,
          headers: [],
          body: '{\n  "fullName": "Owner Name",\n  "email": "owner@example.com",\n  "password": "your-password",\n  "bootstrapSecret": "your-bootstrap-secret"\n}',
          events: [tokenScript],
        }),
        req('Change password', 'POST', '/auth/change-password', {
          tenant: false,
          body: '{\n  "currentPassword": "OldPassword@123",\n  "newPassword": "NewPassword@123"\n}',
        }),
        req('Forgot password', 'POST', '/auth/forgot-password', {
          noauth: true,
          tenant: false,
          headers: [],
          body: '{\n  "email": "{{login_email}}"\n}',
        }),
        req('Reset password', 'POST', '/auth/reset-password', {
          noauth: true,
          tenant: false,
          headers: [],
          body: '{\n  "token": "reset-token",\n  "newPassword": "NewPassword@123"\n}',
        }),
      ],
    },
    {
      name: '3. IAM',
      item: [
        req('Get current user (me)', 'GET', '/iam/me', { tenant: false }),
        req('List users', 'GET', '/iam/users', { tenant: false }),
        req('List end users', 'GET', '/iam/end-users', { tenant: false }),
        req('Create user', 'POST', '/iam/users', {
          tenant: false,
          body: '{\n  "fullName": "Staff Member",\n  "email": "staff@example.com",\n  "password": "your-password",\n  "phone": "+923001234567"\n}',
        }),
        req('Update user', 'PATCH', '/iam/users/{{user_id}}', {
          tenant: false,
          body: '{\n  "fullName": "Updated Name",\n  "phone": "+923007654321"\n}',
        }),
        req('Deactivate user', 'DELETE', '/iam/users/{{user_id}}', { tenant: false }),
        req('Activate user', 'POST', '/iam/users/{{user_id}}/activate', { tenant: false }),
        req('Assign role', 'POST', '/iam/roles/assign', {
          tenant: false,
          body: '{\n  "userId": "{{user_id}}",\n  "role": "location-admin",\n  "businessId": "{{business_id}}",\n  "locationId": "{{location_id}}"\n}',
        }),
        req('Unassign role', 'POST', '/iam/roles/unassign', {
          tenant: false,
          body: '{\n  "userId": "{{user_id}}",\n  "role": "location-admin",\n  "businessId": "{{business_id}}",\n  "locationId": "{{location_id}}"\n}',
        }),
      ],
    },
    {
      name: '4. Businesses & Locations',
      item: [
        req('List businesses', 'GET', '/businesses', { tenant: false }),
        req('Business dashboard', 'GET', '/businesses/dashboard', {
          tenant: false,
          query: 'period=today',
        }),
        req('Location dashboard', 'GET', '/businesses/locations/{{location_id}}/dashboard', {
          tenant: false,
          query: 'period=today',
        }),
        req('List locations', 'GET', '/businesses/locations', { tenant: false }),
        req('List location name-ids', 'GET', '/businesses/locations/name-ids', { tenant: false }),
        req('Search locations', 'GET', '/businesses/locations/search', {
          tenant: false,
          query: 'q=arena',
        }),
        req('List cities', 'GET', '/businesses/locations/cities', { tenant: false }),
        req('List location types', 'GET', '/businesses/locations/location-types', { tenant: false }),
        req('Facility counts', 'GET', '/businesses/locations/facility-counts', { tenant: false }),
        req('Onboard business', 'POST', '/businesses/onboard', {
          tenant: false,
          body: '{\n  "businessName": "My Arena",\n  "ownerEmail": "owner@example.com"\n}',
        }),
        req('Create location', 'POST', '/businesses/locations', {
          tenant: false,
          body: '{\n  "businessId": "{{business_id}}",\n  "name": "Main Branch",\n  "locationType": "arena",\n  "city": "Lahore"\n}',
        }),
        req('Update location', 'PATCH', '/businesses/locations/{{location_id}}', {
          tenant: false,
          body: '{\n  "name": "Updated Branch Name"\n}',
        }),
        req('Delete location', 'DELETE', '/businesses/locations/{{location_id}}', { tenant: false }),
        req('Update business', 'PATCH', '/businesses/{{business_id}}', {
          tenant: false,
          body: '{\n  "name": "Updated Business Name"\n}',
        }),
        req('Delete business', 'DELETE', '/businesses/{{business_id}}', { tenant: false }),
      ],
    },
    {
      name: '5. Bookings',
      item: [
        req('List bookings', 'GET', '/bookings', { query: 'locationId={{location_id}}' }),
        req('Get booking', 'GET', '/bookings/{{booking_id}}'),
        req('Create booking', 'POST', '/bookings', {
          body: '{\n  "userId": "{{user_id}}",\n  "sportType": "futsal",\n  "bookingDate": "2026-06-05",\n  "items": [{\n    "courtKind": "turf_court",\n    "courtId": "{{court_id}}",\n    "startTime": "18:00",\n    "endTime": "19:00",\n    "price": 5000,\n    "currency": "PKR"\n  }],\n  "pricing": { "subTotal": 5000, "totalAmount": 5000 },\n  "payment": { "paymentStatus": "paid", "paymentMethod": "cash", "paidAmount": 5000 }\n}',
        }),
        req('Update booking', 'PATCH', '/bookings/{{booking_id}}', {
          body: '{\n  "bookingStatus": "confirmed",\n  "notes": "Updated via API"\n}',
        }),
        req('Delete booking', 'DELETE', '/bookings/{{booking_id}}'),
        req('Parse free text', 'POST', '/bookings/parse-free-text', {
          body: '{\n  "text": "futsal tomorrow 6pm bilal 03001234567"\n}',
        }),
        req('Availability by time', 'GET', '/bookings/availability', {
          query:
            'date=2026-06-05&startTime=18:00&endTime=19:00&sportType=futsal&locationId={{location_id}}',
        }),
        req('Live facilities', 'GET', '/bookings/locations/{{location_id}}/facilities/live', {
          query: 'date=2026-06-05&courtType=futsal',
        }),
        req('Court slots', 'GET', '/bookings/courts/{{court_kind}}/{{court_id}}/slots', {
          query: 'date=2026-06-05',
        }),
        req('Court slot grid', 'GET', '/bookings/courts/{{court_kind}}/{{court_id}}/slot-grid', {
          query: 'date=2026-06-05',
        }),
        req('Update slot blocks', 'PUT', '/bookings/courts/{{court_kind}}/{{court_id}}/slot-blocks', {
          body: '{\n  "date": "2026-06-05",\n  "blocks": []\n}',
        }),
        req(
          'Generate facility slots',
          'POST',
          '/bookings/courts/{{court_kind}}/{{court_id}}/facility-slots/generate',
          { body: '{\n  "date": "2026-06-05"\n}' },
        ),
        req('Patch facility slots', 'PATCH', '/bookings/courts/{{court_kind}}/{{court_id}}/facility-slots', {
          body: '{\n  "date": "2026-06-05",\n  "slots": []\n}',
        }),
        req('Add payment transaction', 'POST', '/bookings/{{booking_id}}/payment-transactions', {
          body: '{\n  "amount": 2000,\n  "method": "cash"\n}',
        }),
        req('Delete payment transaction', 'DELETE', '/bookings/{{booking_id}}/payment-transactions/{{txn_id}}'),
        req('Patch booking facility slots', 'PATCH', '/bookings/{{booking_id}}/facility-slots', {
          body: '{\n  "items": []\n}',
        }),
        req('List time slot templates', 'GET', '/bookings/time-slot-templates'),
        req('Create time slot template', 'POST', '/bookings/time-slot-templates', {
          body: '{\n  "name": "Weekday evening",\n  "sportType": "futsal",\n  "slots": [{ "startTime": "18:00", "endTime": "19:00", "price": 5000 }]\n}',
        }),
        req('Update time slot template', 'PATCH', '/bookings/time-slot-templates/{{template_id}}', {
          body: '{\n  "name": "Updated template"\n}',
        }),
        req('Delete time slot template', 'DELETE', '/bookings/time-slot-templates/{{template_id}}'),
      ],
    },
    {
      name: '6. Arena & Facilities',
      item: [
        req('Arena meta', 'GET', '/arena', { tenant: false }),
        req('List padel courts', 'GET', '/arena/padel-court', {
          query: 'businessLocationId={{location_id}}',
        }),
        req('Get padel court', 'GET', '/arena/padel-court/{{court_id}}'),
        req('Create padel court', 'POST', '/arena/padel-court', {
          body: '{\n  "businessLocationId": "{{location_id}}",\n  "name": "Court 1"\n}',
        }),
        req('Update padel court', 'PATCH', '/arena/padel-court/{{court_id}}', {
          body: '{\n  "name": "Court 1 revised"\n}',
        }),
        req('Delete padel court', 'DELETE', '/arena/padel-court/{{court_id}}'),
        req('List table tennis courts', 'GET', '/arena/table-tennis-court', {
          query: 'businessLocationId={{location_id}}',
        }),
        req('Get table tennis court', 'GET', '/arena/table-tennis-court/{{court_id}}'),
        req('Create table tennis court', 'POST', '/arena/table-tennis-court', {
          body: '{\n  "businessLocationId": "{{location_id}}",\n  "name": "Table 1"\n}',
        }),
        req('Update table tennis court', 'PATCH', '/arena/table-tennis-court/{{court_id}}', {
          body: '{\n  "name": "Table 1 revised"\n}',
        }),
        req('Delete table tennis court', 'DELETE', '/arena/table-tennis-court/{{court_id}}'),
        req('List turf courts', 'GET', '/arena/turf-courts', {
          query: 'businessLocationId={{location_id}}',
        }),
        req('List futsal turfs', 'GET', '/arena/turf-courts/futsal', {
          query: 'businessLocationId={{location_id}}',
        }),
        req('List cricket turfs', 'GET', '/arena/turf-courts/cricket', {
          query: 'businessLocationId={{location_id}}',
        }),
        req('Get turf court', 'GET', '/arena/turf-courts/{{court_id}}'),
        req('Create turf court', 'POST', '/arena/turf-courts', {
          body: '{\n  "businessLocationId": "{{location_id}}",\n  "name": "Futsal A",\n  "sportType": "futsal"\n}',
        }),
        req('Update turf court', 'PATCH', '/arena/turf-courts/{{court_id}}', {
          body: '{\n  "name": "Futsal A revised"\n}',
        }),
        req('Delete turf court', 'DELETE', '/arena/turf-courts/{{court_id}}'),
        req('List gaming stations', 'GET', '/gaming/stations', {
          query: 'businessLocationId={{location_id}}',
        }),
        req('Get gaming station', 'GET', '/gaming/stations/{{court_id}}'),
        req('Create gaming station', 'POST', '/gaming/stations', {
          body: '{\n  "businessLocationId": "{{location_id}}",\n  "name": "Station 1"\n}',
        }),
        req('Update gaming station', 'PATCH', '/gaming/stations/{{court_id}}', {
          body: '{\n  "name": "Station 1 revised"\n}',
        }),
        req('Delete gaming station', 'DELETE', '/gaming/stations/{{court_id}}'),
      ],
    },
    {
      name: '7. Billing',
      item: [
        req('List invoices', 'GET', '/billing/invoices'),
        req('Create invoice', 'POST', '/billing/invoices', {
          body: '{\n  "locationId": "{{location_id}}",\n  "amount": 10000,\n  "description": "Monthly subscription"\n}',
        }),
      ],
    },
    {
      name: '8. Inventory',
      item: [
        req('List inventory', 'GET', '/inventory', { query: 'locationId={{location_id}}' }),
        req('Create inventory item', 'POST', '/inventory', {
          body: '{\n  "locationId": "{{location_id}}",\n  "name": "Futsal ball",\n  "type": "Equipment",\n  "totalQuantity": 20,\n  "availableQuantity": 18\n}',
        }),
        req('Update inventory item', 'PATCH', '/inventory/{{asset_id}}', {
          body: '{\n  "availableQuantity": 15\n}',
        }),
        req('Delete inventory item', 'DELETE', '/inventory/{{asset_id}}'),
      ],
    },
    {
      name: '9. Expenses',
      item: [
        req('List expenses', 'GET', '/expenses', { query: 'locationId={{location_id}}' }),
        req('Create expense', 'POST', '/expenses', {
          body: '{\n  "locationId": "{{location_id}}",\n  "title": "Electricity bill",\n  "amount": 12500,\n  "date": "2026-06-01",\n  "category": "Electricity"\n}',
        }),
        req('Update expense', 'PATCH', '/expenses/{{expense_id}}', {
          body: '{\n  "amount": 13000\n}',
        }),
        req('Delete expense', 'DELETE', '/expenses/{{expense_id}}'),
      ],
    },
    {
      name: '10. Canteen',
      item: [
        req('List canteen items', 'GET', '/canteen', { query: 'locationId={{location_id}}' }),
        req('Create canteen item', 'POST', '/canteen', {
          body: '{\n  "locationId": "{{location_id}}",\n  "name": "Mineral Water 500ml",\n  "category": "Beverages",\n  "stockQuantity": 48,\n  "sellingPrice": 80\n}',
        }),
        req('Update canteen item', 'PATCH', '/canteen/{{canteen_item_id}}', {
          body: '{\n  "stockQuantity": 40\n}',
        }),
        req('Delete canteen item', 'DELETE', '/canteen/{{canteen_item_id}}'),
      ],
    },
    {
      name: '11. Bank Accounts',
      item: [
        req('List bank accounts', 'GET', '/bank-accounts', { query: 'locationId={{location_id}}' }),
        req('Create bank account', 'POST', '/bank-accounts', {
          body: '{\n  "locationId": "{{location_id}}",\n  "bankName": "HBL",\n  "accountTitle": "Arena Account",\n  "accountNumber": "1234567890"\n}',
        }),
        req('Update bank account', 'PATCH', '/bank-accounts/{{bank_account_id}}', {
          body: '{\n  "accountTitle": "Updated Title"\n}',
        }),
        req('Delete bank account', 'DELETE', '/bank-accounts/{{bank_account_id}}'),
      ],
    },
    {
      name: '12. Tournaments',
      item: [
        req('List tournaments', 'GET', '/tournaments'),
        req('Get tournament', 'GET', '/tournaments/{{tournament_id}}'),
        req('Create tournament', 'POST', '/tournaments', {
          body: '{\n  "name": "Summer Cup",\n  "sport": "futsal",\n  "venueIds": ["{{location_id}}"],\n  "startsAt": "2026-07-01T10:00:00.000Z",\n  "maxTeams": 16,\n  "structureType": "knockout"\n}',
        }),
        req('Preview structure', 'POST', '/tournaments/preview-structure', {
          body: '{\n  "teamCount": 16,\n  "structureType": "knockout"\n}',
        }),
        req('List templates', 'GET', '/tournament-templates'),
        req('Update tournament', 'PATCH', '/tournaments/{{tournament_id}}', {
          body: '{\n  "name": "Summer Cup revised"\n}',
        }),
        req('Publish tournament', 'PATCH', '/tournaments/{{tournament_id}}/publish'),
        req('Open registration', 'PATCH', '/tournaments/{{tournament_id}}/open-registration'),
        req('Close registration', 'PATCH', '/tournaments/{{tournament_id}}/close-registration'),
        req('Start tournament', 'PATCH', '/tournaments/{{tournament_id}}/start'),
        req('Complete tournament', 'PATCH', '/tournaments/{{tournament_id}}/complete'),
        req('Reopen tournament', 'PATCH', '/tournaments/{{tournament_id}}/reopen'),
        req('Cancel tournament', 'PATCH', '/tournaments/{{tournament_id}}/cancel'),
        req('Generate stage', 'POST', '/tournaments/{{tournament_id}}/generate-stage/1'),
        req('Reset stage', 'POST', '/tournaments/{{tournament_id}}/reset-stage/1'),
        req('List stages', 'GET', '/tournaments/{{tournament_id}}/stages'),
        req('List fixtures', 'GET', '/tournaments/{{tournament_id}}/fixtures'),
        req('List matches', 'GET', '/tournaments/{{tournament_id}}/matches'),
        req('List standings', 'GET', '/tournaments/{{tournament_id}}/standings'),
        req('Get bracket', 'GET', '/tournaments/{{tournament_id}}/bracket'),
        req('Register team', 'POST', '/tournaments/{{tournament_id}}/register-team', {
          body: '{\n  "teamName": "Team Alpha",\n  "members": [{ "displayName": "Player 1", "role": "captain" }]\n}',
        }),
        req('List registrations', 'GET', '/tournaments/{{tournament_id}}/registrations'),
        req('Approve registration', 'PATCH', '/registrations/{{registration_id}}/approve'),
        req('Reject registration', 'PATCH', '/registrations/{{registration_id}}/reject', {
          body: '{\n  "reason": "Incomplete roster"\n}',
        }),
        req('Schedule match', 'PATCH', '/matches/{{match_id}}/schedule', {
          body: '{\n  "scheduledAt": "2026-07-02T14:00:00.000Z"\n}',
        }),
        req('Start match', 'PATCH', '/matches/{{match_id}}/start'),
        req('Submit score', 'PATCH', '/matches/{{match_id}}/submit-score', {
          body: '{\n  "homeScore": 2,\n  "awayScore": 1\n}',
        }),
        req('Approve result', 'PATCH', '/matches/{{match_id}}/approve-result'),
        req('Walkover', 'PATCH', '/matches/{{match_id}}/walkover', {
          body: '{\n  "winnerSide": "home"\n}',
        }),
      ],
    },
    {
      name: '13. Public',
      item: [
        req('List cities', 'GET', '/public/cities', { tenant: false, headers: [] }),
        req('List location types', 'GET', '/public/location-types', { tenant: false, headers: [] }),
        req('Venue markers (all)', 'GET', '/public/venues/markers', { tenant: false, headers: [] }),
        req('Venue markers (futsal)', 'GET', '/public/venues/markers/futsal', {
          tenant: false,
          headers: [],
        }),
        req('Venue markers (padel)', 'GET', '/public/venues/markers/padel', {
          tenant: false,
          headers: [],
        }),
        req('Venue markers (gaming)', 'GET', '/public/venues/markers/gaming', {
          tenant: false,
          headers: [],
        }),
        req('Search venues', 'GET', '/public/venues/search', {
          tenant: false,
          headers: [],
          query: 'q=arena',
        }),
        req('Venue details', 'GET', '/public/venues/{{location_id}}', { tenant: false, headers: [] }),
        req('Public booking (padel)', 'POST', '/public/bookings/padel', {
          tenant: false,
          headers: [],
          body: '{\n  "courtId": "{{court_id}}",\n  "date": "2026-06-05",\n  "startTime": "18:00",\n  "endTime": "19:00"\n}',
        }),
        req('Public booking (futsal)', 'POST', '/public/bookings/futsal', {
          tenant: false,
          headers: [],
          body: '{\n  "courtId": "{{court_id}}",\n  "date": "2026-06-05",\n  "startTime": "18:00",\n  "endTime": "19:00"\n}',
        }),
      ],
    },
  ],
  event: [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: tokenScript.script.exec,
      },
    },
  ],
  variable: [
    { key: 'base_url', value: 'http://localhost:3000', type: 'string' },
    { key: 'login_email', value: '', type: 'string' },
    { key: 'login_password', value: '', type: 'string' },
    { key: 'token', value: '', type: 'string' },
    { key: 'refresh_token', value: '', type: 'string' },
    { key: 'tenant_id', value: '', type: 'string' },
    { key: 'user_id', value: '', type: 'string' },
    { key: 'business_id', value: '', type: 'string' },
    { key: 'location_id', value: '', type: 'string' },
    { key: 'booking_id', value: '', type: 'string' },
    { key: 'court_id', value: '', type: 'string' },
    { key: 'court_kind', value: 'turf_court', type: 'string' },
    { key: 'template_id', value: '', type: 'string' },
    { key: 'txn_id', value: '', type: 'string' },
    { key: 'tournament_id', value: '', type: 'string' },
    { key: 'match_id', value: '', type: 'string' },
    { key: 'registration_id', value: '', type: 'string' },
    { key: 'expense_id', value: '', type: 'string' },
    { key: 'canteen_item_id', value: '', type: 'string' },
    { key: 'asset_id', value: '', type: 'string' },
    { key: 'bank_account_id', value: '', type: 'string' },
  ],
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatHeaders(headers) {
  if (!headers?.length) return '_None_';
  return headers.map((h) => `\`${h.key}\`: ${h.value}`).join('  \n');
}

function formatQuery(query) {
  if (!query?.length) return null;
  return query.map((q) => `\`${q.key}\` — ${q.value || '(empty)'}`).join('  \n');
}

function endpointToMarkdown(item) {
  const { request } = item;
  const pathStr = '/' + (request.url.path || []).join('/');
  const query = formatQuery(request.url.query);
  const lines = [
    `### ${item.name}`,
    '',
    `**${request.method}** \`${pathStr}\``,
    '',
  ];
  if (request.description) {
    lines.push(request.description, '');
  }
  const needsAuth = request.auth?.type !== 'noauth';
  lines.push('**Auth**', needsAuth ? 'Bearer token' : 'None', '');
  const tenantHeader = request.header?.find((h) => h.key === 'X-Tenant-Id');
  if (tenantHeader) {
    lines.push('**Tenant**', `\`X-Tenant-Id: ${tenantHeader.value}\``, '');
  }
  lines.push('**Headers**', formatHeaders(request.header), '');
  if (query) {
    lines.push('**Query**', query, '');
  }
  if (request.body?.raw) {
    lines.push('**Body**', '```json', request.body.raw, '```', '');
  }
  return lines.join('\n');
}

function collectionToMarkdown(col) {
  const count = col.item.reduce((n, f) => n + f.item.length, 0);
  const lines = [
    '# Velay API',
    '',
    col.info.description,
    '',
    `**${count} endpoints** — generated from \`velay-api/scripts/generate-postman-collection.mjs\`. Import the Postman collection: \`velay-api.postman_collection.json\`.`,
    '',
    '## Setup',
    '',
    '| Variable | Default | Description |',
    '| --- | --- | --- |',
    ...col.variable.map((v) => `| \`${v.key}\` | ${v.value ? `\`${v.value}\`` : '_(empty)_'} | |`),
    '',
    '**Auth flow:** `POST /auth/login` → use `token` as `Authorization: Bearer …`. Tenant-scoped routes also need `X-Tenant-Id`.',
    '',
    '## Table of contents',
    '',
    ...col.item.flatMap((folder) => [
      `- [${folder.name}](#${slugify(folder.name)})`,
      ...folder.item.map((ep) => `  - [${ep.name}](#${slugify(ep.name)})`),
    ]),
    '',
  ];
  for (const folder of col.item) {
    lines.push(`## ${folder.name}`, '');
    for (const ep of folder.item) {
      lines.push(endpointToMarkdown(ep));
    }
  }
  return lines.join('\n');
}

const root = path.resolve(__dirname, '../..');
const jsonOut = path.join(root, 'velay-api.postman_collection.json');
const mdOut = path.join(root, 'velay-api.md');

fs.writeFileSync(jsonOut, JSON.stringify(collection, null, '\t'));
fs.writeFileSync(mdOut, collectionToMarkdown(collection));

const count = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`Written ${jsonOut} (${count} requests)`);
console.log(`Written ${mdOut}`);
