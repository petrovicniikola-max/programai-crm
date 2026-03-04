/**
 * Normalises phone for storage/search: digits only (optionally with leading +).
 */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}
