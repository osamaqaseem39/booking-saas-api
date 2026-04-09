/**
 * Generates API client collections from a single route table.
 * Run from repo root: `node backend-saas/scripts/generate-api-collections.mjs`
 * Or from backend-saas: `node scripts/generate-api-collections.mjs`
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, '..');
const repoRoot = join(backendRoot, '..');

const outPostman = join(repoRoot, 'booking-saas-all-endpoints.postman_collection.json');
const outInsomnia = join(backendRoot, 'api', 'booking-saas.insomnia.json');
const outHttp = join(backendRoot, 'http', 'booking-saas-api.http');

mkdirSync(dirname(outInsomnia), { recursive: true });
mkdirSync(dirname(outHttp), { recursive: true });

/** @typedef {'inherit' | 'none'} AuthMode */
/** @typedef {{ key: string, value?: string, description?: string }} Q */
/**
 * @typedef {object} RouteDef
 * @property {string} name
 * @property {string} method
 * @property {string[]} path
 * @property {AuthMode} [auth]
 * @property {Record<string, string>} [headers] extra headers (e.g. X-Tenant-Id)
 * @property {Q[]} [query]
 * @property {string} [body]
 */

/** @type {{ name: string, description?: string, routes: RouteDef[] }[]} */
const GROUPS = [
  {
    name: 'Health',
    routes: [{ name: 'GET /health', method: 'GET', path: ['health'], auth: 'none' }],
  },
  {
    name: 'Auth',
    routes: [
      {
        name: 'POST /auth/login',
        method: 'POST',
        path: ['auth', 'login'],
        auth: 'none',
        headers: { 'Content-Type': 'application/json' },
        body: '{\n  "email": "owner@example.com",\n  "password": "your-password"\n}',
      },
      {
        name: 'POST /auth/refresh',
        method: 'POST',
        path: ['auth', 'refresh'],
        auth: 'none',
        headers: { 'Content-Type': 'application/json' },
        body: '{\n  "refreshToken": "{{refreshToken}}"\n}',
      },
      {
        name: 'POST /auth/bootstrap-first-owner',
        method: 'POST',
        path: ['auth', 'bootstrap-first-owner'],
        auth: 'none',
        headers: { 'Content-Type': 'application/json' },
        body:
          '{\n  "fullName": "Platform Owner",\n  "email": "owner@example.com",\n  "password": "your-password",\n  "phone": "+923001234567"\n}',
      },
      {
        name: 'POST /auth/register-end-user',
        method: 'POST',
        path: ['auth', 'register-end-user'],
        auth: 'none',
        headers: { 'Content-Type': 'application/json' },
        body:
          '{\n  "fullName": "End User",\n  "email": "user@example.com",\n  "password": "your-password",\n  "phone": "+923001234567"\n}',
      },
    ],
  },
  {
    name: 'IAM',
    routes: [
      { name: 'GET /iam/me', method: 'GET', path: ['iam', 'me'] },
      {
        name: 'GET /iam/users',
        method: 'GET',
        path: ['iam', 'users'],
        query: [
          { key: 'search', value: '' },
          { key: 'sortBy', value: '' },
          { key: 'sortOrder', value: '' },
        ],
      },
      { name: 'GET /iam/end-users', method: 'GET', path: ['iam', 'end-users'] },
      {
        name: 'POST /iam/users',
        method: 'POST',
        path: ['iam', 'users'],
        headers: { 'Content-Type': 'application/json' },
        body:
          '{\n  "fullName": "New User",\n  "email": "new@example.com",\n  "password": "Password@123",\n  "phone": "+923001112233"\n}',
      },
      {
        name: 'PATCH /iam/users/:userId',
        method: 'PATCH',
        path: ['iam', 'users', '{{userId}}'],
        headers: { 'Content-Type': 'application/json' },
        body:
          '{\n  "fullName": "Updated Name",\n  "phone": "+923009998877",\n  "isActive": true\n}',
      },
      { name: 'DELETE /iam/users/:userId', method: 'DELETE', path: ['iam', 'users', '{{userId}}'] },
      {
        name: 'POST /iam/roles/assign',
        method: 'POST',
        path: ['iam', 'roles', 'assign'],
        headers: { 'Content-Type': 'application/json' },
        body: '{\n  "userId": "{{userId}}",\n  "role": "business-admin"\n}',
      },
    ],
  },
  {
    name: 'Businesses',
    routes: [
      { name: 'GET /businesses', method: 'GET', path: ['businesses'] },
      { name: 'GET /businesses/dashboard', method: 'GET', path: ['businesses', 'dashboard'] },
      {
        name: 'POST /businesses/onboard',
        method: 'POST',
        path: ['businesses', 'onboard'],
        headers: { 'Content-Type': 'application/json' },
        body:
          '{\n  "businessName": "Example Club",\n  "admin": {\n    "fullName": "Admin User",\n    "email": "admin@example.com",\n    "phone": "+923001010101",\n    "password": "Password@123"\n  }\n}',
      },
      { name: 'GET /businesses/locations', method: 'GET', path: ['businesses', 'locations'], auth: 'none' },
      {
        name: 'GET /businesses/locations/cities',
        method: 'GET',
        path: ['businesses', 'locations', 'cities'],
        auth: 'none',
        query: [
          { key: 'q', value: '' },
          { key: 'limit', value: '' },
        ],
      },
      {
        name: 'GET /businesses/locations/location-types',
        method: 'GET',
        path: ['businesses', 'locations', 'location-types'],
        auth: 'none',
      },
      {
        name: 'GET /businesses/locations/search',
        method: 'GET',
        path: ['businesses', 'locations', 'search'],
        auth: 'none',
        query: [
          { key: 'cities', value: '' },
          { key: 'locationType', value: '' },
          { key: 'bookingStatus', value: 'unbooked' },
          { key: 'date', value: '2026-04-09' },
          { key: 'startTime', value: '18:00' },
          { key: 'endTime', value: '20:00' },
        ],
      },
      {
        name: 'GET /businesses/locations/facility-counts',
        method: 'GET',
        path: ['businesses', 'locations', 'facility-counts'],
        auth: 'none',
      },
      {
        name: 'POST /businesses/locations',
        method: 'POST',
        path: ['businesses', 'locations'],
        headers: { 'Content-Type': 'application/json' },
        body:
          '{\n  "businessId": "{{businessId}}",\n  "branchName": "Main",\n  "name": "Branch One",\n  "city": "Lahore",\n  "locationType": "arena",\n  "addressLine": "Street 1",\n  "phone": "+923004445556",\n  "country": "Pakistan",\n  "stateProvince": "Punjab",\n  "area": "Gulberg",\n  "latitude": 31.52,\n  "longitude": 74.35,\n  "manager": "Manager Name",\n  "timezone": "Asia/Karachi",\n  "currency": "PKR"\n}',
      },
      {
        name: 'PATCH /businesses/locations/:locationId',
        method: 'PATCH',
        path: ['businesses', 'locations', '{{locationId}}'],
        headers: { 'Content-Type': 'application/json' },
        body: '{\n  "name": "Updated branch name"\n}',
      },
      {
        name: 'PATCH /businesses/:businessId',
        method: 'PATCH',
        path: ['businesses', '{{businessId}}'],
        headers: { 'Content-Type': 'application/json' },
        body: '{\n  "businessName": "Updated business name",\n  "status": "active"\n}',
      },
      {
        name: 'DELETE /businesses/locations/:locationId',
        method: 'DELETE',
        path: ['businesses', 'locations', '{{locationId}}'],
      },
      { name: 'DELETE /businesses/:businessId', method: 'DELETE', path: ['businesses', '{{businessId}}'] },
    ],
  },
  {
    name: 'Venue discovery (public aliases)',
    description:
      'Legacy / mobile paths; overlap with `GET /businesses/locations` and related public routes.',
    routes: [
      { name: 'GET /getVenues', method: 'GET', path: ['getVenues'], auth: 'none' },
      { name: 'GET /getVenues/all', method: 'GET', path: ['getVenues', 'all'], auth: 'none' },
      { name: 'GET /getVenues/gaming', method: 'GET', path: ['getVenues', 'gaming'], auth: 'none' },
      {
        name: 'GET /getVenues/FutsalArenas',
        method: 'GET',
        path: ['getVenues', 'FutsalArenas'],
        auth: 'none',
      },
      { name: 'GET /getVenue/futsal', method: 'GET', path: ['getVenue', 'futsal'], auth: 'none' },
      { name: 'GET /getVenue/cricket', method: 'GET', path: ['getVenue', 'cricket'], auth: 'none' },
      { name: 'GET /getVenue/padel', method: 'GET', path: ['getVenue', 'padel'], auth: 'none' },
      { name: 'GET /getvenue/futsal (alias)', method: 'GET', path: ['getvenue', 'futsal'], auth: 'none' },
      { name: 'GET /getvenue/cricket (alias)', method: 'GET', path: ['getvenue', 'cricket'], auth: 'none' },
      { name: 'GET /getvenue/padel (alias)', method: 'GET', path: ['getvenue', 'padel'], auth: 'none' },
      {
        name: 'GET /getVenueDetails/:locationId',
        method: 'GET',
        path: ['getVenueDetails', '{{locationId}}'],
        auth: 'none',
      },
      {
        name: 'GET /getAllCities',
        method: 'GET',
        path: ['getAllCities'],
        auth: 'none',
        query: [
          { key: 'q', value: '' },
          { key: 'limit', value: '' },
        ],
      },
      { name: 'GET /getAllLocationTypes', method: 'GET', path: ['getAllLocationTypes'], auth: 'none' },
    ],
  },
  {
    name: 'Bookings',
    routes: [
      { name: 'GET /bookings', method: 'GET', path: ['bookings'], headers: { 'X-Tenant-Id': '{{tenantId}}' } },
      {
        name: 'GET /bookings/availability',
        method: 'GET',
        path: ['bookings', 'availability'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
        query: [
          { key: 'date', value: '2026-04-09' },
          { key: 'startTime', value: '06:00' },
          { key: 'endTime', value: '19:00' },
          { key: 'sportType', value: 'futsal' },
        ],
      },
      {
        name: 'GET /bookings/courts/:courtKind/:courtId/slots',
        method: 'GET',
        path: ['bookings', 'courts', '{{courtKind}}', '{{courtId}}', 'slots'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
        query: [{ key: 'date', value: '2026-04-09' }],
      },
      {
        name: 'GET /bookings/courts/:courtKind/:courtId/slot-grid',
        method: 'GET',
        path: ['bookings', 'courts', '{{courtKind}}', '{{courtId}}', 'slot-grid'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
        query: [
          { key: 'date', value: '2026-04-09' },
          { key: 'useWorkingHours', value: 'true' },
          { key: 'availableOnly', value: 'true' },
          { key: 'startTime', value: '' },
          { key: 'endTime', value: '' },
        ],
      },
      {
        name: 'PUT /bookings/courts/:courtKind/:courtId/slot-blocks',
        method: 'PUT',
        path: ['bookings', 'courts', '{{courtKind}}', '{{courtId}}', 'slot-blocks'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body: '{\n  "date": "2026-04-09",\n  "startTime": "18:00",\n  "blocked": true\n}',
      },
      {
        name: 'GET /bookings/:bookingId',
        method: 'GET',
        path: ['bookings', '{{bookingId}}'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
      {
        name: 'POST /bookings',
        method: 'POST',
        path: ['bookings'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body:
          '{\n  "userId": "{{userId}}",\n  "sportType": "futsal",\n  "bookingDate": "2026-04-09",\n  "items": [\n    {\n      "courtKind": "futsal_court",\n      "courtId": "{{courtId}}",\n      "startTime": "18:00",\n      "endTime": "19:00",\n      "price": 5000,\n      "currency": "PKR",\n      "status": "reserved"\n    }\n  ],\n  "pricing": { "subTotal": 5000, "discount": 0, "tax": 0, "totalAmount": 5000 },\n  "payment": { "paymentStatus": "pending", "paymentMethod": "cash" },\n  "bookingStatus": "pending",\n  "notes": ""\n}',
      },
      {
        name: 'PATCH /bookings/:bookingId',
        method: 'PATCH',
        path: ['bookings', '{{bookingId}}'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body:
          '{\n  "bookingStatus": "confirmed",\n  "notes": "",\n  "payment": { "paymentStatus": "paid", "paymentMethod": "cash" },\n  "itemStatuses": [{ "itemId": "{{bookingItemId}}", "status": "confirmed" }]\n}',
      },
    ],
  },
  {
    name: 'Legacy — placeFutsalBooking',
    routes: [
      {
        name: 'POST /placeFutsalBooking',
        method: 'POST',
        path: ['placeFutsalBooking'],
        auth: 'none',
        headers: { 'Content-Type': 'application/json' },
        body:
          '{\n  "date": "2026-04-09",\n  "startTime": "18:00",\n  "endTime": "19:00",\n  "facilitySelected": "futsal_court",\n  "fieldSelected": "{{courtId}}",\n  "venueId": "{{locationId}}",\n  "userId": "{{userId}}"\n}',
      },
    ],
  },
  {
    name: 'Billing',
    routes: [
      {
        name: 'GET /billing/invoices',
        method: 'GET',
        path: ['billing', 'invoices'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
      {
        name: 'POST /billing/invoices',
        method: 'POST',
        path: ['billing', 'invoices'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body: '{\n  "bookingId": "{{bookingId}}",\n  "amount": 1000\n}',
      },
    ],
  },
  {
    name: 'Arena',
    routes: [
      { name: 'GET /arena (meta)', method: 'GET', path: ['arena'], auth: 'none' },
      {
        name: 'GET /arena/futsal-courts',
        method: 'GET',
        path: ['arena', 'futsal-courts'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
        query: [{ key: 'businessLocationId', value: '' }],
      },
      {
        name: 'GET /arena/futsal-courts/:id',
        method: 'GET',
        path: ['arena', 'futsal-courts', '{{courtId}}'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
      {
        name: 'POST /arena/futsal-courts',
        method: 'POST',
        path: ['arena', 'futsal-courts'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body: '{\n  "businessLocationId": "{{locationId}}",\n  "name": "Futsal pitch 1"\n}',
      },
      {
        name: 'PATCH /arena/futsal-courts/:id',
        method: 'PATCH',
        path: ['arena', 'futsal-courts', '{{courtId}}'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body: '{\n  "name": "Futsal pitch 1 (updated)"\n}',
      },
      {
        name: 'DELETE /arena/futsal-courts/:id',
        method: 'DELETE',
        path: ['arena', 'futsal-courts', '{{courtId}}'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
      {
        name: 'GET /arena/cricket-courts',
        method: 'GET',
        path: ['arena', 'cricket-courts'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
        query: [{ key: 'businessLocationId', value: '' }],
      },
      {
        name: 'GET /arena/cricket-courts/:id',
        method: 'GET',
        path: ['arena', 'cricket-courts', '{{courtId}}'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
      {
        name: 'POST /arena/cricket-courts',
        method: 'POST',
        path: ['arena', 'cricket-courts'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body: '{\n  "businessLocationId": "{{locationId}}",\n  "name": "Cricket pitch 1"\n}',
      },
      {
        name: 'PATCH /arena/cricket-courts/:id',
        method: 'PATCH',
        path: ['arena', 'cricket-courts', '{{courtId}}'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body: '{\n  "name": "Cricket pitch 1 (updated)"\n}',
      },
      {
        name: 'DELETE /arena/cricket-courts/:id',
        method: 'DELETE',
        path: ['arena', 'cricket-courts', '{{courtId}}'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
      {
        name: 'GET /arena/padel-court',
        method: 'GET',
        path: ['arena', 'padel-court'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
        query: [{ key: 'businessLocationId', value: '' }],
      },
      {
        name: 'GET /arena/padel-court/:id',
        method: 'GET',
        path: ['arena', 'padel-court', '{{courtId}}'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
      {
        name: 'POST /arena/padel-court',
        method: 'POST',
        path: ['arena', 'padel-court'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body: '{\n  "businessLocationId": "{{locationId}}",\n  "name": "Padel court 1"\n}',
      },
      {
        name: 'PATCH /arena/padel-court/:id',
        method: 'PATCH',
        path: ['arena', 'padel-court', '{{courtId}}'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body: '{\n  "name": "Padel court 1 (updated)"\n}',
      },
      {
        name: 'DELETE /arena/padel-court/:id',
        method: 'DELETE',
        path: ['arena', 'padel-court', '{{courtId}}'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
    ],
  },
  {
    name: 'Product catalog',
    routes: [
      { name: 'GET /product-catalog', method: 'GET', path: ['product-catalog'], auth: 'none' },
    ],
  },
  {
    name: 'Facility catalog',
    routes: [
      {
        name: 'GET /facility-types',
        method: 'GET',
        path: ['facility-types'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
      {
        name: 'POST /facility-types',
        method: 'POST',
        path: ['facility-types'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body: '{\n  "name": "Sports Arena",\n  "description": ""\n}',
      },
      {
        name: 'GET /sub-facility-types',
        method: 'GET',
        path: ['sub-facility-types'],
        headers: { 'X-Tenant-Id': '{{tenantId}}' },
      },
      {
        name: 'POST /sub-facility-types',
        method: 'POST',
        path: ['sub-facility-types'],
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': '{{tenantId}}' },
        body:
          '{\n  "facilityTypeId": "{{facilityTypeId}}",\n  "name": "5-a-side",\n  "description": ""\n}',
      },
    ],
  },
];

function buildQueryString(query) {
  if (!query?.length) return '';
  return query.map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value ?? '')}`).join('&');
}

function postmanUrl(pathSegments, query) {
  const pathJoined = pathSegments.join('/');
  const qs = buildQueryString(query);
  const raw = qs ? `{{baseUrl}}/${pathJoined}?${qs}` : `{{baseUrl}}/${pathJoined}`;
  return {
    raw,
    host: ['{{baseUrl}}'],
    path: pathSegments,
    ...(query?.length ? { query } : {}),
  };
}

function toPostmanRequest(route) {
  const authMode = route.auth ?? 'inherit';
  const headerArr = Object.entries(route.headers ?? {}).map(([key, value]) => ({
    key,
    value,
    type: 'string',
  }));
  return {
    name: route.name,
    request: {
      ...(authMode === 'none' ? { auth: { type: 'noauth' } } : {}),
      method: route.method,
      header: headerArr,
      ...(route.body ? { body: { mode: 'raw', raw: route.body } } : {}),
      url: postmanUrl(route.path, route.query),
    },
  };
}

const postmanCollection = {
  info: {
    _postman_id: '0e4db146-142f-4ff0-a738-9a5bf5f5d1cf',
    name: 'Booking SaaS — All backend endpoints',
    description:
      'Generated by `backend-saas/scripts/generate-api-collections.mjs` from Nest controllers. ' +
      'Use **Authorization: Bearer** `{{authToken}}` (access token). ' +
      'Tenant-scoped routes need **X-Tenant-Id**. ' +
      '`x-user-id` works only if `ALLOW_INSECURE_USER_ID_HEADER=true` on the server.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{authToken}}', type: 'string' }],
  },
  item: GROUPS.map((g) => ({
    name: g.name,
    ...(g.description ? { description: g.description } : {}),
    item: g.routes.map(toPostmanRequest),
  })),
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'authToken', value: '' },
    { key: 'refreshToken', value: '' },
    { key: 'tenantId', value: '' },
    { key: 'userId', value: '' },
    { key: 'businessId', value: '' },
    { key: 'locationId', value: '' },
    { key: 'courtId', value: '' },
    { key: 'courtKind', value: 'futsal_court' },
    { key: 'bookingId', value: '' },
    { key: 'bookingItemId', value: '' },
    { key: 'facilityTypeId', value: '' },
  ],
};

writeFileSync(outPostman, JSON.stringify(postmanCollection, null, 2), 'utf8');
console.log('Wrote', outPostman);

// --- Insomnia v4 ---
const workspaceId = 'wrk_booking_saas';
const envId = 'env_booking_saas_base';
const insomniaResources = [
  {
    _id: workspaceId,
    _type: 'workspace',
    name: 'Booking SaaS API',
    description: 'Import this file into Insomnia.',
  },
  {
    _id: envId,
    _type: 'environment',
    parentId: workspaceId,
    name: 'Base',
    data: {
      base_url: 'http://localhost:3000',
      authToken: '',
      refreshToken: '',
      tenantId: '',
      userId: '',
      businessId: '',
      locationId: '',
      courtId: '',
      courtKind: 'futsal_court',
      bookingId: '',
      bookingItemId: '',
      facilityTypeId: '',
    },
  },
];

function postmanToInsomniaTemplate(s) {
  return s
    .replace(/\{\{baseUrl\}\}/g, '{{ base_url }}')
    .replace(/\{\{authToken\}\}/g, '{{ authToken }}')
    .replace(/\{\{refreshToken\}\}/g, '{{ refreshToken }}')
    .replace(/\{\{tenantId\}\}/g, '{{ tenantId }}')
    .replace(/\{\{userId\}\}/g, '{{ userId }}')
    .replace(/\{\{businessId\}\}/g, '{{ businessId }}')
    .replace(/\{\{locationId\}\}/g, '{{ locationId }}')
    .replace(/\{\{courtId\}\}/g, '{{ courtId }}')
    .replace(/\{\{courtKind\}\}/g, '{{ courtKind }}')
    .replace(/\{\{bookingId\}\}/g, '{{ bookingId }}')
    .replace(/\{\{bookingItemId\}\}/g, '{{ bookingItemId }}')
    .replace(/\{\{facilityTypeId\}\}/g, '{{ facilityTypeId }}');
}

let reqId = 0;
for (const g of GROUPS) {
  const folderId = `fld_${g.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${++reqId}`;
  insomniaResources.push({
    _id: folderId,
    _type: 'request_group',
    parentId: workspaceId,
    name: g.name,
    ...(g.description ? { description: g.description } : {}),
  });
  for (const route of g.routes) {
    const pathJoined = route.path.join('/');
    const qs = buildQueryString(route.query);
    const urlRaw = postmanToInsomniaTemplate(
      qs ? `{{ base_url }}/${pathJoined}?${qs}` : `{{ base_url }}/${pathJoined}`,
    );
    const headers = Object.entries(route.headers ?? {}).map(([name, value]) => ({
      name,
      value: postmanToInsomniaTemplate(value),
    }));
    const authMode = route.auth ?? 'inherit';
    const insReq = {
      _id: `req_${++reqId}`,
      _type: 'request',
      parentId: folderId,
      name: route.name,
      method: route.method,
      url: urlRaw,
      headers,
      body: route.body
        ? { mimeType: 'application/json', text: postmanToInsomniaTemplate(route.body) }
        : undefined,
      authentication:
        authMode === 'none'
          ? { type: 'none' }
          : { type: 'bearer', token: '{{ authToken }}', prefix: 'Bearer' },
    };
    insomniaResources.push(insReq);
  }
}

writeFileSync(
  outInsomnia,
  JSON.stringify(
    {
      _type: 'export',
      __export_format: 4,
      __export_date: new Date().toISOString(),
      __export_source: 'backend-saas/scripts/generate-api-collections.mjs',
      resources: insomniaResources,
    },
    null,
    2,
  ),
  'utf8',
);
console.log('Wrote', outInsomnia);

// --- VS Code REST Client (subset + pointer) ---
const httpLines = [
  '@baseUrl = http://localhost:3000',
  '@token = ',
  '@tenantId = ',
  '',
  '### Health',
  'GET {{baseUrl}}/health',
  '',
  '### Auth — login',
  'POST {{baseUrl}}/auth/login',
  'Content-Type: application/json',
  '',
  '{ "email": "owner@example.com", "password": "your-password" }',
  '',
  '### IAM — me',
  'GET {{baseUrl}}/iam/me',
  'Authorization: Bearer {{token}}',
  '',
  '### Businesses',
  'GET {{baseUrl}}/businesses',
  'Authorization: Bearer {{token}}',
  '',
  '### Businesses — dashboard',
  'GET {{baseUrl}}/businesses/dashboard',
  'Authorization: Bearer {{token}}',
  '',
  '### Bookings',
  'GET {{baseUrl}}/bookings',
  'Authorization: Bearer {{token}}',
  'X-Tenant-Id: {{tenantId}}',
  '',
  '### Arena meta',
  'GET {{baseUrl}}/arena',
  '',
  '### Full list',
  '# Import booking-saas-all-endpoints.postman_collection.json (repo root) or',
  '# backend-saas/api/booking-saas.insomnia.json into Insomnia.',
  '',
];

writeFileSync(outHttp, httpLines.join('\n'), 'utf8');
console.log('Wrote', outHttp);
