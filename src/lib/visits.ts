import { isConfigured, supabase } from './supabase'

const VISITOR_KEY = 'pp_visitor'
const SESSION_KEY = 'pp_visit_logged'
const BOT = /bot|crawl|spider|slurp|lighthouse|headless/i

/** A random id kept in this browser, so the same person is not counted as a new visitor every time. */
function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    // older browsers have no crypto.randomUUID
    id =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
    localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

/**
 * Tells the database that the site was opened (for the admin "Statistics" page). Sent once per browser tab;
 * the database ignores repeats within 30 minutes and visits by admins. Only the random id and the page path
 * are sent. Counting must never break the site, so every failure is swallowed.
 *
 * The tab is marked as counted only after the database accepted the call: if it failed (no network, the
 * counter was not set up yet), the next page load in the same tab tries again.
 */
export function trackVisit(): void {
  if (!isConfigured || import.meta.env.DEV) return
  try {
    if (BOT.test(navigator.userAgent) || sessionStorage.getItem(SESSION_KEY)) return
    const id = visitorId()
    void supabase.rpc('log_visit', { p_visitor: id, p_path: location.pathname }).then(
      ({ error }) => {
        if (error) return
        try {
          sessionStorage.setItem(SESSION_KEY, '1')
        } catch {
          // storage is blocked: the database still ignores repeats within 30 minutes
        }
      },
      () => undefined,
    )
  } catch {
    // storage is blocked (private mode): skip counting
  }
}
