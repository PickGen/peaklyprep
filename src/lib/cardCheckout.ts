// Pure helpers for paying by card online (Lemon Squeezy). No imports, so the unit tests can load this file directly.

export const CARD_PLANS = ['1m', '3m', '6m', '12m'] as const

/** The app_settings key that holds the Lemon Squeezy checkout link of a plan. */
export const checkoutSettingKey = (plan: string) => `ls_checkout_${plan}`

/** Settings saved from the admin panel come back wrapped in quotes; a link never contains one. */
export const cleanSetting = (value: unknown) => String(value ?? '').replace(/"/g, '').trim()

/** Only a real Lemon Squeezy checkout address is accepted, so a typo cannot send students elsewhere. */
export function isCheckoutLink(link: string): boolean {
  try {
    const url = new URL(link)
    return url.protocol === 'https:' && url.hostname.endsWith('.lemonsqueezy.com') && /\/buy\//.test(url.pathname)
  } catch {
    return false
  }
}

/**
 * The address the "pay by card" button opens: the plan's checkout link plus the student's id, which
 * Lemon Squeezy hands back to our server with the paid order (that is how the right account gets access).
 * Nothing else about the student goes into the address. Returns null while no valid link is set.
 */
export function buildCheckoutUrl(link: string, userId: string, plan: string): string | null {
  if (!userId || !isCheckoutLink(link)) return null
  const url = new URL(link)
  url.searchParams.set('checkout[custom][user_id]', userId)
  url.searchParams.set('checkout[custom][plan]', plan)
  return url.toString()
}
