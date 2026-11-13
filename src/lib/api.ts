import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { fixGarbledDeep } from './textFix'
import type { Attempt, AttemptResult, Leaderboard, LeaderboardExtra, Lesson, LessonProgress, MistakeItem, NewsItem, Profile, Question, StudyGroup, Subscription, Test } from './types'
import { buildNotifications, type AppNotification } from './notifications'
import type { PaymentRow } from './adminStats'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/* ---------- Lessons ---------- */
export function useLessons() {
  return useQuery({
    queryKey: ['lessons'],
    queryFn: async () =>
      unwrap(await supabase.from('lessons').select('*').order('position').order('created_at')) as Lesson[],
  })
}

export function useLesson(id: string | undefined) {
  return useQuery({
    queryKey: ['lesson', id],
    enabled: Boolean(id),
    queryFn: async () => unwrap(await supabase.from('lessons').select('*').eq('id', id!).single()) as Lesson,
  })
}

export function useSaveLesson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Lesson> & { id?: string }) => {
      // repair text garbled by a wrong encoding before it was pasted in (e.g. "x¬≤" -> "x²")
      const { id, ...rest } = fixGarbledDeep(input)
      if (id) unwrap(await supabase.from('lessons').update(rest).eq('id', id).select())
      else unwrap(await supabase.from('lessons').insert(rest).select())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lessons'] }),
  })
}

export function useDeleteLesson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lessons').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lessons'] }),
  })
}

/* ---------- Lesson progress ---------- */
export function useLessonProgress() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['lesson_progress', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () =>
      unwrap(await supabase.from('lesson_progress').select('*').eq('user_id', session!.user.id)) as LessonProgress[],
  })
}

export function useToggleLessonDone() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async ({ lessonId, done }: { lessonId: string; done: boolean }) => {
      const uid = session!.user.id
      if (done) {
        const { error } = await supabase
          .from('lesson_progress')
          .upsert({ user_id: uid, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id' })
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('lesson_progress').delete().eq('user_id', uid).eq('lesson_id', lessonId)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lesson_progress'] }),
  })
}

/* ---------- Tests & questions ---------- */
export function useTests() {
  return useQuery({
    queryKey: ['tests'],
    queryFn: async () =>
      unwrap(await supabase.from('tests').select('*').order('position').order('created_at')) as Test[],
  })
}

export function useTest(id: string | undefined) {
  return useQuery({
    queryKey: ['test', id],
    enabled: Boolean(id),
    queryFn: async () => unwrap(await supabase.from('tests').select('*').eq('id', id!).single()) as Test,
  })
}

export function useQuestionCounts() {
  return useQuery({
    queryKey: ['question_counts'],
    queryFn: async () => {
      // Supabase returns at most 1000 rows per request, so read the question list page by page
      const out: Record<string, number> = {}
      const PAGE = 1000
      for (let from = 0; ; from += PAGE) {
        const rows = unwrap(await supabase.from('questions').select('test_id').order('id').range(from, from + PAGE - 1)) as { test_id: string }[]
        for (const r of rows) out[r.test_id] = (out[r.test_id] ?? 0) + 1
        if (rows.length < PAGE) break
      }
      return out
    },
  })
}

/** Student view: no answer keys. Admin view (`withKeys`): includes correct answers. */
export function useQuestions(testId: string | undefined, withKeys = false) {
  return useQuery({
    queryKey: ['questions', testId, withKeys],
    enabled: Boolean(testId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('questions')
          .select(withKeys ? '*, question_keys(correct_index, correct_answers, explanation)' : 'id, test_id, passage, prompt, options, position')
          .eq('test_id', testId!)
          .order('position')
          .order('created_at'),
      ) as unknown as Question[],
  })
}

export function useSaveTest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Test> & { id?: string }) => {
      // repair text garbled by a wrong encoding before it was pasted in (e.g. "x¬≤" -> "x²")
      const { id, ...rest } = fixGarbledDeep(input)
      if (id) unwrap(await supabase.from('tests').update(rest).eq('id', id).select())
      else unwrap(await supabase.from('tests').insert(rest).select())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests'] })
      qc.invalidateQueries({ queryKey: ['test'] })
    },
  })
}

export function useDeleteTest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tests').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tests'] }),
  })
}

/** Delete a whole practice test (all of its modules) at once. */
export function useDeleteTests() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('tests').delete().in('id', ids)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests'] })
      qc.invalidateQueries({ queryKey: ['question_counts'] })
      qc.invalidateQueries({ queryKey: ['attempts'] })
    },
  })
}

interface QuestionInput {
  id?: string
  test_id: string
  passage?: string | null
  prompt: string
  options: string[]
  correct_index?: number | null
  correct_answers?: string[] | null
  explanation: string | null
  position: number
}

async function saveQuestion(input: QuestionInput) {
  const q = fixGarbledDeep(input)
  let id = q.id
  const base = { test_id: q.test_id, passage: q.passage ?? null, prompt: q.prompt, options: q.options, position: q.position }
  if (id) {
    unwrap(await supabase.from('questions').update(base).eq('id', id).select())
  } else {
    const row = unwrap(await supabase.from('questions').insert(base).select('id').single()) as { id: string }
    id = row.id
  }
  unwrap(
    await supabase
      .from('question_keys')
      .upsert({ question_id: id, correct_index: q.options.length === 0 ? null : (q.correct_index ?? 0), correct_answers: q.options.length === 0 ? (q.correct_answers ?? []) : null, explanation: q.explanation }, { onConflict: 'question_id' })
      .select(),
  )
}

export function useSaveQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveQuestion,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] })
      qc.invalidateQueries({ queryKey: ['question_counts'] })
    },
  })
}

export function useImportQuestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ testId, items, startAt }: { testId: string; items: Omit<QuestionInput, 'test_id' | 'position'>[]; startAt: number }) => {
      for (let i = 0; i < items.length; i++) {
        await saveQuestion({ ...items[i], id: undefined, test_id: testId, position: startAt + i })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] })
      qc.invalidateQueries({ queryKey: ['question_counts'] })
    },
  })
}

export function useDeleteQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('questions').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] })
      qc.invalidateQueries({ queryKey: ['question_counts'] })
    },
  })
}

/* ---------- Garbled text repair (admin) ---------- */
export interface GarbledItem {
  table: 'questions' | 'lessons' | 'news'
  id: string
  /** where to find it in the admin, e.g. the test title */
  where: string
  before: string
  after: string
  /** the columns to write back */
  patch: Record<string, unknown>
  /** question_keys columns to write back (questions only) */
  keyPatch?: Record<string, unknown>
}

function changed<T extends Record<string, unknown>>(row: T): Partial<T> {
  const fixed = fixGarbledDeep(row)
  return Object.fromEntries(Object.entries(fixed).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(row[k]))) as Partial<T>
}

/** Scans every question, lesson and news post for text garbled by a wrong encoding. */
export async function findGarbledText(): Promise<GarbledItem[]> {
  // questions can exceed Supabase's 1000-row limit per request, so read them page by page
  const questionRows: unknown[] = []
  for (let from = 0; ; from += 1000) {
    const page = unwrap(
      await supabase.from('questions').select('id, prompt, passage, options, tests(title), question_keys(explanation, correct_answers)').order('id').range(from, from + 999),
    ) as unknown[]
    questionRows.push(...page)
    if (page.length < 1000) break
  }
  const questions = { data: questionRows, error: null }
  const [lessons, news] = await Promise.all([
    supabase.from('lessons').select('id, title, summary, content'),
    supabase.from('news').select('id, title, body'),
  ])
  const out: GarbledItem[] = []
  type QRow = Pick<Question, 'id' | 'prompt' | 'passage' | 'options'> & {
    tests: { title: string } | null
    question_keys: { explanation: string | null; correct_answers: string[] | null } | null
  }
  for (const q of unwrap(questions) as unknown as QRow[]) {
    const patch = changed({ prompt: q.prompt, passage: q.passage, options: q.options })
    const keyPatch = q.question_keys ? changed({ explanation: q.question_keys.explanation, correct_answers: q.question_keys.correct_answers }) : {}
    if (Object.keys(patch).length || Object.keys(keyPatch).length) {
      out.push({ table: 'questions', id: q.id, where: q.tests?.title ?? 'Question', before: q.prompt, after: fixGarbledDeep(q.prompt), patch, keyPatch })
    }
  }
  for (const l of unwrap(lessons) as Pick<Lesson, 'id' | 'title' | 'summary' | 'content'>[]) {
    const patch = changed({ title: l.title, summary: l.summary, content: l.content })
    if (Object.keys(patch).length) out.push({ table: 'lessons', id: l.id, where: 'Lesson', before: l.title, after: fixGarbledDeep(l.title), patch })
  }
  for (const n of unwrap(news) as Pick<NewsItem, 'id' | 'title' | 'body'>[]) {
    const patch = changed({ title: n.title, body: n.body })
    if (Object.keys(patch).length) out.push({ table: 'news', id: n.id, where: 'News', before: n.title, after: fixGarbledDeep(n.title), patch })
  }
  return out
}

export function useFixGarbledText() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: GarbledItem[]) => {
      for (const it of items) {
        if (Object.keys(it.patch).length) unwrap(await supabase.from(it.table).update(it.patch).eq('id', it.id).select('id'))
        if (it.keyPatch && Object.keys(it.keyPatch).length) unwrap(await supabase.from('question_keys').update(it.keyPatch).eq('question_id', it.id).select('question_id'))
      }
    },
    onSuccess: () => {
      for (const key of ['questions', 'lessons', 'lesson', 'news']) qc.invalidateQueries({ queryKey: [key] })
    },
  })
}

/* ---------- Attempts ---------- */
export function useMyAttempts() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['attempts', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('test_attempts')
          .select('*, tests(title, section, form_title, module_no)')
          .eq('user_id', session!.user.id)
          .order('created_at', { ascending: false }),
      ) as unknown as Attempt[],
  })
}

/** Delete old attempts (own rows only; RLS enforces it). */
export function useDeleteAttempts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('test_attempts').delete().in('id', ids)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attempts'] })
      qc.invalidateQueries({ queryKey: ['mistake_bank'] })
    },
  })
}

export function useSubmitAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ testId, answers }: { testId: string; answers: Record<string, number | string> }) => {
      const { data, error } = await supabase.rpc('submit_attempt', { p_test_id: testId, p_answers: answers })
      if (error) throw new Error(error.message)
      return data as AttemptResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attempts'] })
      qc.invalidateQueries({ queryKey: ['mistake_bank'] })
    },
  })
}

/* ---------- Admin: students ---------- */
export interface StudentRow extends Profile {
  attempts: number
  avgPercent: number | null
  lessonsDone: number
  plan: Subscription['plan'] | null
  planUntil: string | null
  planActive: boolean
}

export function useStudents() {
  return useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const [profiles, attempts, progress, subs] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false }),
        supabase.from('test_attempts').select('user_id, score, total'),
        supabase.from('lesson_progress').select('user_id'),
        supabase.from('subscriptions').select('*').order('expires_at', { ascending: false }),
      ])
      const ps = unwrap(profiles) as Profile[]
      const as = unwrap(attempts) as { user_id: string; score: number; total: number }[]
      const pr = unwrap(progress) as { user_id: string }[]
      const ss = unwrap(subs) as Subscription[]
      return ps.map<StudentRow>((p) => {
        const mine = as.filter((a) => a.user_id === p.id)
        const pct = mine.filter((a) => a.total > 0).map((a) => (a.score / a.total) * 100)
        const latest = ss.find((x) => x.user_id === p.id) // newest expiry first
        return {
          ...p,
          attempts: mine.length,
          avgPercent: pct.length ? Math.round(pct.reduce((s, v) => s + v, 0) / pct.length) : null,
          lessonsDone: pr.filter((x) => x.user_id === p.id).length,
          plan: latest?.plan ?? null,
          planUntil: latest?.expires_at ?? null,
          planActive: latest ? new Date(latest.expires_at) > new Date() : false,
        }
      })
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, 'full_name' | 'target_score' | 'exam_date' | 'study_minutes' | 'email_updates' | 'hide_from_leaderboard'>>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', session!.user.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}

/* ---------- News ---------- */
export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: async () => unwrap(await supabase.from('news').select('*').order('created_at', { ascending: false })) as NewsItem[],
  })
}

export function useSaveNews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<NewsItem> & { id?: string }) => {
      // repair text garbled by a wrong encoding before it was pasted in (e.g. "x¬≤" -> "x²")
      const { id, ...rest } = fixGarbledDeep(input)
      if (id) unwrap(await supabase.from('news').update(rest).eq('id', id).select())
      else unwrap(await supabase.from('news').insert(rest).select())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news'] }),
  })
}

export function useDeleteNews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('news').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['news'] }),
  })
}
/** Correct answers + the student's chosen answers for a finished attempt (server-side, see get_attempt_review) */
export function useAttemptReview(attemptId: string | undefined) {
  return useQuery({
    queryKey: ['attempt-review', attemptId],
    enabled: Boolean(attemptId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_attempt_review', { p_attempt_id: attemptId })
      if (error) throw new Error(error.message)
      return data as AttemptResult
    },
  })
}

/* ---------- Subscriptions ---------- */
const PLAN_MONTHS: Record<Subscription['plan'], number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }

/** Whether the signed-in user may open lessons and tests: an active subscription, or an admin. */
export function useHasAccess() {
  const { isAdmin } = useAuth()
  const sub = useMySubscription()
  const active = isAdmin || (sub.data ? new Date(sub.data.expires_at) > new Date() : false)
  return { loading: !isAdmin && sub.isLoading, active }
}

/** The signed-in student's newest subscription (it may already be expired - check expires_at). */
export function useMySubscription() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['subscription', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', session!.user.id).order('expires_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw new Error(error.message)
      return (data as Subscription | null) ?? null
    },
  })
}

/** TEST checkout: activates the plan immediately (server refuses when the test_checkout setting is off). */
export function useBuyPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (plan: Subscription['plan']) => {
      const { data, error } = await supabase.rpc('test_purchase', { p_plan: plan })
      if (error) throw new Error(error.message)
      return data as { plan: Subscription['plan']; expires_at: string }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription'] }),
  })
}

/** Admin: give a student a plan (starts now, or after the current plan if one is still active). */
export function useGrantPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, plan, currentUntil }: { userId: string; plan: Subscription['plan']; currentUntil: string | null }) => {
      const start = currentUntil && new Date(currentUntil) > new Date() ? new Date(currentUntil) : new Date()
      const end = new Date(start)
      end.setMonth(end.getMonth() + PLAN_MONTHS[plan])
      const { error } = await supabase.from('subscriptions').insert({ user_id: userId, plan, expires_at: end.toISOString(), source: 'manual' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  })
}

/* ---------- App Settings ---------- */
export function useAppSetting(key: string) {
  return useQuery({
    queryKey: ['app_setting', key],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
      if (error) throw new Error(error.message)
      return (data?.value as string | null) ?? null
    },
  })
}

export function useUpdateAppSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase.from('app_settings').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, { key }) => qc.invalidateQueries({ queryKey: ['app_setting', key] }),
  })
}

/* ---------- Payment Requests ---------- */
export interface PaymentRequest {
  id: string
  user_id: string
  plan: Subscription['plan']
  amount_usd: number
  receipt_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  profiles?: { email: string; full_name: string | null }
}

export function useMyPaymentRequests() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['my_payment_requests', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_requests').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as PaymentRequest[]
    },
  })
}

export function useAllPaymentRequests(enabled = true) {
  return useQuery({
    queryKey: ['all_payment_requests'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_requests').select('*, profiles(email, full_name)').order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as PaymentRequest[]
    },
  })
}

export function useSubmitPaymentRequest() {
  const { session } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ plan, amount_usd, receipt_url }: { plan: Subscription['plan']; amount_usd: number; receipt_url: string | null }) => {
      const { error } = await supabase.from('payment_requests').insert({ user_id: session!.user.id, plan, amount_usd, receipt_url })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my_payment_requests'] }),
  })
}

export function useUpdatePaymentRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, admin_note, userId, plan }: { id: string; status: 'approved' | 'rejected'; admin_note?: string; userId: string; plan: Subscription['plan'] }) => {
      const { error } = await supabase.from('payment_requests').update({ status, admin_note }).eq('id', id)
      if (error) throw new Error(error.message)
      if (status === 'approved') {
        const months: Record<Subscription['plan'], number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }
        const end = new Date()
        end.setMonth(end.getMonth() + months[plan])
        const { error: subErr } = await supabase.from('subscriptions').insert({ user_id: userId, plan, expires_at: end.toISOString(), source: 'manual' })
        if (subErr) throw new Error(subErr.message)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all_payment_requests'] })
      qc.invalidateQueries({ queryKey: ['students'] })
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
    },
  })
}

/* ---------- Notifications (bell) ---------- */
/** Which notification keys the user has read (stored in notification_reads, so it works on every device). */
function useNotificationReads() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['notification_reads', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.from('notification_reads').select('key').eq('user_id', session!.user.id)
      if (error) return new Set<string>() // table missing until the migration runs: everything counts as unread
      return new Set((data as { key: string }[]).map((r) => r.key))
    },
  })
}

export function useNotifications() {
  const { profile, isAdmin } = useAuth()
  const sub = useMySubscription()
  const payments = useMyPaymentRequests()
  const all = useAllPaymentRequests(isAdmin)
  const news = useNews()
  const reads = useNotificationReads()
  const items: AppNotification[] = buildNotifications({
    now: new Date(),
    isAdmin,
    subscription: sub.data ?? null,
    payments: payments.data ?? [],
    news: news.data ?? [],
    examDate: profile?.exam_date ?? null,
    pendingPayments: isAdmin ? (all.data ?? []).filter((p) => p.status === 'pending') : undefined,
  })
  const read = reads.data ?? new Set<string>()
  return { items, unread: items.filter((n) => !read.has(n.key)).length, isRead: (key: string) => read.has(key), loading: reads.isLoading }
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (keys: string[]) => {
      if (!keys.length) return
      const uid = session!.user.id
      const { error } = await supabase.from('notification_reads').upsert(keys.map((key) => ({ user_id: uid, key })), { onConflict: 'user_id,key', ignoreDuplicates: true })
      if (error) throw new Error(error.message)
    },
    onMutate: (keys) => {
      // show them as read right away
      const k = ['notification_reads', session?.user.id]
      const prev = qc.getQueryData<Set<string>>(k) ?? new Set<string>()
      qc.setQueryData(k, new Set([...prev, ...keys]))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notification_reads'] }),
  })
}

/* ---------- Mistake bank ---------- */
export function useMistakeBank(enabled = true) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['mistake_bank', session?.user.id],
    enabled: Boolean(session) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_mistake_bank')
      if (error) throw new Error(error.message)
      return (data ?? []) as MistakeItem[]
    },
  })
}

/** Retry a question from the mistake bank (graded on the server). A correct answer removes it from the bank. */
export function useCheckMistake() {
  return useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: number | string }) => {
      const { data, error } = await supabase.rpc('check_mistake', { p_question_id: questionId, p_answer: answer })
      if (error) throw new Error(error.message)
      return data as { correct: boolean }
    },
  })
}

/** Admin: end a student's active plans now. */
export function useRevokePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('subscriptions').update({ expires_at: new Date().toISOString() }).eq('user_id', userId).gt('expires_at', new Date().toISOString())
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  })
}

/* ---------- Weekly leaderboard & study groups ---------- */
export function useLeaderboard(scope: 'all' | 'group', weekOffset = 0, groupId: string | null = null, enabled = true) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['leaderboard', scope, weekOffset, groupId, session?.user.id],
    enabled: Boolean(session) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('weekly_leaderboard', { p_scope: scope, p_week_offset: weekOffset, p_group_id: groupId })
      if (error) throw new Error(error.message)
      return data as Leaderboard
    },
  })
}

export function useMyGroup() {
  const { profile } = useAuth()
  const groupId = profile?.group_id ?? null
  return useQuery({
    queryKey: ['my-group', groupId],
    enabled: Boolean(groupId),
    queryFn: async () => unwrap(await supabase.from('study_groups').select('id, name').eq('id', groupId!).maybeSingle()) as Pick<StudyGroup, 'id' | 'name'> | null,
  })
}

function invalidateGroupQueries(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['profile', 'my-group', 'leaderboard', 'groups', 'group-members']) qc.invalidateQueries({ queryKey: [key] })
}

export function useJoinGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_group', { p_code: code })
      if (error) throw new Error(error.message === 'Group not found' ? 'Группа с таким кодом не найдена' : error.message)
      return data as { id: string; name: string }
    },
    onSuccess: () => invalidateGroupQueries(qc),
  })
}

export function useLeaveGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('leave_group')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidateGroupQueries(qc),
  })
}

/* admin */
export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const [groups, members] = await Promise.all([
        supabase.from('study_groups').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('group_id').not('group_id', 'is', null),
      ])
      const counts: Record<string, number> = {}
      for (const m of unwrap(members) as { group_id: string }[]) counts[m.group_id] = (counts[m.group_id] ?? 0) + 1
      return (unwrap(groups) as StudyGroup[]).map((g) => ({ ...g, members: counts[g.id] ?? 0 }))
    },
  })
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['group-members', groupId],
    enabled: Boolean(groupId),
    queryFn: async () =>
      unwrap(await supabase.from('profiles').select('id, email, full_name').eq('group_id', groupId!).order('full_name')) as Pick<Profile, 'id' | 'email' | 'full_name'>[],
  })
}

export function useSaveGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id?: string; name: string }) => {
      if (id) unwrap(await supabase.from('study_groups').update({ name }).eq('id', id).select())
      else unwrap(await supabase.from('study_groups').insert({ name }).select())
    },
    onSuccess: () => invalidateGroupQueries(qc),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('study_groups').delete().eq('id', id).select())
    },
    onSuccess: () => invalidateGroupQueries(qc),
  })
}

export function useSetStudentGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, groupId }: { email: string; groupId: string | null }) => {
      const { error } = await supabase.rpc('admin_set_student_group', { p_email: email, p_group_id: groupId })
      if (error) throw new Error(error.message === 'No student with this e-mail' ? 'Ученик с такой почтой не найден' : error.message)
    },
    onSuccess: () => invalidateGroupQueries(qc),
  })
}

/* admin: extra (demo) participants of the leaderboard */
export function useLeaderboardExtras() {
  return useQuery({
    queryKey: ['leaderboard-extras'],
    queryFn: async () => unwrap(await supabase.from('leaderboard_extras').select('*').order('points', { ascending: false })) as LeaderboardExtra[],
  })
}

export function useSaveLeaderboardExtra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...row }: Partial<LeaderboardExtra> & { name?: string }) => {
      if (id) unwrap(await supabase.from('leaderboard_extras').update(row).eq('id', id).select())
      else unwrap(await supabase.from('leaderboard_extras').insert(row).select())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaderboard-extras'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}

export function useDeleteLeaderboardExtra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('leaderboard_extras').delete().eq('id', id).select())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaderboard-extras'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}

/* ---------- Admin statistics ---------- */
/** The API returns at most 1000 rows per request; read every page so that totals are never cut short. */
async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const res = await page(from, from + size - 1)
    if (res.error) throw new Error(res.error.message)
    const rows = (res.data ?? []) as T[]
    out.push(...rows)
    if (rows.length < size) return out
  }
}

/** Every payment request (amount, plan, status, date) for the revenue numbers; admins only (RLS). */
export function useRevenueRows() {
  return useQuery({
    queryKey: ['admin-stats', 'payments'],
    queryFn: () =>
      fetchAllRows<PaymentRow>((from, to) =>
        supabase.from('payment_requests').select('amount_usd, plan, status, created_at').order('created_at').order('id').range(from, to),
      ),
  })
}

export interface VisitStats {
  today: number
  today_unique: number
  week: number
  week_unique: number
  month: number
  month_unique: number
  total: number
  total_unique: number
  /** the first day that has a recorded visit ('YYYY-MM-DD'), null while there are none */
  first_day: string | null
  daily: { day: string; visits: number; visitors: number }[]
}

/** Visit counter totals. Fails until the site_visits migration has been run in the database. */
export function useVisitStats(days = 30) {
  return useQuery({
    queryKey: ['admin-stats', 'visits', days],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('visit_stats', { p_days: days })
      if (error) throw new Error(error.message)
      return data as VisitStats
    },
  })
}

export interface StudentCounts {
  total: number
  /** registered in the last 7 / 30 days */
  week: number
  month: number
  /** students whose subscription has not expired */
  subscribed: number
}

export function useStudentCounts() {
  return useQuery({
    queryKey: ['admin-stats', 'students'],
    queryFn: async (): Promise<StudentCounts> => {
      const now = Date.now()
      const since = (days: number) => new Date(now - days * 86_400_000).toISOString()
      const students = () => supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student')
      const [total, week, month, subs] = await Promise.all([
        students(),
        students().gte('created_at', since(7)),
        students().gte('created_at', since(30)),
        fetchAllRows<{ user_id: string }>((from, to) =>
          supabase.from('subscriptions').select('user_id').gt('expires_at', new Date(now).toISOString()).order('id').range(from, to),
        ),
      ])
      for (const r of [total, week, month]) if (r.error) throw new Error(r.error.message)
      return {
        total: total.count ?? 0,
        week: week.count ?? 0,
        month: month.count ?? 0,
        subscribed: new Set(subs.map((x) => x.user_id)).size,
      }
    },
  })
}
