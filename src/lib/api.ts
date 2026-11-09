import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Attempt, AttemptResult, Lesson, LessonProgress, NewsItem, Profile, Question, Subscription, Test } from './types'

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
      const { id, ...rest } = input
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
      const rows = unwrap(await supabase.from('questions').select('test_id')) as { test_id: string }[]
      const out: Record<string, number> = {}
      for (const r of rows) out[r.test_id] = (out[r.test_id] ?? 0) + 1
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
      const { id, ...rest } = input
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

async function saveQuestion(q: QuestionInput) {
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
          .select('*, tests(title, section)')
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attempts'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attempts'] }),
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
    mutationFn: async (patch: Partial<Pick<Profile, 'full_name' | 'target_score' | 'exam_date' | 'study_minutes' | 'email_updates'>>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', session!.user.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
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
      const { id, ...rest } = input
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
