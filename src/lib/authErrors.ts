// Supabase reports sign-up and log-in problems in English. These helpers turn the ones a student can
// really run into into plain messages (the returned strings are keys of the dictionary in i18n.tsx).
// No imports, so the unit tests can load this file directly.

export const EMAIL_NOT_CONFIRMED = 'Your email is not confirmed yet. Open the email from PeaklyPrep and tap the link in it.'
export const TOO_MANY_EMAILS = 'Too many emails were sent just now. Please try again in an hour.'
export const WAIT_A_MINUTE = 'Please wait a minute before asking for another email.'

const messageOf = (err: unknown) => (err instanceof Error ? err.message : typeof err === 'string' ? err : '')

/** The account exists, but the link from the confirmation email was never opened. */
export const isEmailNotConfirmed = (err: unknown) => /email not confirmed/i.test(messageOf(err))

/** The text to show for a failed sign-up, log-in or "send again"; `fallback` when the error says nothing. */
export function authErrorKey(err: unknown, fallback: string): string {
  const message = messageOf(err)
  if (!message) return fallback
  if (isEmailNotConfirmed(message)) return EMAIL_NOT_CONFIRMED
  if (/rate limit/i.test(message)) return TOO_MANY_EMAILS
  if (/only request this after/i.test(message)) return WAIT_A_MINUTE
  return message
}
