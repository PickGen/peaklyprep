import { useState, type FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { fieldErrors, loginSchema, registerSchema, type FieldErrors } from '../lib/schemas'
import { Brand } from '../components/Brand'

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { tr } = useI18n()
  return (
    <main className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-md place-items-center px-5 pb-10">
      <div className="glass w-full rounded-3xl p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <Brand />
          </div>
          <h1 className="text-2xl font-extrabold">{tr(title)}</h1>
          <p className="mt-1 text-sm text-muted">{tr(subtitle)}</p>
        </div>
        {children}
      </div>
    </main>
  )
}

function Field({ label, name, type = 'text', error, autoComplete }: { label: string; name: string; type?: string; error?: string; autoComplete?: string }) {
  const { tr } = useI18n()
  return (
    <div>
      <label className="label" htmlFor={name}>
        {tr(label)}
      </label>
      <input id={name} name={name} type={type} className="field" aria-invalid={Boolean(error)} autoComplete={autoComplete} />
      {error && <p className="err">{tr(error)}</p>}
    </div>
  )
}

export function LoginPage() {
  const { tr } = useI18n()
  const { signIn } = useAuth()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setFormError('')
    setBusy(true)
    try {
      await signIn(parsed.data.email, parsed.data.password)
      // GuestOnly redirects to the right place (admin panel / student app) once the profile loads
    } catch (err) {
      setFormError(tr(err instanceof Error ? err.message : 'Could not log in'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="Welcome back" subtitle="Log in to continue your SAT preparation">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" error={errors.password} />
        {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? tr('Logging in…') : tr('Log in')}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        {tr("New here?")}{' '}
        <Link to="/register" className="font-semibold text-brand-600">
          {tr("Create an account")}
        </Link>
      </p>
    </Shell>
  )
}

export function RegisterPage() {
  const { tr } = useI18n()
  const { signUp } = useAuth()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = registerSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setFormError('')
    setBusy(true)
    try {
      const { needsConfirmation } = await signUp(parsed.data.fullName, parsed.data.email, parsed.data.password)
      if (needsConfirmation) setNotice(tr('Check your inbox to confirm your email, then log in.'))
    } catch (err) {
      setFormError(tr(err instanceof Error ? err.message : 'Could not create account'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="Create your account" subtitle="Start preparing for the SAT today">
      {notice ? (
        <div className="space-y-4 text-center">
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{notice}</p>
          <Link to="/login" className="btn btn-primary w-full">
            {tr("Go to log in")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Full name" name="fullName" autoComplete="name" error={errors.fullName} />
          <Field label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
          <Field label="Password" name="password" type="password" autoComplete="new-password" error={errors.password} />
          {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? tr('Creating…') : tr('Get Started')}
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-muted">
        {tr("Already have an account?")}{' '}
        <Link to="/login" className="font-semibold text-brand-600">
          {tr("Log in")}
        </Link>
      </p>
    </Shell>
  )
}
