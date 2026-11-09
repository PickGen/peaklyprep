import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { MountainHero } from '../components/MountainHero'
import { Reveal } from '../components/Reveal'
import { ScoreShowcase } from '../components/ScoreShowcase'
import { Pricing } from '../components/Pricing'
import { ArrowRight, BookIcon, GlassTile, LayersIcon } from '../components/Icons'

export default function Landing() {
  const { tr } = useI18n()
  const { session, isAdmin } = useAuth()
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [hash])
  const startTo = session ? (isAdmin ? '/admin' : '/app') : '/register'

  return (
    <main className="overflow-x-clip">
      <section className="relative mx-auto grid grid-cols-1 max-w-7xl items-center gap-4 px-5 pb-6 pt-4 md:px-10 lg:grid-cols-[1.02fr_1fr] lg:pt-10">
        <div className="relative z-10">
          <Reveal>
            <h1 className="text-[2.5rem] font-extrabold leading-[1.08] sm:text-6xl lg:text-[3.3rem] xl:text-[3.8rem]">
              <span className="lg:whitespace-nowrap">{tr("Prepare for the SAT.")}</span>
              <span className="mt-1 block text-gradient">{tr("Get into your dream university.")}</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              {tr("A smart learning platform with lessons, practice, and progress tracking.")}
            </p>
          </Reveal>
          <Reveal delay={220} className="mt-8 flex flex-wrap gap-3">
            <Link to={startTo} className="btn btn-primary flex-1 !px-7 !py-3.5 text-[1.05rem] sm:flex-none">
              {tr("Start Learning")} <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#sat" className="btn btn-ghost flex-1 !px-7 !py-3.5 text-[1.05rem] sm:flex-none">
              {tr("Learn More")}
            </a>
          </Reveal>
        </div>

        <Reveal delay={160} className="relative -mx-5 sm:mx-0 lg:-mr-10">
          <MountainHero className="h-auto w-full" />
        </Reveal>
      </section>

      <section id="sat" className="mx-auto max-w-4xl scroll-mt-6 px-5 pb-16 pt-4 md:px-10 lg:pt-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Reveal>
            <article className="glass flex h-full items-center gap-5 rounded-3xl p-5 sm:p-6">
              <GlassTile className="h-[68px] w-[68px]">
                <BookIcon className="h-10 w-10" />
              </GlassTile>
              <div>
                <h2 className="text-lg font-bold tracking-tight">{tr("SAT Preparation")}</h2>
                <p className="mt-0.5 text-[15px] text-muted">{tr("Reading · Writing · Math")}</p>
              </div>
            </article>
          </Reveal>
          <Reveal delay={120}>
            <article className="glass flex h-full items-center gap-5 rounded-3xl p-5 sm:p-6">
              <GlassTile className="h-[68px] w-[68px]">
                <LayersIcon className="h-10 w-10" />
              </GlassTile>
              <div>
                <h2 className="text-lg font-bold tracking-tight">{tr("Knowledge Building")}</h2>
                <p className="mt-0.5 text-[15px] text-muted">{tr("Key subjects & skills")}</p>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      <div className="flex justify-center pb-2">
        <a href="#scores" className="flex flex-col items-center gap-1 text-xs font-semibold text-muted" aria-label={tr("Scroll to results")}>
          {tr("Scroll")}<span className="floaty text-lg leading-none text-brand-600">⌄</span>
        </a>
      </div>

      <ScoreShowcase />
      <Pricing />

      <footer className="pb-10 text-center text-sm text-muted">© 2024 PeaklyPrep · <Link to="/privacy" className="hover:text-brand-600">{tr("Privacy Policy")}</Link></footer>
    </main>
  )
}
