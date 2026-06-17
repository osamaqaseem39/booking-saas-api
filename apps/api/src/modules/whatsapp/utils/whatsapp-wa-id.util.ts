export function normalizeWaId(from: string): string {
  return from.replace(/\D/g, '');
}

export function toOpenWaChatId(waId: string): string {
  const trimmed = waId.trim();
  if (trimmed.includes('@')) return trimmed;
  const digits = normalizeWaId(trimmed);
  return `${digits}@c.us`;
}
