export type Role = 'student' | 'admin'
export type Section = 'Reading & Writing' | 'Math'
export const SECTIONS: Section[] = ['Reading & Writing', 'Math']

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

export interface Lesson {
  id: string
  title: string
  section: Section
  summary: string
  content: string
  video_url: string | null
  duration_min: number
  position: number
  published: boolean
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
  tests?: { title: string; section: Section } | null
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
