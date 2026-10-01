export const DEFAULT_DECISION_NOTIFICATION_EMAILS = [
  'estuar@estuar.rs',
  'racunovodstvo@estuar.rs',
] as const;

export function parseDecisionNotificationEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_DECISION_NOTIFICATION_EMAILS];
  const emails = raw
    .filter((e): e is string => typeof e === 'string')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
  return emails.length > 0 ? emails : [...DEFAULT_DECISION_NOTIFICATION_EMAILS];
}
