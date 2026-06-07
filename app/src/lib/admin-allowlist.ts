/**
 * Parses the ADMIN_EMAILS env value (comma-separated) into a normalized list.
 * Emails are trimmed, lowercased, and blanks dropped.
 */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
}

/**
 * Returns true if the given email is in the comma-separated allowlist value.
 */
export function isAllowlistedAdmin(email: string, allowlistRaw: string | undefined): boolean {
  const list = parseAdminEmails(allowlistRaw)
  return list.includes(email.trim().toLowerCase())
}
