import { useState } from 'react'
import { LangSwitch, useI18n } from '../lib/i18n'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Brand } from './Brand'
import {
  BellIcon,
  BookIcon,
  ChartIcon,
  CheckSquareIcon,
  CloseIcon,
  CrownIcon,
  FileIcon,
  HomeIcon,
  LayersIcon,
  LogoutIcon,
  MenuIcon,
  ShieldIcon,
  UserIcon,
} from './Icons'
import { isConfigured } from '../lib/supabase'

export function Spinner({ full = false }: { full?: boolean }) {
  return (
    <div className={`grid place-items-center ${full ? 'min-h-dvh' : 'py-16'}`}>
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
    </div>
  )
}

export function SetupNotice() {
  if (isConfigured) return null
  return (
    <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      Supabase is not configured yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code>.
    </div>
  )
}

/* ---------- Route guards ---------- */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Spinner full />
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <Outlet />
}

export function RequireAdmin() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <Spinner full />
  if (!isAdmin) return <Navigate to="/app" replace />
  return <Outlet />
}

export function GuestOnly() {
  const { session, loading, isAdmin } = useAuth()
  const loc = useLocation()
  if (loading) return <Spinner full />
  if (session) {
    const from = (loc.state as { from?: string } | null)?.from
    return <Navigate to={isAdmin ? '/admin' : from && from.startsWith('/app') ? from : '/app'} replace />
  }
  return <Outlet />
}

/* ---------- Public (landing / auth) ---------- */
const publicLinks = [
  { label: 'SAT', to: '/#sat' },
  { label: 'Courses', to: '/app/learn' },
  { label: 'Practice', to: '/app/practice' },
  { label: 'Plans', to: '/#pricing' },
  { label: 'Support', href: 'mailto:support@peaklyprep.com' },
]

export function PublicHeader() {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  const { session, isAdmin } = useAuth()
  return (
    <header className="safe-top relative z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-10 md:py-6">
        <Brand />
        <nav className="hidden items-center gap-9 text-[15px] font-medium md:flex">
          {publicLinks.map((l) =>
            l.href ? (
              <a key={tr(l.label)} href={l.href} className="transition-colors hover:text-brand-600">
                {tr(l.label)}
              </a>
            ) : (
              <Link key={tr(l.label)} to={l.to!} className="transition-colors hover:text-brand-600">
                {tr(l.label)}
              </Link>
            ),
          )}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <LangSwitch />
          {session ? (
            <Link to={isAdmin ? '/admin' : '/app'} className="btn btn-primary">
              {tr("Open app")}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost !py-2.5">
                {tr("Log in")}
              </Link>
              <Link to="/register" className="btn btn-primary !py-2.5">
                {tr("Get Started")}
              </Link>
            </>
          )}
        </div>
        <button className="grid h-11 w-11 place-items-center rounded-xl md:hidden" onClick={() => setOpen((v) => !v)} aria-label={tr("Menu")} aria-expanded={open}>
          {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="glass mx-4 rounded-2xl p-4 md:hidden">
          <nav className="flex flex-col gap-1 text-base font-medium">
            {publicLinks.map((l) =>
              l.href ? (
                <a key={tr(l.label)} href={l.href} className="rounded-lg px-3 py-3" onClick={() => setOpen(false)}>
                  {tr(l.label)}
                </a>
              ) : (
                <Link key={tr(l.label)} to={l.to!} className="rounded-lg px-3 py-3" onClick={() => setOpen(false)}>
                  {tr(l.label)}
                </Link>
              ),
            )}
          </nav>
          <div className="mt-3 flex justify-center">
            <LangSwitch />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {session ? (
              <Link to={isAdmin ? '/admin' : '/app'} className="btn btn-primary col-span-2" onClick={() => setOpen(false)}>
                {tr("Open app")}
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost" onClick={() => setOpen(false)}>
                  {tr("Log in")}
                </Link>
                <Link to="/register" className="btn btn-primary" onClick={() => setOpen(false)}>
                  {tr("Get Started")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export function PublicLayout() {
  return (
    <div className="min-h-dvh">
      <SetupNotice />
      <PublicHeader />
      <Outlet />
    </div>
  )
}

/* ---------- Student app shell ---------- */
const tabs = [
  { to: '/app', label: 'Home', end: true, icon: (a: boolean) => <HomeIcon className="h-6 w-6" filled={a} /> },
  { to: '/app/learn', label: 'Learn', icon: () => <BookIcon className="h-6 w-6 !stroke-current" /> },
  { to: '/app/words', label: 'Words', icon: () => <LayersIcon className="h-6 w-6 !stroke-current" /> },
  { to: '/app/practice', label: 'Practice', icon: () => <CheckSquareIcon className="h-6 w-6 !stroke-current" /> },
  { to: '/app/profile', label: 'Profile', icon: () => <UserIcon className="h-6 w-6" /> },
]

function Bell() {
  const { tr } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-full" aria-label={tr("Notifications")}>
        <BellIcon className="h-6 w-6" />
      </button>
      {open && (
        <div className="glass absolute right-0 top-12 z-40 w-60 rounded-2xl p-4 text-sm text-muted">{tr("You're all caught up. No new notifications.")}</div>
      )}
    </div>
  )
}

const sideItems = [
  { to: '/app', label: 'Home', end: true, icon: <HomeIcon className="h-5 w-5" /> },
  { to: '/app/learn', label: 'Lessons', icon: <BookIcon className="h-5 w-5 !stroke-current" /> },
  { to: '/app/words', label: 'Word Lists', icon: <LayersIcon className="h-5 w-5 !stroke-current" /> },
  { to: '/app/practice', label: 'Practice Tests', icon: <FileIcon className="h-5 w-5" /> },
  { to: '/app/progress', label: 'Statistics', icon: <ChartIcon className="h-5 w-5" /> },
  { to: '/app/plans', label: 'Plans', icon: <CrownIcon className="h-5 w-5" /> },
]

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-all ${
    isActive ? 'bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-btn' : 'text-muted hover:bg-white/70 hover:text-ink'
  }`

export function AppShell() {
  const { tr } = useI18n()
  const { profile, isAdmin, signOut } = useAuth()
  const nav = useNavigate()
  return (
    <div className="min-h-dvh pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10 md:pl-64">
      <SetupNotice />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/70 bg-white/60 p-4 backdrop-blur-xl md:flex">
        <div className="px-2 pb-6 pt-2">
          <Brand to="/app" size="sm" />
        </div>
        <nav className="flex flex-col gap-1.5">
          {sideItems.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={sideLink}>
              {i.icon}
              {tr(i.label)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1.5 border-t border-brand-100 pt-4">
          {isAdmin && (
            <NavLink to="/admin" className={sideLink}>
              <ShieldIcon className="h-5 w-5" /> {tr("Admin panel")}
            </NavLink>
          )}
          <NavLink to="/app/profile" className={sideLink}>
            <UserIcon className="h-5 w-5" />
            <span className="min-w-0 flex-1 truncate">{profile?.full_name || tr('My account')}</span>
          </NavLink>
          <button
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold text-muted transition-colors hover:bg-white/70 hover:text-ink"
            onClick={async () => {
              await signOut()
              nav('/')
            }}
          >
            <LogoutIcon className="h-5 w-5" /> {tr("Log out")}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="safe-top sticky top-0 z-30 border-b border-white/60 bg-white/60 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-5 py-3">
          <Brand to="/app" size="sm" />
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Link to="/admin" className="btn btn-ghost !min-h-10 !px-3 !py-1.5 text-sm">
                <ShieldIcon className="h-4 w-4" /> {tr("Admin")}
              </Link>
            )}
            <Bell />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-4 md:px-10 md:pt-10">
        <Outlet />
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/85 backdrop-blur-xl md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5 px-1 pt-2 pb-2">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} end={t.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-1 text-[12px] font-semibold ${isActive ? 'text-brand-600' : 'text-muted'}`}>
                {({ isActive }) => (
                  <>
                    {t.icon(isActive)}
                    {tr(t.label)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
/* ---------- Admin shell ---------- */
const adminTabs = [
  { to: '/admin', label: 'Lessons', end: true },
  { to: '/admin/tests', label: 'Tests & Questions' },
  { to: '/admin/news', label: 'News' },
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/settings', label: 'Settings' },
]

export function AdminShell() {
  const { signOut, profile } = useAuth()
  const nav = useNavigate()
  return (
    <div className="min-h-dvh pb-10">
      <SetupNotice />
      <header className="safe-top sticky top-0 z-30 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Brand to="/admin" size="sm" />
            <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700">ADMIN</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/app" className="btn btn-ghost !min-h-10 !px-3 !py-2 text-sm">
              Student view
            </Link>
            <button
              className="btn btn-ghost !min-h-10 !px-3 !py-2 text-sm"
              title={profile?.email}
              onClick={async () => {
                await signOut()
                nav('/')
              }}
            >
              <LogoutIcon className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 md:px-7">
          {adminTabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-ink'}`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-6 md:px-8">
        <Outlet />
      </main>
    </div>
  )
}
