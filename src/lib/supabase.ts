import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anon)

// A placeholder client keeps the UI renderable (with a setup notice) when env vars are missing.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anon || 'placeholder-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/**
 * Whether new students must open a link from an email before they can log in. This is a public setting
 * of the Supabase project ("Confirm email"); the sign-up page reads it to tell students what to expect.
 */
export async function emailConfirmationRequired(): Promise<boolean> {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon ?? '' } })
  if (!res.ok) throw new Error(`auth settings answered ${res.status}`)
  const settings = (await res.json()) as { mailer_autoconfirm?: boolean }
  return settings.mailer_autoconfirm === false
}
