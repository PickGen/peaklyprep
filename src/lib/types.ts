export type Role = 'student' | 'admin'
export type Section = 'Reading & Writing' | 'Math'
export const SECTIONS: Section[] = ['Reading & Writing', 'Math']
export type LessonKind = 'lesson' | 'word_list'

/** Before the word-lists migration runs there is no `kind` column, so "SAT Words …" titles mark word lists. */
export function lessonKind(l: { kind?: LessonKind | null; title: string }): LessonKind {
  return l.kind ?? (/sat\s*words?/i.test(l.title) ? 'word_list' : 'lesson')
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
  target_score: number
  exam_date: string | null
  study_minutes: number
  email_updates: boolean
}

export const lessonPath = (l: { id: string; kind?: LessonKind | null; title: string }) =>
  `${lessonKind(l) === 'word_list' ? '/app/words' : '/app/learn'}/${l.id}`

export interface Lesson {
  id: string
  title: string
  section: Section
  /** 'word_list' items live under Word Lists, not Lessons. Missing until the word-lists migration runs. */
  kind?: LessonKind
  summary: string
  content: string
  video_url: string | null
  duration_min: number
  position: number
  published: boolean
  /** open without a subscription (free tier) */
  is_free?: boolean
  created_at: string
}

export interface Test {
  id: string
  title: string
  section: Section
  description: string
  duration_min: number
  position: number
  published: boolean
  created_at: string
  form_title: string | null
  module_no: number | null
  /** open without a subscription (free tier) */
  is_free?: boolean
}

export interface Question {
  id: string
  test_id: string
  passage: string | null
  prompt: string
  options: string[]
  position: number
  question_keys?: { correct_index: number | null; correct_answers: string[] | null; explanation: string | null } | null
}

export interface Attempt {
  id: string
  user_id: string
  test_id: string
  score: number
  total: number
  answers: Record<string, number | string>
  created_at: string
  tests?: { title: string; section: Section; form_title?: string | null; module_no?: number | null } | null
}

/** One question in the mistake bank (see get_mistake_bank in the migrations) */
export interface MistakeItem {
  question_id: string
  test_id: string
  test_title: string
  section: Section
  position: number
  passage: string | null
  prompt: string
  options: string[]
  attempt_id: string
  attempted_at: string
  chosen: number | string | null
  correct_index: number | null
  correct_answers: string[] | null
  explanation: string | null
}

export interface LessonProgress {
  id: string
  user_id: string
  lesson_id: string
  completed_at: string
}

export interface AttemptResult {
  attempt_id: string
  score: number
  total: number
  review: { question_id: string; chosen: number | string | null; correct: boolean; correct_index: number | null; correct_answers: string[] | null; explanation: string | null }[]
}

export interface NewsItem {
  id: string
  title: string
  body: string
  published: boolean
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan: '1m' | '3m' | '6m' | '12m'
  starts_at: string
  expires_at: string
  source: string
}
