import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { formatDate, useI18n } from '../lib/i18n'
import { useJoinGroup, useLeaderboard, useLeaveGroup, useMyGroup, useUpdateProfile } from '../lib/api'
import type { Leaderboard, LeaderboardRow } from '../lib/types'
import { Reveal } from '../components/Reveal'
import { Spinner } from '../components/Layouts'

const MEDALS = ['🥇', '🥈', '🥉']

/** Same format as the server: first name + initial of the last name */
function shortName(full: string | null | undefined) {
  const [first, last] = (full ?? '').trim().split(/\s+/)
  if (!first) return 'Student'
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}

function weekRange(lb: Leaderboard | undefined) {
  if (!lb) return ''
  const end = new Date(new Date(lb.week_end).getTime() - 1)
  return `${formatDate(lb.week_start, { day: 'numeric', month: 'short' })} – ${formatDate(end, { day: 'numeric', month: 'short' })}`
}

function Row({ r }: { r: LeaderboardRow }) {
  const { tr } = useI18n()
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${r.is_me ? 'bg-brand-100 ring-2 ring-brand-300' : 'bg-white/70 ring-1 ring-brand-100'}`}
    >
      <span className="w-8 shrink-0 text-center text-lg font-extrabold text-muted">{r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}</span>
      <span className={`min-w-0 flex-1 truncate ${r.is_me ? 'font-extrabold text-brand-800' : 'font-semibold'}`}>
        {r.name}
        {r.is_me && <span className="ml-2 text-xs font-bold text-brand-600">{tr('(you)')}</span>}
      </span>
      <span className="shrink-0 font-extrabold text-brand-700">{tr('{n} pts', { n: r.points })}</span>
    </li>
  )
}

function GroupBox() {
  const { tr } = useI18n()
  const { profile } = useAuth()
  const group = useMyGroup()
  const join = useJoinGroup()
  const leave = useLeaveGroup()
  const [code, setCode] = useState('')

  if (profile?.group_id) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-brand-100">
        <p className="text-sm">
          {tr('Your group')}: <b>{group.data?.name ?? '…'}</b>
        </p>
        <button
          className="text-sm font-semibold text-muted hover:text-red-600"
          disabled={leave.isPending}
          onClick={() => window.confirm(tr('Leave the group?')) && leave.mutate()}
        >
          {tr('Leave group')}
        </button>
      </div>
    )
  }

  return (
    <form
      className="rounded-2xl bg-white/70 p-4 ring-1 ring-brand-100"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) join.mutate(code.trim(), { onSuccess: () => setCode('') })
      }}
    >
      <p className="text-sm font-semibold">{tr('Study in a group? Enter the code from your teacher')}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={12}
          className="field !min-h-10 flex-1 font-mono uppercase tracking-widest"
          aria-label={tr('Group code')}
        />
        <button className="btn btn-primary !min-h-10 !px-4 !py-2 text-sm" disabled={join.isPending || !code.trim()}>
          {tr('Join')}
        </button>
      </div>
      {join.error && <p className="err mt-2">{tr((join.error as Error).message)}</p>}
    </form>
  )
}

export default function LeaderboardPage() {
  const { tr } = useI18n()
  const { profile, isAdmin } = useAuth()
  const update = useUpdateProfile()
  const hasGroup = Boolean(profile?.group_id)
  const [scope, setScope] = useState<'all' | 'group'>('all')
  const [week, setWeek] = useState(0)
  const effectiveScope = scope === 'group' && hasGroup ? 'group' : 'all'
  const lb = useLeaderboard(effectiveScope, week)
  const me = lb.data?.me
  const rows = lb.data?.rows ?? []
  const meInList = rows.some((r) => r.is_me)

  return (
    <div className="space-y-5">
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-6 text-white shadow-[0_24px_50px_-24px_rgba(74,20,184,.8)]">
          <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <h1 className="text-3xl font-extrabold">🏆 {tr('Weekly leaderboard')}</h1>
            <p className="mt-1 text-sm font-semibold text-white/85">{weekRange(lb.data)}</p>
            {me && !me.hidden && (
              <p className="mt-3 text-lg font-bold">
                {me.rank
                  ? tr('You are #{r} of {t} · {n} pts', { r: me.rank, t: me.total, n: me.points })
                  : tr('Earn points to get on the leaderboard')}
              </p>
            )}
            {me?.hidden && <p className="mt-3 text-sm font-semibold text-white/85">{tr('You are hidden from the leaderboard')}</p>}
            {isAdmin && <p className="mt-3 text-sm font-semibold text-white/85">{tr('Admins are not ranked')}</p>}
          </div>
        </section>
      </Reveal>

      <div className="flex flex-wrap items-center gap-2">
        <button className={`btn !min-h-9 !px-4 !py-1.5 text-sm ${effectiveScope === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setScope('all')}>
          {tr('All students')}
        </button>
        {hasGroup && (
          <button className={`btn !min-h-9 !px-4 !py-1.5 text-sm ${effectiveScope === 'group' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setScope('group')}>
            {tr('My group')}
          </button>
        )}
        <span className="mx-1 hidden h-6 w-px bg-brand-200 sm:block" />
        <button className={`btn !min-h-9 !px-4 !py-1.5 text-sm ${week === 0 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setWeek(0)}>
          {tr('This week')}
        </button>
        <button className={`btn !min-h-9 !px-4 !py-1.5 text-sm ${week === 1 ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setWeek(1)}>
          {tr('Last week')}
        </button>
      </div>

      {lb.isLoading ? (
        <Spinner />
      ) : lb.error ? (
        <p className="err">{(lb.error as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-muted">{tr('No points yet this week. Take a test or finish a lesson to be first!')}</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => (
            <Row key={`${r.rank}-${r.name}-${r.is_me}`} r={r} />
          ))}
          {me && me.rank && !meInList && (
            <>
              <li className="text-center text-muted">⋯</li>
              <Row r={{ rank: me.rank, name: shortName(profile?.full_name), points: me.points, is_me: true }} />
            </>
          )}
        </ol>
      )}

      {!isAdmin && <GroupBox />}

      <details className="rounded-2xl bg-white/70 p-4 ring-1 ring-brand-100">
        <summary className="cursor-pointer text-sm font-bold">{tr('How points are counted')}</summary>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
          <li>{tr('Tests: 1 point per correct answer (best attempt of each test this week)')}</li>
          <li>{tr('Lessons and word lists: 10 points for each one completed')}</li>
          <li>{tr('Mistake bank: 2 points for each fixed mistake')}</li>
          <li>{tr('The week starts on Monday, Almaty time')}</li>
        </ul>
      </details>

      {!isAdmin && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#5b1fd6]"
            checked={profile?.hide_from_leaderboard ?? false}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ hide_from_leaderboard: e.target.checked })}
          />
          {tr('Hide me from the leaderboard')}
        </label>
      )}
    </div>
  )
}
