import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { privacy } from '../lib/privacy'

function Doc({ title, children }: { title: string; children: React.ReactNode }) {
  const { tr } = useI18n()
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-4">
      <Link to="/" className="text-sm font-semibold text-brand-600">
        ‹ {tr('Back')}
      </Link>
      <article className="glass mt-4 rounded-3xl p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {children}
      </article>
    </main>
  )
}

/** Renders text where **double asterisks** mean bold, and bare URLs become links. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((chunk, i) => {
        const parts = chunk.split(/(https?:\/\/[^\s)]+)/g)
        const content = parts.map((s, j) =>
          /^https?:\/\//.test(s) ? (
            <a key={j} href={s} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline">
              {s}
            </a>
          ) : (
            <Fragment key={j}>{s}</Fragment>
          ),
        )
        return i % 2 === 1 ? <strong key={i}>{content}</strong> : <Fragment key={i}>{content}</Fragment>
      })}
    </>
  )
}

export function PrivacyPage() {
  const { lang } = useI18n()
  const doc = privacy[lang]
  return (
    <Doc title={doc.title}>
      <p className="mt-2 text-sm text-muted">
        <strong>{doc.updatedLabel}</strong> {doc.updated}
      </p>
      <div className="prose-lesson mt-4">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h3>{s.h}</h3>
            {s.p?.map((para, i) => (
              <p key={i}>
                <Rich text={para} />
              </p>
            ))}
            {s.ul && (
              <ul>
                {s.ul.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Doc>
  )
}

export function TermsPage() {
  return (
    <Doc title="Terms of Use">
      <div className="prose-lesson mt-4">
        <p>By using PeaklyPrep you agree to use the platform for personal SAT preparation only.</p>
        <h3>Fair use</h3>
        <ul>
          <li>Do not share your account or copy the learning materials.</li>
          <li>Practice-test scores are estimates and do not guarantee an official SAT result.</li>
        </ul>
        <h3>Contact</h3>
        <p>Questions about these terms: support@peaklyprep.com.</p>
      </div>
    </Doc>
  )
}
