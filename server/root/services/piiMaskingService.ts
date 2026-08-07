// PLACEHOLDER — TASK-ROOT-SECURITY-05 owns the real implementation of this
// file (the reusable masking utility + the "View Sensitive Data"
// unmask-with-audit flow).
//
// TASK-ROOT-DASHBOARD-02's task file explicitly authorizes creating this
// placeholder at this exact path if SECURITY-05 hasn't merged yet ("Call
// through a masking function imported from
// server/root/services/piiMaskingService (placeholder it if that task
// hasn't landed yet ... flag in your report)"). This implementation only
// covers the DISPLAY-shape masking this task needs (phone/email, matching
// the documented `98765XXXXX` / `ra***@gmail.com` shapes) — it deliberately
// does NOT implement unmasking, break-glass, or audit-logged reveal; that
// is SECURITY-05's scope, not reimplemented here.
//
// Integrator: once TASK-ROOT-SECURITY-05 lands its real
// server/root/services/piiMaskingService.ts, delete this file's contents
// and replace with the real one (or delete this file and repoint imports),
// whichever SECURITY-05's own report recommends. Every caller in this
// task's routes imports ONLY `maskPhone`/`maskEmail` from this exact path,
// so swapping the file's contents is a drop-in replacement as long as the
// real service exports functions with the same names and signatures.

/**
 * Masks a phone number for default (non-privileged) display, e.g.
 * "9876543210" -> "98765XXXXX", "+91 98765 43210" -> "98765XXXXX".
 * Non-digit characters and any country-code prefix beyond the last 10
 * digits are stripped for the masked display (the documented example
 * `98765XXXXX` is a bare 10-digit shape). Returns an empty string
 * unchanged, and falls back to a fully-masked string for numbers shorter
 * than 10 digits rather than throwing.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length < 10) {
    // Too short to safely reveal 5 digits — mask everything but the first
    // 2, matching the spirit of the documented shape without over-revealing
    // a short/malformed number.
    const visible = digits.slice(0, Math.min(2, digits.length));
    return visible + 'X'.repeat(Math.max(digits.length - visible.length, 0));
  }
  const local = digits.slice(-10);
  return local.slice(0, 5) + 'X'.repeat(5);
}

/**
 * Masks an email address for default (non-privileged) display, e.g.
 * "rahul@gmail.com" -> "ra***@gmail.com". Keeps the first 2 characters of
 * the local part (1 character if the local part is exactly 1 character),
 * a fixed 3-asterisk mask (matching the documented example literally,
 * rather than a length-proportional mask), and the domain unmasked (the
 * domain alone is not considered sensitive PII for search/list display
 * purposes).
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
