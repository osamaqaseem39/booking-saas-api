import { resolveApiPublicBaseUrl } from './api-public-url.util';

describe('resolveApiPublicBaseUrl', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.API_PUBLIC_URL;
    delete process.env.PUBLIC_API_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
  });

  afterAll(() => {
    process.env = env;
  });

  it('prefers API_PUBLIC_URL', () => {
    process.env.API_PUBLIC_URL = 'https://api.example.com/';
    expect(resolveApiPublicBaseUrl()).toBe('https://api.example.com');
  });

  it('falls back to VERCEL_PROJECT_PRODUCTION_URL', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'booking-saas-api-lilac.vercel.app';
    expect(resolveApiPublicBaseUrl()).toBe('https://booking-saas-api-lilac.vercel.app');
  });

  it('falls back to VERCEL_URL', () => {
    process.env.VERCEL_URL = 'my-preview.vercel.app';
    expect(resolveApiPublicBaseUrl()).toBe('https://my-preview.vercel.app');
  });
});
