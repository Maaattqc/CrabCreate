import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Check,
  Clock3,
  Code2,
  Gauge,
  Minus,
  Rocket,
  ShieldCheck,
  Sparkles,
  TestTube,
  Wand2,
  X,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useAnimations } from '../../hooks/useAnimations';

const features = [
  { icon: Code2, color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/25' },
  { icon: ShieldCheck, color: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/25' },
  { icon: TestTube, color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25' },
  { icon: Rocket, color: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/25' },
] as const;

const pipelineIcons = [Wand2, Bot, ShieldCheck, Rocket] as const;

const statusStyles = {
  done: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  running: 'text-amber-200 bg-amber-500/20 border-amber-500/35',
  waiting: 'text-tx-muted bg-subtle border-th-border',
} as const;

type ComparisonValue = boolean | 'partial' | 'paid';

export default function LandingPage() {
  const { t, lang } = useLanguage();
  const { animations } = useAnimations();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const revealNodes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (revealNodes.length === 0) return;

    revealNodes.forEach((node, index) => {
      const customDelay = node.getAttribute('data-reveal-delay');
      const computedDelay = customDelay ? `${customDelay}ms` : `${Math.min(420, (index % 8) * 65)}ms`;
      node.style.setProperty('--reveal-delay', computedDelay);
      node.classList.remove('is-visible');
    });

    const prefersReducedMotion = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    if (!animations || prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      revealNodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.18,
      },
    );

    revealNodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [animations, lang]);

  const copy = lang === 'fr'
    ? {
        heroBadge: 'Plateforme IA orientee delivery',
        heroLead: 'Tu decris la demande, CrabCreate orchestre le code, la review, les tests et le deploiement sans friction.',
        secondCta: 'Voir les tarifs',
        stats: [
          { value: '-65%', label: 'temps moyen de delivery' },
          { value: '24/7', label: 'pipeline automatise' },
          { value: '2 IA', label: 'generation + review' },
        ],
        pipelineTitle: 'Pipeline automatise en direct',
        pipelineSub: 'Un flux controle pour livrer vite et propre.',
        statusDone: 'Termine',
        statusRunning: 'En cours',
        statusWaiting: 'En attente',
        outcomesTitle: 'Des resultats visibles en quelques sprints',
        outcomesSub: 'Positionne ton produit sur ce que les clients achetent: rapidite, fiabilite, automatisation.',
        outcomes: [
          {
            title: 'Delivery accelere',
            desc: 'Passe du brief au code testable en quelques minutes, avec moins de coordination manuelle.',
          },
          {
            title: 'Qualite renforcee',
            desc: 'Chaque changement est valide par une seconde IA et des tests pour reduire les regressions.',
          },
          {
            title: 'Equipe focus produit',
            desc: 'Les devs pilotent les priorites pendant que le pipeline execute les taches repetitives.',
          },
        ],
        automationTitle: 'Un moteur unique, quatre etapes automatisees',
        automationSub: 'CrabCreate ne se limite pas au board: le coeur produit execute toute la chaine de livraison.',
        finalTitle: 'Montre une execution plus rapide que tes concurrents',
        finalSub: 'Active le pipeline complet et transforme chaque ticket en livraison previsible.',
      }
    : {
        heroBadge: 'AI platform built for shipping',
        heroLead: 'You describe the change, CrabCreate orchestrates coding, review, testing, and deployment automatically.',
        secondCta: 'View pricing',
        stats: [
          { value: '-65%', label: 'average delivery time' },
          { value: '24/7', label: 'automated pipeline' },
          { value: '2 AI', label: 'coding + review' },
        ],
        pipelineTitle: 'Live automated pipeline',
        pipelineSub: 'A controlled flow to ship quickly with confidence.',
        statusDone: 'Done',
        statusRunning: 'Running',
        statusWaiting: 'Waiting',
        outcomesTitle: 'Business outcomes your users can feel',
        outcomesSub: 'Position on what buyers care about: speed, reliability, and full automation.',
        outcomes: [
          {
            title: 'Faster delivery',
            desc: 'Move from brief to testable code in minutes with less manual coordination.',
          },
          {
            title: 'Higher quality',
            desc: 'Every change is validated by a second AI and tests to reduce regressions.',
          },
          {
            title: 'Teams stay focused',
            desc: 'Engineers drive priorities while the pipeline handles repetitive execution.',
          },
        ],
        automationTitle: 'One engine, four automated stages',
        automationSub: 'CrabCreate is more than a board: the core product executes your full delivery chain.',
        finalTitle: 'Show a stronger execution engine than the market',
        finalSub: 'Run the full pipeline and turn every ticket into predictable delivery.',
      };

  const featureData = [
    { title: t.landingFeature1Title, desc: t.landingFeature1Desc },
    { title: t.landingFeature2Title, desc: t.landingFeature2Desc },
    { title: t.landingFeature3Title, desc: t.landingFeature3Desc },
    { title: t.landingFeature4Title, desc: t.landingFeature4Desc },
  ];

  const steps = [
    { num: '01', title: t.landingStep1, desc: t.landingStep1Desc, status: 'done' as const, progress: 100 },
    { num: '02', title: t.landingStep2, desc: t.landingStep2Desc, status: 'done' as const, progress: 100 },
    { num: '03', title: t.landingStep3, desc: t.landingStep3Desc, status: 'running' as const, progress: 68 },
    { num: '04', title: t.landingStep4, desc: t.landingStep4Desc, status: 'waiting' as const, progress: 22 },
  ];

  const comparisonRows: Array<{ label: string; crabcreate: ComparisonValue; trello: ComparisonValue; linear: ComparisonValue; jira: ComparisonValue }> = [
    { label: t.compAICoding, crabcreate: true, trello: false, linear: false, jira: false },
    { label: t.compAutoReview, crabcreate: true, trello: false, linear: false, jira: false },
    { label: t.compAutoTest, crabcreate: true, trello: false, linear: false, jira: false },
    { label: t.compAutoDeploy, crabcreate: true, trello: false, linear: false, jira: false },
    { label: t.compKanban, crabcreate: true, trello: true, linear: true, jira: true },
    { label: t.compRealtime, crabcreate: true, trello: true, linear: true, jira: false },
    { label: t.compSubtasks, crabcreate: true, trello: 'partial', linear: true, jira: true },
    { label: t.compLabels, crabcreate: true, trello: true, linear: true, jira: true },
    { label: t.compDueDates, crabcreate: true, trello: true, linear: true, jira: true },
    { label: t.compCalendar, crabcreate: true, trello: 'paid', linear: false, jira: 'paid' },
    { label: t.compTimeline, crabcreate: true, trello: 'paid', linear: true, jira: 'paid' },
    { label: t.compTemplates, crabcreate: true, trello: 'paid', linear: true, jira: true },
    { label: t.compSearch, crabcreate: true, trello: 'partial', linear: true, jira: true },
    { label: t.compExport, crabcreate: true, trello: false, linear: false, jira: true },
    { label: t.compWebhooks, crabcreate: true, trello: true, linear: true, jira: true },
    { label: t.compKeyboardShortcuts, crabcreate: true, trello: 'partial', linear: true, jira: true },
    { label: t.compMarkdown, crabcreate: true, trello: false, linear: true, jira: true },
    { label: t.compSelfHosted, crabcreate: true, trello: false, linear: false, jira: 'paid' },
    { label: t.compFreeTier, crabcreate: true, trello: true, linear: true, jira: true },
  ];

  return (
    <div ref={rootRef} className="landing-scroll-bg relative min-h-screen overflow-hidden">
      <style>{`
        @keyframes landing-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes landing-pulse {
          0%, 100% { opacity: 0.28; }
          50% { opacity: 0.58; }
        }
        @keyframes landing-scan {
          from { transform: translateX(-130%); }
          to { transform: translateX(130%); }
        }
        @keyframes landing-gradient-drift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .landing-float { animation: landing-float 7s ease-in-out infinite; }
        .landing-pulse { animation: landing-pulse 6s ease-in-out infinite; }
        .landing-reveal {
          opacity: 0;
          transform: translateY(32px) scale(0.985);
          filter: blur(3px);
          transition:
            opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.75s cubic-bezier(0.22, 1, 0.36, 1),
            filter 0.75s ease;
          transition-delay: var(--reveal-delay, 0ms);
          will-change: opacity, transform, filter;
        }
        .landing-reveal.is-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }
        .landing-scroll-bg::before {
          content: '';
          position: absolute;
          inset: -15% -20% auto -20%;
          height: 460px;
          pointer-events: none;
          background: radial-gradient(circle at 24% 36%, rgba(251, 146, 60, 0.18), transparent 54%),
                      radial-gradient(circle at 78% 28%, rgba(14, 165, 233, 0.12), transparent 58%);
          filter: blur(12px);
        }
        .landing-scan {
          position: relative;
          overflow: hidden;
        }
        .landing-scan::after {
          content: '';
          position: absolute;
          inset: -1px;
          background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.08) 45%, transparent 70%);
          animation: landing-scan 2.8s linear infinite;
          pointer-events: none;
        }
        [data-animations="off"] .landing-reveal {
          opacity: 1;
          transform: none;
          filter: none;
          transition: none;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="landing-float landing-pulse absolute -top-28 -left-28 h-72 w-72 rounded-full bg-amber-500/20 blur-[110px]" />
        <div className="landing-float landing-pulse absolute top-24 right-[-90px] h-80 w-80 rounded-full bg-rose-500/15 blur-[120px]" style={{ animationDelay: '1.4s' }} />
        <div className="landing-float landing-pulse absolute bottom-[-140px] left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[140px]" style={{ animationDelay: '2.2s' }} />
      </div>

      <section className="landing-section relative mx-auto max-w-6xl px-6 pb-14 pt-14 md:pt-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div data-reveal className="landing-reveal">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-200">
              <Sparkles size={14} />
              {copy.heroBadge}
            </div>
            <h1 className="text-4xl font-black leading-tight text-tx-primary md:text-5xl lg:text-6xl">
              {t.landingHero}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-tx-secondary md:text-lg">
              {t.landingHeroSub}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-tx-muted md:text-base">
              {copy.heroLead}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] hover:from-amber-400 hover:to-red-400 hover:shadow-amber-500/30"
              >
                {t.landingCTA}
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center rounded-xl border border-th-border-strong bg-card/70 px-6 py-3.5 text-sm font-semibold text-tx-secondary transition-colors hover:border-th-border hover:bg-subtle"
              >
                {copy.secondCta}
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {copy.stats.map((stat, i) => (
                <div
                  key={stat.label}
                  data-reveal
                  data-reveal-delay={Math.round((0.08 * (i + 1)) * 1000)}
                  className="landing-reveal rounded-xl border border-th-border bg-card/70 px-4 py-3 backdrop-blur-sm"
                >
                  <p className="text-xl font-black text-tx-primary">{stat.value}</p>
                  <p className="mt-1 text-xs text-tx-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal data-reveal-delay={160} className="landing-reveal">
            <div className="landing-scan rounded-3xl border border-th-border-strong bg-card/80 p-5 backdrop-blur-xl shadow-2xl shadow-black/20">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-tx-primary">{copy.pipelineTitle}</p>
                  <p className="mt-1 text-xs text-tx-muted">{copy.pipelineSub}</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Live
                </div>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => {
                  const Icon = pipelineIcons[index];
                  const statusLabel = step.status === 'done'
                    ? copy.statusDone
                    : step.status === 'running'
                      ? copy.statusRunning
                      : copy.statusWaiting;

                  return (
                    <div key={step.num} className="rounded-xl border border-th-border bg-surface/70 p-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-th-border bg-subtle">
                            <Icon size={14} className="text-amber-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-tx-primary">{step.title}</p>
                            <p className="mt-0.5 truncate text-xs text-tx-faint">{step.desc}</p>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyles[step.status]}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                        <div
                          className={`h-full rounded-full ${
                            step.status === 'done'
                              ? 'bg-emerald-400'
                              : step.status === 'running'
                                ? 'bg-gradient-to-r from-amber-400 to-rose-400'
                                : 'bg-tx-faint'
                          }`}
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section relative mx-auto max-w-6xl px-6 pb-8">
        <div data-reveal className="landing-reveal rounded-3xl border border-th-border-strong bg-gradient-to-br from-amber-500/10 via-card/90 to-sky-500/10 p-7 md:p-9">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">{copy.outcomesTitle}</p>
            <p className="landing-outcomes-sub mt-3 text-sm md:text-base">{copy.outcomesSub}</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {copy.outcomes.map((item, i) => (
              <article
                key={item.title}
                data-reveal
                data-reveal-delay={Math.round((0.08 * (i + 1)) * 1000)}
                className="landing-reveal rounded-2xl border border-th-border bg-card/75 p-5"
              >
                <p className="text-sm font-semibold text-tx-primary">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-tx-muted">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section mx-auto max-w-6xl px-6 py-16">
        <div data-reveal className="landing-reveal mb-8 max-w-2xl">
          <h2 className="text-3xl font-black text-tx-primary">{copy.automationTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-tx-muted md:text-base">{copy.automationSub}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            const data = featureData[i];
            return (
              <article
                key={data.title}
                data-reveal
                data-reveal-delay={Math.round((0.08 * (i + 1)) * 1000)}
                className={`landing-reveal rounded-2xl border bg-card/80 p-5 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-th-border-strong ${feature.border}`}
              >
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 ${feature.bg}`}>
                  <Icon size={20} className={feature.color} />
                </div>
                <h3 className="text-sm font-semibold text-tx-primary">{data.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-tx-muted">{data.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section mx-auto max-w-6xl px-6 pb-16">
        <div data-reveal className="landing-reveal mb-8 max-w-3xl">
          <h2 className="text-3xl font-black text-tx-primary">{t.landingHowTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-tx-muted md:text-base">
            {lang === 'fr'
              ? 'Chaque etape est tracee et visible. Tu gardes le controle produit pendant que la machine execute.'
              : 'Each stage is traceable and visible. You keep product control while the machine executes.'}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step, i) => (
            <article
              key={step.num}
              data-reveal
              data-reveal-delay={Math.round((0.1 * (i + 1)) * 1000)}
              className="landing-reveal rounded-2xl border border-th-border bg-card/75 p-5"
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10">
                  <span className="text-sm font-bold text-amber-300">{step.num}</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-tx-primary">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-tx-muted">{step.desc}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section mx-auto max-w-6xl px-6 pb-16">
        <div data-reveal className="landing-reveal mb-7 max-w-2xl">
          <h2 className="text-3xl font-black text-tx-primary">{t.comparisonTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-tx-muted md:text-base">{t.comparisonSubtitle}</p>
        </div>
        <div data-reveal className="landing-reveal overflow-x-auto rounded-3xl border border-th-border-strong bg-card/80 backdrop-blur-xl">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-th-border bg-surface/70">
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.08em] text-tx-faint">{t.compFeature}</th>
                <th className="px-4 py-4 text-center">
                  <span className="bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 bg-clip-text text-base font-extrabold text-transparent">
                    CrabCreate
                  </span>
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.08em] text-tx-faint">Trello</th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.08em] text-tx-faint">Linear</th>
                <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.08em] text-tx-faint">Jira</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr key={row.label} className={`border-b border-th-border/40 ${i % 2 === 0 ? 'bg-card/60' : 'bg-surface/35'}`}>
                  <td className="px-5 py-3.5 font-medium text-tx-primary">{row.label}</td>
                  {(['crabcreate', 'trello', 'linear', 'jira'] as const).map((col) => {
                    const val = row[col];
                    return (
                      <td key={col} className="px-4 py-3.5 text-center">
                        {val === true ? (
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${col === 'crabcreate' ? 'bg-emerald-500/20' : 'bg-emerald-500/10'}`}>
                            <Check size={15} className={col === 'crabcreate' ? 'text-emerald-300' : 'text-emerald-500/70'} />
                          </span>
                        ) : val === false ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10">
                            <X size={15} className="text-red-300/80" />
                          </span>
                        ) : val === 'partial' ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10">
                            <Minus size={15} className="text-amber-200/80" />
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-200">
                            {t.compPaid}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="landing-section mx-auto max-w-5xl px-6 pb-20">
        <div data-reveal className="landing-reveal rounded-3xl border border-amber-500/25 bg-gradient-to-r from-amber-500/15 via-card/90 to-rose-500/15 p-8 text-center md:p-12">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10">
            <Gauge size={22} className="text-amber-200" />
          </div>
          <h2 className="text-2xl font-black text-tx-primary md:text-3xl">{copy.finalTitle}</h2>
          <p className="landing-final-sub mx-auto mt-3 max-w-2xl text-sm leading-relaxed md:text-base">{copy.finalSub}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] hover:from-amber-400 hover:to-red-400"
            >
              {t.landingCTA}
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-th-border-strong bg-card/70 px-6 py-3.5 text-sm font-semibold text-tx-secondary transition-colors hover:bg-subtle"
            >
              <Clock3 size={15} />
              {lang === 'fr' ? 'Parler produit' : 'Talk to product'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
