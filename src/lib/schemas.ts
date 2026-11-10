import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(60),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export const nameSchema = z.string().trim().min(2, 'Enter your name').max(60)
export const targetScoreSchema = z.coerce.number().int().min(400).max(1600).multipleOf(10)
export const studyMinutesSchema = z.coerce.number().int().min(15).max(600)
export const examDateSchema = z
  .string()
  .trim()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), 'Enter a valid date')

const section = z.enum(['Reading & Writing', 'Math'])

export const lessonSchema = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(120),
  section,
  summary: z.string().trim().min(3, 'Add a short summary').max(240),
  content: z.string().trim().min(10, 'Add lesson content'),
  video_url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https?:\/\//.test(v), 'Must start with http(s)://'),
  duration_min: z.coerce.number().int().min(1, 'Min 1').max(240),
  position: z.coerce.number().int().min(0).max(9999),
  published: z.boolean(),
})

export const testSchema = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(120),
  section,
  description: z.string().trim().min(3, 'Add a short description').max(240),
  form_title: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : null)),
  module_no: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 9), 'Module number 1-9'),
  duration_min: z.coerce.number().int().min(1).max(300),
  position: z.coerce.number().int().min(0).max(9999),
  published: z.boolean(),
})

export const newsSchema = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(120),
  body: z.string().trim().min(3, 'Write a short text').max(1000),
  published: z.boolean(),
})

const optionList = z.array(z.string().trim().min(1, 'Option cannot be empty')).max(6)
const answerList = z.array(z.string().trim().min(1)).max(8)

/** Multiple choice: 2-6 options + correct_index. Student-produced response: options = [] + correct_answers (accepted answers). */
function checkQuestion(q: { prompt: string; passage?: string | null; options: string[]; correct_index?: number | null; correct_answers?: string[] }, ctx: z.RefinementCtx) {
  if (!q.prompt && !q.passage) ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'Enter the question' })
  if (q.options.length === 0) {
    if (!q.correct_answers || q.correct_answers.length === 0) ctx.addIssue({ code: 'custom', path: ['correct_answers'], message: 'Enter at least one accepted answer' })
  } else {
    if (q.options.length < 2) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least 2 options' })
    if (q.correct_index === undefined || q.correct_index === null || q.correct_index < 0 || q.correct_index >= q.options.length) ctx.addIssue({ code: 'custom', path: ['correct_index'], message: 'Pick one of the options as correct' })
  }
}

export const questionSchema = z
  .object({
    passage: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    prompt: z.string().trim().default(''),
    options: optionList,
    correct_index: z.coerce.number().int(),
    correct_answers: answerList.default([]),
    explanation: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .superRefine(checkQuestion)

/** Bulk import format: an array of questions */
export const questionImportSchema = z.array(
  z
    .object({
      passage: z.string().optional().nullable(),
      prompt: z.string().trim().default(''),
      options: optionList.default([]),
      correct_index: z.number().int().optional().nullable(),
      correct_answers: answerList.optional(),
      explanation: z.string().optional().nullable(),
    })
    .superRefine(checkQuestion),
)
export type FieldErrors = Record<string, string>

export function fieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
