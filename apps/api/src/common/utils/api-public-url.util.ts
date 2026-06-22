export function resolveApiPublicBaseUrl(): string | null {
  const explicit =
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.PUBLIC_API_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    const host = vercelProd.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    return `https://${host}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    return `https://${host}`;
  }

  return null;
}
