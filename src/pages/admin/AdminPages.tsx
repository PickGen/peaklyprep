import { Fragment, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  findGarbledText,
  useDeleteGroup,
  useDeleteLeaderboardExtra,
  useLeaderboardExtras,
  useSaveLeaderboardExtra,
  useGroupMembers,
  useGroups,
  useLeaderboard,
  useSaveGroup,
  useSetStudentGroup,
  useFixGarbledText,
  type GarbledItem,
  useDeleteLesson,
  useDeleteNews,
  useDeleteQuestion,
  useGrantPlan,
  useRevokePlan,
  useDeleteTest,
  useDeleteTests,
  useImportQuestions,
  useLessons,
  useNews,
  useQuestionCounts,
  useQuestions,
  useSaveLesson,
  useSaveNews,
  useSaveQuestion,
  useSaveTest,
  useStudents,
  useTest,
  useTests,
  useAllPaymentRequests,
  useUpdatePaymentRequest,
  useAppSetting,
  useUpdateAppSetting,
} from '../../lib/api'
import { hasGarbled } from '../../lib/textFix'
import { fieldErrors, lessonSchema, newsSchema, questionImportSchema, questionSchema, testSchema, type FieldErrors } from '../../lib/schemas'
import { SECTIONS, lessonKind, type LeaderboardExtra, type Lesson, type LessonKind, type NewsItem, type Question, type Test } from '../../lib/types'
import { ArrowLeft, EditIcon, PlusIcon, TrashIcon } from '../../components/Icons'
import { Spinner } from '../../components/Layouts'
import { SectionBadge } from '../LearnPractice'
import { PLANS } from '../../components/Pricing'

function Err({ errors, name }: { errors: FieldErrors; name: string }) {
  return errors[name] ? <p className="err">{errors[name]}</p> : null
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <section className="glass mb-6 rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <button className="text-sm font-semibold text-muted" onClick={onClose}>
          Cancel
        </button>
      </div>
      {children}
    </section>
  )
}

function SectionSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="section" className="field" defaultValue={defaultValue ?? 'Math'}>
      {SECTIONS.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  )
}

function confirmDelete(what: string) {
  return window.confirm(`Delete ${what}? This cannot be undone.`)
}

/* =============== Lessons =============== */
export function AdminLessons() {
  const videoUrlRef = useRef<HTMLInputElement>(null)
  const lessons = useLessons()
  const save = useSaveLesson()
  const del = useDeleteLesson()
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [kindFilter, setKindFilter] = useState<LessonKind | 'all'>('all')
  const shown = (lessons.data ?? []).filter((l) => kindFilter === 'all' || lessonKind(l) === kindFilter)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const raw = { ...Object.fromEntries(fd), published: fd.get('published') === 'on', is_free: fd.get('is_free') === 'on' }
    const parsed = lessonSchema.safeParse(raw)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    await save.mutateAsync({ ...parsed.data, id: editing !== 'new' ? editing?.id : undefined })
    setEditing(null)
  }

  const cur = editing && editing !== 'new' ? editing : undefined

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Lessons</h1>
        <button className="btn btn-primary !min-h-10 !px-4 !py-2 text-sm" onClick={() => { setErrors({}); setEditing('new') }}>
          <PlusIcon className="h-4 w-4" /> New lesson
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {([['all', 'All'], ['lesson', 'Lessons'], ['word_list', 'Word lists']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${kindFilter === k ? 'bg-brand-600 text-white' : 'glass !shadow-none text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {editing && (
        <Panel title={cur ? 'Edit lesson' : 'New lesson'} onClose={() => setEditing(null)}>
          <form key={cur?.id ?? 'new'} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2" noValidate>
            <div className="md:col-span-2">
              <label className="label">Title</label>
              <input name="title" className="field" defaultValue={cur?.title} aria-invalid={!!errors.title} />
              <Err errors={errors} name="title" />
            </div>
            <div>
              <label className="label">Section</label>
              <SectionSelect defaultValue={cur?.section} />
            </div>
            <div>
              <label className="label">Type</label>
              <select name="kind" className="field" defaultValue={cur ? lessonKind(cur) : kindFilter === 'word_list' ? 'word_list' : 'lesson'}>
                <option value="lesson">Lesson</option>
                <option value="word_list">Word list (shown under Word Lists)</option>
              </select>
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input name="duration_min" type="number" className="field" defaultValue={cur?.duration_min ?? 10} />
              <Err errors={errors} name="duration_min" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Short summary</label>
              <input name="summary" className="field" defaultValue={cur?.summary} aria-invalid={!!errors.summary} />
              <Err errors={errors} name="summary" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Content (use "## Heading", "- bullet", blank line between paragraphs)</label>
              <textarea name="content" rows={8} className="field" defaultValue={cur?.content} aria-invalid={!!errors.content} />
              <Err errors={errors} name="content" />
            </div>
            <div>
              <label className="label">Video URL (optional, YouTube works inline)</label>
              <input ref={videoUrlRef} name="video_url" className="field" defaultValue={cur?.video_url ?? ''} placeholder="https:// (YouTube link or upload a file below)" />
              <Err errors={errors} name="video_url" />
              <VideoUpload onUploaded={(url) => { if (videoUrlRef.current) videoUrlRef.current.value = url }} />
            </div>
            <div>
              <label className="label">Order</label>
              <input name="position" type="number" className="field" defaultValue={cur?.position ?? (lessons.data?.length ?? 0) + 1} />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="published" defaultChecked={cur?.published ?? true} className="h-5 w-5 accent-[#5b1fd6]" /> Published
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="is_free" defaultChecked={cur?.is_free ?? false} className="h-5 w-5 accent-[#5b1fd6]" /> Free (open without a subscription)
            </label>
            <div className="md:col-span-2">
              {save.error && <p className="err mb-2">{(save.error as Error).message}</p>}
              <button className="btn btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save lesson'}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {lessons.isLoading ? (
        <Spinner />
      ) : (
        <ul className="space-y-3">
          {shown.map((l) => (
            <li key={l.id} className="glass flex items-center gap-3 rounded-2xl p-4">
              <span className="w-6 text-center text-sm font-bold text-muted">{l.position}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SectionBadge section={l.section} />
                  {lessonKind(l) === 'word_list' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Word list</span>}
                  {!l.published && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Draft</span>}
                  {l.is_free && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">Free</span>}
                </div>
                <p className="mt-1 truncate font-bold">{l.title}</p>
              </div>
              <button className="btn btn-ghost !min-h-10 !px-3" aria-label="Edit" onClick={() => { setErrors({}); setEditing(l) }}>
                <EditIcon className="h-5 w-5" />
              </button>
              <button className="btn btn-danger !min-h-10 !px-3" aria-label="Delete" onClick={() => confirmDelete(`"${l.title}"`) && del.mutate(l.id)}>
                <TrashIcon className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* =============== Lesson video upload =============== */
/** Uploads a video file to the public "lesson-videos" bucket and hands back its URL for the Video URL field. */
function VideoUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  async function upload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setState('error')
      setMsg('Choose a video file (mp4, webm, mov).')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setState('error')
      setMsg('The file is over 50 MB. Compress it or upload it to YouTube (unlisted) and paste the link.')
      return
    }
    setState('uploading')
    setMsg(`Uploading ${file.name}…`)
    const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '')
    const path = `${Date.now()}-${safe}`
    const { error } = await supabase.storage.from('lesson-videos').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    if (error) {
      setState('error')
      setMsg(error.message)
      return
    }
    onUploaded(supabase.storage.from('lesson-videos').getPublicUrl(path).data.publicUrl)
    setState('done')
    setMsg(`Uploaded ${file.name}. Save the lesson to keep it.`)
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <label className={`btn btn-ghost !min-h-9 !px-3 !py-1.5 text-sm ${state === 'uploading' ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
        🎬 Upload video file
        <input type="file" accept="video/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {msg && <span className={state === 'error' ? 'text-red-700' : state === 'done' ? 'text-green-700' : 'text-muted'}>{msg}</span>}
    </div>
  )
}

/* =============== Garbled text check =============== */
/** Finds questions / lessons / news whose symbols were broken by a wrong encoding ("x¬≤" instead of "x²") and repairs them. */
function GarbledTextCheck() {
  const fix = useFixGarbledText()
  const [found, setFound] = useState<GarbledItem[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [fixedCount, setFixedCount] = useState<number | null>(null)

  async function scan() {
    setError('')
    setFixedCount(null)
    setScanning(true)
    try {
      setFound(await findGarbledText())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  async function repair() {
    if (!found) return
    try {
      await fix.mutateAsync(found)
      setFixedCount(found.length)
      setFound(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="glass mb-6 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">Broken symbols check</h2>
          <p className="text-sm text-muted">Finds text like <code>x¬≤</code> or <code>вИТ</code> (wrong encoding) in questions, lessons and news and turns it back into <code>x²</code>, <code>−</code>.</p>
        </div>
        <button className="btn btn-ghost !min-h-10 !px-4 !py-2 text-sm" onClick={scan} disabled={scanning || fix.isPending}>
          {scanning ? 'Checking…' : 'Check now'}
        </button>
      </div>
      {error && <p className="err mt-3">{error}</p>}
      {fixedCount !== null && <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">Fixed {fixedCount} item{fixedCount === 1 ? '' : 's'}.</p>}
      {found && found.length === 0 && <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">All good: no broken symbols found.</p>}
      {found && found.length > 0 && (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-semibold text-amber-800">Found {found.length} item{found.length === 1 ? '' : 's'} with broken symbols:</p>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {found.map((it) => (
              <li key={it.table + it.id} className="rounded-xl bg-white/70 p-3 text-sm">
                <p className="text-xs font-bold text-muted">{it.where}</p>
                <p className="line-clamp-2 text-red-700 line-through decoration-red-300">{it.before}</p>
                <p className="line-clamp-2 font-semibold text-green-800">{it.after}</p>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary !min-h-10 !px-4 !py-2 text-sm" onClick={repair} disabled={fix.isPending}>
            {fix.isPending ? 'Fixing…' : `Fix all ${found.length}`}
          </button>
        </div>
      )}
    </section>
  )
}

/* =============== Tests =============== */
export function AdminTests() {
  const tests = useTests()
  const counts = useQuestionCounts()
  const save = useSaveTest()
  const del = useDeleteTest()
  const delMany = useDeleteTests()
  const [editing, setEditing] = useState<Test | 'new' | null>(null)
  // modules of one practice test (same form_title) are shown together
  const groups = (() => {
    const out: { key: string; form: string | null; tests: Test[] }[] = []
    for (const t of tests.data ?? []) {
      const form = t.form_title?.trim() || null
      const g = form ? out.find((x) => x.form === form) : undefined
      if (g) g.tests.push(t)
      else out.push({ key: form ?? t.id, form, tests: [t] })
    }
    return out
  })()
  const [errors, setErrors] = useState<FieldErrors>({})

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = testSchema.safeParse({ ...Object.fromEntries(fd), published: fd.get('published') === 'on', is_free: fd.get('is_free') === 'on' })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    await save.mutateAsync({ ...parsed.data, id: editing !== 'new' ? editing?.id : undefined })
    setEditing(null)
  }
  const cur = editing && editing !== 'new' ? editing : undefined

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Tests &amp; Questions</h1>
        <button className="btn btn-primary !min-h-10 !px-4 !py-2 text-sm" onClick={() => { setErrors({}); setEditing('new') }}>
          <PlusIcon className="h-4 w-4" /> New test
        </button>
      </div>

      <GarbledTextCheck />

      {editing && (
        <Panel title={cur ? 'Edit test' : 'New test'} onClose={() => setEditing(null)}>
          <form key={cur?.id ?? 'new'} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2" noValidate>
            <div className="md:col-span-2">
              <label className="label">Title</label>
              <input name="title" className="field" defaultValue={cur?.title} aria-invalid={!!errors.title} />
              <Err errors={errors} name="title" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <input name="description" className="field" defaultValue={cur?.description} aria-invalid={!!errors.description} />
              <Err errors={errors} name="description" />
            </div>
            <div>
              <label className="label">Section</label>
              <SectionSelect defaultValue={cur?.section} />
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input name="duration_min" type="number" className="field" defaultValue={cur?.duration_min ?? 15} />
            </div>
            <div>
              <label className="label">Order</label>
              <input name="position" type="number" className="field" defaultValue={cur?.position ?? (tests.data?.length ?? 0) + 1} />
            </div>
            <div>
              <label className="label">Practice test name (modules with the same name are grouped)</label>
              <input name="form_title" className="field" defaultValue={cur?.form_title ?? ''} placeholder="e.g. SAT Practice Test 2" />
              <Err errors={errors} name="form_title" />
            </div>
            <div>
              <label className="label">Module number (for grouped tests)</label>
              <input name="module_no" type="number" min={1} max={9} className="field" defaultValue={cur?.module_no ?? ''} />
              <Err errors={errors} name="module_no" />
            </div>
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold">
              <input type="checkbox" name="published" defaultChecked={cur?.published ?? true} className="h-5 w-5 accent-[#5b1fd6]" /> Published
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="is_free" defaultChecked={cur?.is_free ?? false} className="h-5 w-5 accent-[#5b1fd6]" /> Free (open without a subscription)
            </label>
            <div className="md:col-span-2">
              {save.error && <p className="err mb-2">{(save.error as Error).message}</p>}
              <button className="btn btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save test'}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {tests.isLoading ? (
        <Spinner />
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <Fragment key={g.key}>
              {g.form && (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-100/70 px-4 py-2.5">
                  <p className="min-w-0 truncate text-sm font-extrabold text-brand-800">
                    {g.form} <span className="font-semibold text-muted">· {g.tests.length} modules</span>
                  </p>
                  <button
                    className="btn btn-danger !min-h-9 !px-3 !py-1.5 text-xs"
                    onClick={() => confirmDelete(`the whole practice test "${g.form}" (${g.tests.length} modules, all questions and student attempts)`) && delMany.mutate(g.tests.map((t) => t.id))}
                  >
                    <TrashIcon className="h-4 w-4" /> Delete all modules
                  </button>
                </li>
              )}
              {g.tests.map((t) => (
            <li key={t.id} className={`glass flex flex-wrap items-center gap-3 rounded-2xl p-4 ${g.form ? 'ml-3 sm:ml-6' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SectionBadge section={t.section} />
                  {!t.published && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Draft</span>}
                  {t.is_free && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">Free</span>}
                  <span className="text-xs text-muted">{counts.data?.[t.id] ?? 0} questions</span>
                </div>
                <p className="mt-1 truncate font-bold">{t.title}</p>
              </div>
              <Link to={`/admin/tests/${t.id}`} className="btn btn-primary !min-h-10 !px-4 !py-2 text-sm">
                Questions
              </Link>
              <button className="btn btn-ghost !min-h-10 !px-3" aria-label="Edit" onClick={() => { setErrors({}); setEditing(t) }}>
                <EditIcon className="h-5 w-5" />
              </button>
              <button className="btn btn-danger !min-h-10 !px-3" aria-label="Delete" onClick={() => confirmDelete(`"${t.title}" and all its questions`) && del.mutate(t.id)}>
                <TrashIcon className="h-5 w-5" />
              </button>
            </li>
              ))}
            </Fragment>
          ))}
          {delMany.error && <p className="err">{(delMany.error as Error).message}</p>}
        </ul>
      )}
    </div>
  )
}

/* =============== Questions of one test =============== */
const importExample = `[
  {
    "passage": "Optional text shown on the left of the question (leave out for none).",
    "prompt": "If 3x + 5 = 20, what is x?",
    "options": ["3", "4", "5", "6"],
    "correct_index": 2,
    "explanation": "3x = 15, so x = 5."
  },
  {
    "passage": "The ratio of green tiles to blue tiles is 5 to 2. If there are 16 blue tiles, how many green tiles are there? (Formulas go between dollar signs, e.g. $x^2 + \\frac{1}{2}$.)",
    "prompt": "",
    "options": [],
    "correct_answers": ["40"]
  }
]`

export function AdminQuestions() {
  const { id } = useParams()
  const test = useTest(id)
  const questions = useQuestions(id, true)
  const save = useSaveQuestion()
  const del = useDeleteQuestion()
  const imp = useImportQuestions()
  const [editing, setEditing] = useState<Question | 'new' | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [optCount, setOptCount] = useState(4)
  const [spr, setSpr] = useState(false) // student-produced response (typed answer) instead of A-D options

  const cur = editing && editing !== 'new' ? editing : undefined
  const nextPos = (questions.data?.length ?? 0) + 1

  function open(q: Question | 'new') {
    setErrors({})
    setOptCount(q === 'new' ? 4 : q.options.length || 4)
    setSpr(q !== 'new' && q.options.length === 0)
    setEditing(q)
    setImporting(false)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const options = spr ? [] : Array.from({ length: optCount }, (_, i) => String(fd.get(`opt${i}`) ?? ''))
    const correct_answers = spr ? String(fd.get('answers') ?? '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : []
    const parsed = questionSchema.safeParse({ passage: fd.get('passage'), prompt: fd.get('prompt'), options, correct_index: spr ? -1 : (fd.get('correct_index') ?? -1), correct_answers, explanation: fd.get('explanation') })
    if (!parsed.success) {
      const fe = fieldErrors(parsed.error)
      return setErrors(fe)
    }
    setErrors({})
    await save.mutateAsync({ ...parsed.data, id: cur?.id, test_id: id!, position: cur?.position ?? nextPos })
    setEditing(null)
  }

  async function onImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setImportError('')
    try {
      const json = JSON.parse(String(new FormData(e.currentTarget).get('json')))
      const parsed = questionImportSchema.safeParse(json)
      if (!parsed.success) {
        const i = parsed.error.issues[0]
        return setImportError(`Invalid item ${typeof i.path[0] === 'number' ? i.path[0] + 1 : ''}: ${i.message}`)
      }
      await imp.mutateAsync({ testId: id!, startAt: nextPos, items: parsed.data.map((q) => ({ passage: q.passage ?? null, prompt: q.prompt, options: q.options, correct_index: q.correct_index ?? null, correct_answers: q.correct_answers ?? null, explanation: q.explanation ?? null })) })
      setImporting(false)
    } catch (err) {
      setImportError(err instanceof SyntaxError ? 'That is not valid JSON.' : (err as Error).message)
    }
  }

  return (
    <div>
      <Link to="/admin/tests" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
        <ArrowLeft className="h-4 w-4" /> All tests
      </Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{test.data?.title ?? 'Questions'}</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost !min-h-10 !px-4 !py-2 text-sm" onClick={() => { setImporting(true); setEditing(null) }}>
            Import JSON
          </button>
          <button className="btn btn-primary !min-h-10 !px-4 !py-2 text-sm" onClick={() => open('new')}>
            <PlusIcon className="h-4 w-4" /> Add question
          </button>
        </div>
      </div>

      {importing && (
        <Panel title="Bulk import questions" onClose={() => setImporting(false)}>
          <form onSubmit={onImport} className="space-y-3">
            <p className="text-sm text-muted">Paste a JSON array. <code>correct_index</code> is zero-based (0 = first option). For a typed answer (grid-in) use <code>"options": []</code> and <code>"correct_answers": ["40", "2/5"]</code>.</p>
            <textarea name="json" rows={10} className="field font-mono text-sm" defaultValue={importExample} />
            {importError && <p className="err">{importError}</p>}
            <button className="btn btn-primary" disabled={imp.isPending}>
              {imp.isPending ? 'Importing…' : 'Import questions'}
            </button>
          </form>
        </Panel>
      )}

      {editing && (
        <Panel title={cur ? 'Edit question' : 'New question'} onClose={() => setEditing(null)}>
          <form key={cur?.id ?? 'new'} onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label className="label">Passage (optional, shown beside the question)</label>
              <textarea name="passage" rows={4} className="field" defaultValue={cur?.passage ?? ''} />
            </div>
            <div>
              <label className="label">Question (can stay empty when the whole question is in the passage box)</label>
              <textarea name="prompt" rows={3} className="field" defaultValue={cur?.prompt} aria-invalid={!!errors.prompt} />
              <Err errors={errors} name="prompt" />
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label="Answer type">
              {([false, true] as const).map((v) => (
                <button key={String(v)} type="button" role="radio" aria-checked={spr === v} onClick={() => setSpr(v)} className={`rounded-full px-4 py-2 text-sm font-bold ${spr === v ? 'bg-brand-600 text-white' : 'bg-white text-muted ring-1 ring-brand-100'}`}>
                  {v ? 'Typed answer (grid-in)' : 'Multiple choice'}
                </button>
              ))}
            </div>
            {spr && (
              <div>
                <label className="label">Accepted answers (separate several with commas; fractions and decimals count as equal)</label>
                <input name="answers" className="field" placeholder="e.g. 40   or   2, 24" defaultValue={cur?.question_keys?.correct_answers?.join(', ') ?? ''} aria-invalid={!!errors.correct_answers} />
                <Err errors={errors} name="correct_answers" />
              </div>
            )}
            <fieldset className={`space-y-2 ${spr ? 'hidden' : ''}`}>
              <legend className="label">Answer options — select the correct one</legend>
              {Array.from({ length: optCount }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input type="radio" name="correct_index" value={i} defaultChecked={cur ? cur.question_keys?.correct_index === i : i === 0} className="h-5 w-5 accent-[#5b1fd6]" aria-label={`Option ${i + 1} is correct`} />
                  <input name={`opt${i}`} className="field" placeholder={`Option ${String.fromCharCode(65 + i)}`} defaultValue={cur?.options[i]} />
                </div>
              ))}
              {errors.options && <p className="err">{errors.options}</p>}
              <Err errors={errors} name="correct_index" />
              <div className="flex gap-3 text-sm font-semibold text-brand-600">
                {optCount < 6 && <button type="button" onClick={() => setOptCount((n) => n + 1)}>+ Add option</button>}
                {optCount > 2 && <button type="button" onClick={() => setOptCount((n) => n - 1)}>− Remove last</button>}
              </div>
            </fieldset>
            <div>
              <label className="label">Explanation (shown after the test)</label>
              <textarea name="explanation" rows={2} className="field" defaultValue={cur?.question_keys?.explanation ?? ''} />
            </div>
            {save.error && <p className="err">{(save.error as Error).message}</p>}
            <button className="btn btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save question'}
            </button>
          </form>
        </Panel>
      )}

      {questions.isLoading ? (
        <Spinner />
      ) : questions.data?.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-muted">No questions yet. Add one or import a JSON file.</p>
      ) : (
        <ol className="space-y-3">
          {questions.data?.map((q, n) => (
            <li key={q.id} className="glass rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{n + 1}</span>
                <div className="min-w-0 flex-1">
                  {[q.prompt, q.passage, q.question_keys?.explanation, ...q.options].some(hasGarbled) && (
                    <p className="mb-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Broken symbols: open and save to fix</p>
                  )}
                  <p className="font-semibold whitespace-pre-line">{q.prompt || q.passage}</p>
                  {q.options.length === 0 && <p className="mt-2 inline-block rounded-lg bg-green-50 px-2.5 py-1.5 text-sm font-semibold text-green-800">Answer: {q.question_keys?.correct_answers?.join(' or ')}</p>}
                  <ul className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {q.options.map((o, i) => (
                      <li key={i} className={`rounded-lg px-2.5 py-1.5 ${q.question_keys?.correct_index === i ? 'bg-green-50 font-semibold text-green-800' : 'text-muted'}`}>
                        {String.fromCharCode(65 + i)}. {o}
                      </li>
                    ))}
                  </ul>
                </div>
                <button className="btn btn-ghost !min-h-10 !px-3" aria-label="Edit" onClick={() => open(q)}>
                  <EditIcon className="h-5 w-5" />
                </button>
                <button className="btn btn-danger !min-h-10 !px-3" aria-label="Delete" onClick={() => confirmDelete('this question') && del.mutate(q.id)}>
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/* =============== Students =============== */
const planShort: Record<string, string> = { '1m': '1 month', '3m': '3 months', '6m': '6 months', '12m': '12 months' }

export function AdminStudents() {
  const students = useStudents()
  const grant = useGrantPlan()
  const revoke = useRevokePlan()
  const [pick, setPick] = useState<Record<string, string>>({})
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold">Students</h1>
      {students.isLoading ? (
        <Spinner />
      ) : students.data?.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-muted">No students have registered yet.</p>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Tests taken</th>
                <th className="px-4 py-3">Average score</th>
                <th className="px-4 py-3">Lessons done</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {students.data?.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{s.full_name || '—'}</p>
                    <p className="text-xs text-muted">{s.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {s.planActive && s.plan && s.planUntil ? (
                      <p className="mb-2 text-xs font-bold text-brand-700">
                        {planShort[s.plan]} · until {fmt(s.planUntil)}
                      </p>
                    ) : (
                      <p className="mb-2 text-xs text-muted">{s.planUntil ? `expired ${fmt(s.planUntil)}` : 'no plan'}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <select className="field !min-h-9 !w-auto !py-1 text-xs" value={pick[s.id] ?? '3m'} onChange={(e) => setPick((p) => ({ ...p, [s.id]: e.target.value }))} aria-label="Plan to grant">
                        {PLANS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {planShort[p.id]}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-primary !min-h-9 !px-3 !py-1 text-xs" disabled={grant.isPending} onClick={() => grant.mutate({ userId: s.id, plan: (pick[s.id] ?? '3m') as never, currentUntil: s.planActive ? s.planUntil : null })}>
                        Grant
                      </button>
                      {s.planActive && (
                        <button className="btn btn-danger !min-h-9 !px-3 !py-1 text-xs" disabled={revoke.isPending} onClick={() => window.confirm('End this plan now?') && revoke.mutate(s.id)}>
                          End
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{s.attempts}</td>
                  <td className="px-4 py-3">{s.avgPercent === null ? '—' : <span className="rounded-full bg-brand-100 px-2.5 py-1 font-bold text-brand-700">{s.avgPercent}%</span>}</td>
                  <td className="px-4 py-3">{s.lessonsDone}</td>
                  <td className="px-4 py-3 text-muted">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(grant.error || revoke.error) && <p className="err px-4 pb-3">{((grant.error || revoke.error) as Error).message}</p>}
        </div>
      )}
    </div>
  )
}

/* =============== News =============== */
export function AdminNews() {
  const news = useNews()
  const save = useSaveNews()
  const del = useDeleteNews()
  const [editing, setEditing] = useState<NewsItem | 'new' | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const cur = editing && editing !== 'new' ? editing : undefined

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const parsed = newsSchema.safeParse({ ...Object.fromEntries(fd), published: fd.get('published') === 'on' })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    await save.mutateAsync({ ...parsed.data, id: cur?.id })
    setEditing(null)
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">News</h1>
        <button className="btn btn-primary !min-h-10 !px-4 !py-2 text-sm" onClick={() => { setErrors({}); setEditing('new') }}>
          <PlusIcon className="h-4 w-4" /> New post
        </button>
      </div>

      {editing && (
        <Panel title={cur ? 'Edit post' : 'New post'} onClose={() => setEditing(null)}>
          <form key={cur?.id ?? 'new'} onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label className="label">Title</label>
              <input name="title" className="field" defaultValue={cur?.title} aria-invalid={!!errors.title} />
              <Err errors={errors} name="title" />
            </div>
            <div>
              <label className="label">Text</label>
              <textarea name="body" rows={4} className="field" defaultValue={cur?.body} aria-invalid={!!errors.body} />
              <Err errors={errors} name="body" />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="published" defaultChecked={cur?.published ?? true} className="h-5 w-5 accent-[#5b1fd6]" /> Published
            </label>
            {save.error && <p className="err">{(save.error as Error).message}</p>}
            <button className="btn btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save post'}
            </button>
          </form>
        </Panel>
      )}

      {news.isLoading ? (
        <Spinner />
      ) : (
        <ul className="space-y-3">
          {news.data?.map((n) => (
            <li key={n.id} className="glass flex items-center gap-3 rounded-2xl p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{n.title}</p>
                <p className="text-xs text-muted">
                  {new Date(n.created_at).toLocaleDateString()} {!n.published && '· Draft'}
                </p>
              </div>
              <button className="btn btn-ghost !min-h-10 !px-3" aria-label="Edit" onClick={() => { setErrors({}); setEditing(n) }}>
                <EditIcon className="h-5 w-5" />
              </button>
              <button className="btn btn-danger !min-h-10 !px-3" aria-label="Delete" onClick={() => confirmDelete(`"${n.title}"`) && del.mutate(n.id)}>
                <TrashIcon className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* =============== Payment Requests =============== */
const PLAN_LABEL: Record<string, string> = { '1m': '1 мес', '3m': '3 мес', '6m': '6 мес', '12m': '12 мес' }
const STATUS_LABEL: Record<string, string> = { pending: '⏳ На проверке', approved: '✅ Одобрено', rejected: '❌ Отклонено' }

export function AdminPayments() {
  const requests = useAllPaymentRequests()
  const update = useUpdatePaymentRequest()
  const [note, setNote] = useState<Record<string, string>>({})

  async function handle(id: string, status: 'approved' | 'rejected', userId: string, plan: string) {
    if (!window.confirm(`${status === 'approved' ? 'Одобрить' : 'Отклонить'} заявку?`)) return
    await update.mutateAsync({ id, status, admin_note: note[id], userId, plan: plan as never })
  }

  const pending = requests.data?.filter((r) => r.status === 'pending') ?? []
  const done = requests.data?.filter((r) => r.status !== 'pending') ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Заявки на оплату {pending.length > 0 && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-sm text-white">{pending.length}</span>}</h1>
      {requests.isLoading ? <Spinner /> : (
        <>
          {pending.length === 0 && done.length === 0 && <p className="text-muted text-sm">Нет заявок.</p>}
          <div className="space-y-3">
            {[...pending, ...done].map((r) => (
              <div key={r.id} className="glass rounded-2xl p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{(r.profiles as {email:string}|undefined)?.email ?? r.user_id}</p>
                    <p className="text-xs text-muted">{PLAN_LABEL[r.plan]} · ${r.amount_usd} · {new Date(r.created_at).toLocaleString('ru')}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${r.status === 'pending' ? 'bg-amber-100 text-amber-800' : r.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.receipt_url && (
                  <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">📎 Посмотреть чек</a>
                )}
                {r.status === 'pending' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Комментарий (необязательно)"
                      className="field flex-1 text-sm"
                      value={note[r.id] ?? ''}
                      onChange={(e) => setNote((p) => ({ ...p, [r.id]: e.target.value }))}
                    />
                    <button className="btn btn-primary !min-h-9 !py-1.5 text-sm" onClick={() => handle(r.id, 'approved', r.user_id, r.plan)} disabled={update.isPending}>✅ Одобрить</button>
                    <button className="btn btn-danger !min-h-9 !py-1.5 text-sm" onClick={() => handle(r.id, 'rejected', r.user_id, r.plan)} disabled={update.isPending}>❌ Отклонить</button>
                  </div>
                )}
                {r.admin_note && <p className="text-xs text-muted">Комментарий: {r.admin_note}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* =============== Settings =============== */
export function AdminSettings() {
  const cardSetting = useAppSetting('card_number')
  const updateSetting = useUpdateAppSetting()
  const [card, setCard] = useState('')
  const [saved, setSaved] = useState(false)

  const currentCard = (cardSetting.data ?? '').replace(/"/g, '')

  async function saveCard(e: React.FormEvent) {
    e.preventDefault()
    if (!card.trim()) return
    await updateSetting.mutateAsync({ key: 'card_number', value: card.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setCard('')
  }

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-2xl font-extrabold">Настройки</h1>
      <div className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-lg">Номер карты для оплаты</h2>
        <p className="text-sm text-muted">Текущий: <span className="font-mono font-bold text-ink">{cardSetting.isLoading ? '...' : currentCard || '—'}</span></p>
        <form onSubmit={saveCard} className="space-y-3">
          <input
            type="text"
            className="field"
            placeholder="Новый номер карты (напр. 4400 4303 7236 1391)"
            value={card}
            onChange={(e) => setCard(e.target.value)}
          />
          <button className="btn btn-primary w-full" disabled={updateSetting.isPending || !card.trim()}>
            {saved ? '✓ Сохранено' : updateSetting.isPending ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </form>
        <p className="text-xs text-muted">Меняй каждую неделю. Студенты сразу увидят новый номер на странице оплаты.</p>
      </div>
    </div>
  )
}
/* =============== Groups (learning-centre classes) and their weekly leaderboard =============== */
function GroupDetails({ id, name }: { id: string; name: string }) {
  const members = useGroupMembers(id)
  const setGroup = useSetStudentGroup()
  const lb = useLeaderboard('group', 0, id)
  const [email, setEmail] = useState('')
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <p className="text-sm font-bold">Students ({members.data?.length ?? 0})</p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim()) setGroup.mutate({ email: email.trim(), groupId: id }, { onSuccess: () => setEmail('') })
          }}
        >
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="student@email.com" className="field !min-h-10 flex-1 text-sm" />
          <button className="btn btn-primary !min-h-10 !px-3 !py-1.5 text-sm" disabled={setGroup.isPending}>Add</button>
        </form>
        {setGroup.error && <p className="err mt-1">{(setGroup.error as Error).message}</p>}
        <ul className="mt-2 space-y-1">
          {members.data?.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <b>{m.full_name || '—'}</b> <span className="text-muted">{m.email}</span>
              </span>
              <button
                className="shrink-0 text-xs font-semibold text-muted hover:text-red-600"
                onClick={() => window.confirm(`Remove ${m.email} from "${name}"?`) && setGroup.mutate({ email: m.email, groupId: null })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-sm font-bold">This week</p>
        {lb.isLoading ? (
          <Spinner />
        ) : (lb.data?.rows.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted">No points yet this week.</p>
        ) : (
          <ol className="mt-2 space-y-1">
            {lb.data!.rows.map((r) => (
              <li key={`${r.rank}-${r.name}`} className="flex justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
                <span>
                  <b className="mr-2">{r.rank}.</b>
                  {r.name}
                </span>
                <b className="text-brand-700">{r.points}</b>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function ExtraRow({ x, groups }: { x: LeaderboardExtra; groups: { id: string; name: string }[] }) {
  const save = useSaveLeaderboardExtra()
  const del = useDeleteLeaderboardExtra()
  const [points, setPoints] = useState(String(x.points))
  const dirty = points !== String(x.points)
  return (
    <li className={`flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm ${x.active ? '' : 'opacity-60'}`}>
      <span className="min-w-0 flex-1 truncate font-semibold">{x.name}</span>
      <span className="text-xs text-muted">{x.group_id ? groups.find((g) => g.id === x.group_id)?.name ?? 'group' : 'All students'}</span>
      <input
        type="number"
        min={0}
        max={100000}
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        className="field !min-h-9 w-24 text-sm"
        aria-label="Points"
      />
      {dirty && (
        <button className="btn btn-primary !min-h-9 !px-3 !py-1 text-xs" disabled={save.isPending} onClick={() => save.mutate({ id: x.id, points: Math.max(0, Number(points) || 0) })}>
          Save
        </button>
      )}
      <label className="flex items-center gap-1 text-xs font-semibold">
        <input type="checkbox" checked={x.active} onChange={(e) => save.mutate({ id: x.id, active: e.target.checked })} className="h-4 w-4 accent-[#5b1fd6]" /> Shown
      </label>
      <button className="text-xs font-semibold text-muted hover:text-red-600" onClick={() => window.confirm(`Delete "${x.name}"?`) && del.mutate(x.id)}>
        Delete
      </button>
    </li>
  )
}

function LeaderboardExtras({ groups }: { groups: { id: string; name: string }[] }) {
  const extras = useLeaderboardExtras()
  const save = useSaveLeaderboardExtra()
  const [name, setName] = useState('')
  const [points, setPoints] = useState('50')
  const [groupId, setGroupId] = useState('')
  return (
    <section className="glass space-y-3 rounded-2xl p-4">
      <div>
        <h2 className="font-bold">Extra participants</h2>
        <p className="text-sm text-muted">
          Names you add here appear in the weekly leaderboard with the points you set (any week, until you hide or delete them). Use it to fill a new leaderboard; real students are ranked among them. Students see
          them like everyone else, as «Имя Ф.».
        </p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim().length < 2) return
          save.mutate(
            { name: name.trim(), points: Math.max(0, Number(points) || 0), group_id: groupId || null, active: true },
            { onSuccess: () => setName('') },
          )
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name Surname" maxLength={60} className="field !min-h-10 flex-1 text-sm" />
        <input value={points} onChange={(e) => setPoints(e.target.value)} type="number" min={0} max={100000} className="field !min-h-10 w-24 text-sm" aria-label="Points" />
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="field !min-h-10 text-sm">
          <option value="">All students</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary !min-h-10 !px-4 !py-2 text-sm" disabled={save.isPending || name.trim().length < 2}>
          <PlusIcon className="h-4 w-4" /> Add
        </button>
      </form>
      {save.error && <p className="err">{(save.error as Error).message}</p>}
      {extras.isLoading ? (
        <Spinner />
      ) : (
        <ul className="space-y-1">
          {extras.data?.map((x) => (
            <ExtraRow key={x.id} x={x} groups={groups} />
          ))}
        </ul>
      )}
    </section>
  )
}

function OverallRanking() {
  const lb = useLeaderboard('all', 0)
  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="font-bold">All students — this week</h2>
      {lb.isLoading ? (
        <Spinner />
      ) : lb.error ? (
        <p className="err mt-2">{(lb.error as Error).message}</p>
      ) : (lb.data?.rows.length ?? 0) === 0 ? (
        <p className="mt-2 text-sm text-muted">No points yet this week.</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {lb.data!.rows.slice(0, 20).map((r) => (
            <li key={`${r.rank}-${r.name}`} className="flex justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
              <span>
                <b className="mr-2">{r.rank}.</b>
                {r.name}
              </span>
              <b className="text-brand-700">{r.points}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function AdminGroups() {
  const groups = useGroups()
  const save = useSaveGroup()
  const del = useDeleteGroup()
  const [name, setName] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Groups</h1>
        <p className="text-sm text-muted">
          A group is a class of a learning centre. Give its students the join code (Leaderboard page → «Join»), or add them by e-mail. Each group gets its own weekly leaderboard.
        </p>
      </div>
      <form
        className="glass flex flex-wrap gap-2 rounded-2xl p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim().length >= 2) save.mutate({ name: name.trim() }, { onSuccess: () => setName('') })
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. «Almaty Center — Evening»" maxLength={60} className="field flex-1" />
        <button className="btn btn-primary" disabled={save.isPending || name.trim().length < 2}>
          <PlusIcon className="h-4 w-4" /> New group
        </button>
        {save.error && <p className="err w-full">{(save.error as Error).message}</p>}
      </form>
      <OverallRanking />
      <LeaderboardExtras groups={groups.data ?? []} />
      {groups.isLoading ? (
        <Spinner />
      ) : (groups.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted">No groups yet.</p>
      ) : (
        <ul className="space-y-3">
          {groups.data!.map((g) => (
            <li key={g.id} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{g.name}</p>
                  <p className="text-xs text-muted">{g.members} students</p>
                </div>
                <button
                  className="rounded-xl bg-brand-100 px-3 py-1.5 font-mono text-sm font-bold tracking-widest text-brand-800"
                  title="Copy the join code"
                  onClick={() => navigator.clipboard?.writeText(g.join_code)}
                >
                  {g.join_code} 📋
                </button>
                <button className="btn btn-ghost !min-h-9 !px-3 !py-1.5 text-sm" onClick={() => setOpen(open === g.id ? null : g.id)}>
                  {open === g.id ? 'Close' : 'Students & ranking'}
                </button>
                <button
                  className="btn btn-danger !min-h-9 !px-3 !py-1.5 text-xs"
                  onClick={() => window.confirm(`Delete the group "${g.name}"? Students stay, they just leave the group.`) && del.mutate(g.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              {open === g.id && <GroupDetails id={g.id} name={g.name} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
