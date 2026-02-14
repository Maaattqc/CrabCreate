import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Play, Star } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { getColumnColor } from '../../constants';
import { submitFeedback } from '../../api/tickets';

interface OnboardingProps {
  onDone: () => void;
  onCreateDemoTicket: () => Promise<number>;
  onSimulatePipeline: (ticketId: number, onStep: (status: string) => void, onComplete: () => void) => void;
}

type Phase =
  | 'idle'
  // Step 0: create ticket
  | 'cursor-to-plus' | 'click-plus'
  | 'modal-typing' | 'cursor-to-create' | 'click-create'
  // Step 1: launch pipeline
  | 'cursor-to-play' | 'click-play' | 'pipeline-running'
  // Step 1 extras
  | 'pipeline-approve' | 'pipeline-celebrate'
  // Final
  | 'tutorial-complete';

export default function Onboarding({ onDone, onCreateDemoTicket, onSimulatePipeline }: OnboardingProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [demoTicketId, setDemoTicketId] = useState<number | null>(null);

  // Pipeline status tracking
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);
  const prevPipelineStatusRef = useRef<string>('backlog');

  // Ghost flying card
  const ghostRef = useRef<HTMLDivElement>(null);

  // Tooltip positioning
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [arrowDirection, setArrowDirection] = useState<'down' | 'up' | 'left'>('down');

  // Cursor — use ref for direct DOM manipulation (bypasses React batching)
  const cursorRef = useRef<HTMLDivElement>(null);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number } | null>(null);

  // Feedback stars
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  // Fake modal
  const [showFakeModal, setShowFakeModal] = useState(false);
  const [typedTitle, setTypedTitle] = useState('');
  const [typedDesc, setTypedDesc] = useState('');
  const [activeField, setActiveField] = useState<'title' | 'desc' | null>(null);

  // Timer management
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    const id = window.setTimeout(() => { mountedRef.current ? resolve() : reject(); }, ms);
    timersRef.current.push(id);
  });
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; clearTimers(); };
  }, []);

  const steps: { text: string; icon: React.ReactNode; target: string; centered?: boolean }[] = [
    { text: t.onboardStep1, icon: '➕', target: 'create-ticket' },
    { text: t.onboardStep3, icon: '📊', target: 'columns', centered: true },
    { text: t.onboardStep2, icon: <Play size={16} fill="currentColor" className="text-green-400" />, target: 'launch-pipeline' },
  ];

  // ── Tooltip positioning ──
  const minimized = phase === 'pipeline-running' || phase === 'pipeline-approve' || phase === 'pipeline-celebrate' || phase === 'tutorial-complete';
  const showTooltip = phase === 'idle';

  const positionTooltip = useCallback(() => {
    if (!showTooltip) return;
    const current = steps[step];
    const el = current.target ? document.querySelector(`[data-onboard="${current.target}"]`) : null;

    if (!el) {
      setTooltipStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      setHighlightStyle({ display: 'none' });
      setArrowStyle({ display: 'none' });
      return;
    }

    const rect = el.getBoundingClientRect();

    // Centered tooltip with highlight on the element (no arrow)
    if (current.centered) {
      setHighlightStyle({ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8, display: 'block' });
      setTooltipStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      setArrowStyle({ display: 'none' });
      return;
    }
    const tooltipW = 340, tooltipH = 140, gap = 16;

    setHighlightStyle({ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8, display: 'block' });

    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > tooltipH + gap + 20) {
      setArrowDirection('up');
      setTooltipStyle({ top: rect.bottom + gap, left: Math.max(12, Math.min(rect.left + rect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - 12)) });
      setArrowStyle({ top: rect.bottom + 4, left: rect.left + rect.width / 2 - 8, display: 'block' });
    } else if (rect.top > tooltipH + gap + 20) {
      setArrowDirection('down');
      setTooltipStyle({ top: rect.top - tooltipH - gap, left: Math.max(12, Math.min(rect.left + rect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - 12)) });
      setArrowStyle({ top: rect.top - gap + 4, left: rect.left + rect.width / 2 - 8, display: 'block' });
    } else {
      setArrowDirection('left');
      setTooltipStyle({ top: Math.max(12, rect.top + rect.height / 2 - tooltipH / 2), left: Math.min(rect.right + gap, window.innerWidth - tooltipW - 12) });
      setArrowStyle({ top: rect.top + rect.height / 2 - 8, left: rect.right + 4, display: 'block' });
    }
  }, [step, showTooltip]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    positionTooltip();
    window.addEventListener('resize', positionTooltip);
    return () => window.removeEventListener('resize', positionTooltip);
  }, [positionTooltip]);

  // ── Cursor helpers — Web Animations API (most reliable, no CSS transition issues) ──
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const cursorAnimRef = useRef<Animation | null>(null);

  const showCursorAt = async (x: number, y: number) => {
    cursorPosRef.current = { x, y };
    setCursorVisible(true);
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const el = cursorRef.current;
    if (el) {
      cursorAnimRef.current?.cancel();
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
  };

  const moveCursorTo = async (selector: string, duration: number) => {
    let target: Element | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      target = document.querySelector(selector);
      if (target) break;
      await wait(100);
    }
    if (!target || !cursorRef.current) return;

    const r = target.getBoundingClientRect();
    const endX = r.left + r.width / 2 - 3;
    const endY = r.top + r.height / 2 - 2;
    const { x: startX, y: startY } = cursorPosRef.current;

    cursorAnimRef.current?.cancel();
    const anim = cursorRef.current.animate(
      [
        { transform: `translate(${startX}px, ${startY}px)` },
        { transform: `translate(${endX}px, ${endY}px)` },
      ],
      { duration, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)', fill: 'forwards' },
    );
    cursorAnimRef.current = anim;
    cursorPosRef.current = { x: endX, y: endY };
    await anim.finished;
  };

  const doClick = async (selector: string) => {
    const target = document.querySelector(selector);
    if (!target) return;
    const r = target.getBoundingClientRect();
    setClickRipple({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    await wait(450);
    setClickRipple(null);
  };

  const hideCursor = () => {
    setCursorVisible(false);
    cursorAnimRef.current?.cancel();
    cursorAnimRef.current = null;
  };

  // ── Ghost flying card between columns ──
  const animateGhost = (fromStatus: string, toStatus: string) => {
    const ghost = ghostRef.current;
    if (!ghost) return;
    const fromCol = document.querySelector(`[data-column="${fromStatus}"]`);
    const toCol = document.querySelector(`[data-column="${toStatus}"]`);
    if (!fromCol || !toCol) return;

    const from = fromCol.getBoundingClientRect();
    const to = toCol.getBoundingClientRect();

    // Start with source column color, switch to target on landing
    const fromColor = getColumnColor(fromStatus);
    const toColor = getColumnColor(toStatus);
    ghost.style.borderColor = `${fromColor}66`;
    ghost.style.boxShadow = `0 25px 50px -12px ${fromColor}4d`;
    const accent = ghost.querySelector('[data-ghost-accent]') as HTMLElement | null;
    if (accent) accent.style.backgroundColor = fromColor;

    const cardW = Math.min(from.width - 16, 170);
    const cardH = 65;
    const startX = from.left + (from.width - cardW) / 2;
    const startY = from.top + 55;
    const endX = to.left + (to.width - cardW) / 2;
    const endY = to.top + 55;
    const midX = (startX + endX) / 2;
    const midY = Math.min(startY, endY) - 40;

    ghost.style.width = `${cardW}px`;
    ghost.style.height = `${cardH}px`;
    ghost.style.opacity = '1';
    ghost.style.visibility = 'visible';

    // Switch to target color at 80% of animation (landing)
    const switchTimer = window.setTimeout(() => {
      ghost.style.borderColor = `${toColor}66`;
      ghost.style.boxShadow = `0 25px 50px -12px ${toColor}4d`;
      if (accent) accent.style.backgroundColor = toColor;
    }, 550 * 0.8);
    timersRef.current.push(switchTimer);

    const anim = ghost.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) scale(1)`, opacity: 0.9 },
        { transform: `translate(${midX}px, ${midY}px) scale(0.85)`, opacity: 0.65, offset: 0.45 },
        { transform: `translate(${endX}px, ${endY}px) scale(1)`, opacity: 0.9 },
      ],
      { duration: 550, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'forwards' },
    );
    anim.onfinish = () => {
      ghost.style.opacity = '0';
      ghost.style.visibility = 'hidden';
    };
  };

  // ── Pipeline pill description ──
  const pillText = useMemo(() => {
    if (!pipelineStatus) return t.onboardPipelineRunning;
    switch (pipelineStatus) {
      case 'queued': return t.onboardPipelineQueued;
      case 'estimating': return t.onboardPipelineEstimating.replace('{cost}', '2,45');
      case 'ai_coding': return t.onboardPipelineCoding.replace('{lines}', '534');
      case 'ai_review': return t.onboardPipelineReview.replace('{score}', '92');
      case 'testing': return t.onboardPipelineTesting;
      case 'deploying': return t.onboardPipelineDeploying;
      case 'staging': return t.onboardPipelineStaging;
      default: return t.onboardPipelineRunning;
    }
  }, [pipelineStatus, t]);

  // ── Step 0 animation: cursor → + → modal → typing → create ──
  const runStep0 = async () => {
    try {
      setPhase('cursor-to-plus');
      await showCursorAt(window.innerWidth / 2, window.innerHeight / 2);
      await wait(200); // brief pause so user sees cursor appear

      // Move to the + button
      await moveCursorTo('[data-onboard="create-ticket"]', 1800);

      // Click the + button
      setPhase('click-plus');
      await doClick('[data-onboard="create-ticket"]');

      hideCursor();

      // Open fake modal + typing
      setShowFakeModal(true);
      setPhase('modal-typing');
      await wait(400);

      // Type title
      setActiveField('title');
      const title = t.onboardDemoTitle;
      for (let i = 1; i <= title.length; i++) {
        setTypedTitle(title.slice(0, i));
        await wait(55);
      }

      await wait(350);

      // Type description
      setActiveField('desc');
      const desc = t.onboardDemoDesc;
      for (let j = 1; j <= desc.length; j++) {
        setTypedDesc(desc.slice(0, j));
        await wait(45);
      }

      await wait(500);
      setActiveField(null);

      // Move cursor to "Créer" button
      setPhase('cursor-to-create');
      await showCursorAt(window.innerWidth / 2, window.innerHeight / 2);
      await wait(200);
      await moveCursorTo('[data-onboard-create-btn]', 1000);

      // Click "Créer"
      setPhase('click-create');
      await doClick('[data-onboard-create-btn]');

      hideCursor();
      setShowFakeModal(false);
      setTypedTitle('');
      setTypedDesc('');

      // Create the ticket in state
      const id = await onCreateDemoTicket();
      setDemoTicketId(id);

      await wait(600);
      setPhase('idle');
      setStep(1);
    } catch { /* unmounted */ }
  };

  // ── Step 1 animation: cursor → play → pipeline → approve → celebrate ──
  const runStep1 = async () => {
    try {
      setPhase('cursor-to-play');
      await showCursorAt(window.innerWidth / 2, window.innerHeight / 2);
      await wait(200);

      // Move to the play button
      await moveCursorTo('[data-onboard="launch-pipeline"]', 1800);

      // Click play button
      setPhase('click-play');
      await doClick('[data-onboard="launch-pipeline"]');

      hideCursor();

      // Start pipeline (minimized mode)
      setPhase('pipeline-running');
      setPipelineStatus(null);
      prevPipelineStatusRef.current = 'backlog';

      await new Promise<void>((resolve, reject) => {
        if (!mountedRef.current) { reject(); return; }
        onSimulatePipeline(
          demoTicketId!,
          (status: string) => {
            if (!mountedRef.current) return;

            // Ghost fly animation when column changes
            const prev = prevPipelineStatusRef.current;
            if (prev !== status) {
              animateGhost(prev, status);
              prevPipelineStatusRef.current = status;
            }

            setPipelineStatus(status);

            // When we reach 'review', wait for ghost to land then switch to approve phase
            if (status === 'review') {
              setTimeout(() => {
                if (mountedRef.current) setPhase('pipeline-approve');
              }, 600);
            }
            // When we reach 'approved', wait for ghost + pause so user sees it, then celebrate
            if (status === 'approved') {
              setTimeout(() => {
                if (!mountedRef.current) return;
                setPhase('pipeline-celebrate');
                resolve();
              }, 2100); // 600ms ghost + 1500ms to see ticket in approved column
            }
          },
          () => {
            // onComplete — already handled via 'approved' step
          },
        );
      });

      // Celebrate for 3.5 seconds
      await wait(3500);

      setPipelineStatus(null);
      setPhase('tutorial-complete');
    } catch { /* unmounted */ }
  };

  // ── Approve phase: show cursor → click approve button ──
  useEffect(() => {
    if (phase !== 'pipeline-approve') return;
    let cancelled = false;

    const runApprove = async () => {
      try {
        await wait(800); // Brief pause so user sees the ticket with Oui/Non
        if (cancelled) return;

        await showCursorAt(window.innerWidth / 2 - 80, window.innerHeight / 2 + 60);
        if (cancelled) return;

        await wait(200); // Small pause before moving
        if (cancelled) return;

        await moveCursorTo('[data-onboard-approve-btn]', 1500); // Move to approve button
        if (cancelled) return;

        await wait(200); // Hover pause before clicking
        if (cancelled) return;

        await doClick('[data-onboard-approve-btn]');
        hideCursor();
        // The pipeline simulation will naturally continue to 'approved'
      } catch { /* unmounted */ }
    };
    runApprove();

    return () => { cancelled = true; };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle "Suivant" clicks ──
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (step === 0) { runStep0(); return; }
    if (step === 2) { runStep1(); return; }
    setStep(s => s + 1);
  };

  // ── SVG arrows ──
  const arrowSvg = {
    up: <svg width="16" height="12" viewBox="0 0 16 12" className="text-surface drop-shadow-lg"><path d="M8 0L16 12H0z" fill="currentColor" /></svg>,
    down: <svg width="16" height="12" viewBox="0 0 16 12" className="text-surface drop-shadow-lg"><path d="M8 12L0 0h16z" fill="currentColor" /></svg>,
    left: <svg width="12" height="16" viewBox="0 0 12 16" className="text-surface drop-shadow-lg"><path d="M0 8L12 0v16z" fill="currentColor" /></svg>,
  };

  // ── Confetti particles (generated once) ──
  const confetti = useMemo(() => {
    const colors = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 2 + Math.random() * 2,
      color: colors[i % colors.length],
      rotation: Math.random() * 360,
      size: 6 + Math.random() * 6,
    }));
  }, []);

  // ── Ghost card element (shared across pipeline phases) ──
  const ghostCard = (
    <div
      ref={ghostRef}
      className="fixed z-[75] pointer-events-none bg-card/90 border rounded-xl shadow-2xl backdrop-blur-sm"
      style={{ top: 0, left: 0, opacity: 0, visibility: 'hidden', borderColor: '#94a3b866' }}
    >
      <div className="p-2.5 flex items-center gap-2">
        <div data-ghost-accent className="w-[3px] h-7 rounded-full shrink-0" style={{ backgroundColor: '#94a3b8' }} />
        <div className="flex-1 space-y-1">
          <div className="text-[10px] font-semibold text-tx-primary truncate leading-tight">{t.onboardDemoTitle}</div>
          <div className="text-[9px] font-mono text-tx-faint">#1</div>
        </div>
      </div>
    </div>
  );

  // ── Pipeline running pill ──
  if (phase === 'pipeline-running') {
    return (
      <div className="fixed inset-0 z-[70] pointer-events-none">
        <div className="absolute inset-0 bg-black/20 pointer-events-auto" />
        {ghostCard}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[73] px-5 py-2.5 bg-surface border border-amber-500/30 rounded-full shadow-2xl shadow-black/40 flex items-center gap-3 pointer-events-auto animate-[fadeSlideUp_0.4s_ease-out]">
          <span className="text-lg">🦀</span>
          <span className="text-sm font-medium text-tx-secondary">{pillText}</span>
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <style>{`
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translate(-50%, 16px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
        `}</style>
      </div>
    );
  }

  // ── Approve phase — light backdrop, cursor targets the real ticket card button ──
  if (phase === 'pipeline-approve') {
    return (
      <div className="fixed inset-0 z-[70] pointer-events-none">
        <div className="absolute inset-0 bg-black/20 pointer-events-auto" />
        {ghostCard}

        {/* Animated cursor */}
        <div
          ref={cursorRef}
          className="fixed z-[80] pointer-events-none"
          style={{
            top: 0,
            left: 0,
            opacity: cursorVisible ? 1 : 0,
            visibility: cursorVisible ? 'visible' : 'hidden',
          }}
        >
          <svg width="20" height="24" viewBox="0 0 20 24" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}>
            <path d="M5 2v18l5-5 6 7 2-2-6-7h7z" fill="white" stroke="#222" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Click ripple */}
        {clickRipple && (
          <div className="fixed z-[79] pointer-events-none" style={{ left: clickRipple.x - 20, top: clickRipple.y - 20 }}>
            <div className="w-10 h-10 rounded-full border-2 border-green-400 animate-[clickRipple_0.5s_ease-out_forwards]" />
            <div className="w-10 h-10 rounded-full border-2 border-green-400/50 animate-[clickRipple_0.5s_ease-out_0.1s_forwards] absolute inset-0" />
          </div>
        )}

        <style>{`
          @keyframes clickRipple {
            0% { transform: scale(0.5); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // ── Celebration overlay — localized to approved column ──
  if (phase === 'pipeline-celebrate') {
    const colEl = document.querySelector('[data-column="approved"]');
    const r = colEl?.getBoundingClientRect();

    return (
      <div className="fixed inset-0 z-[70] pointer-events-none">
        <div className="absolute inset-0 bg-black/15 pointer-events-auto" />

        {r && (
          <>
            {/* Confetti in approved column */}
            <div
              className="absolute overflow-hidden pointer-events-none z-[75]"
              style={{ left: r.left - 20, top: r.top, width: r.width + 40, height: r.height }}
            >
              {confetti.slice(0, 30).map(c => (
                <div
                  key={c.id}
                  className="absolute animate-[confettiFall_ease-in-out_forwards]"
                  style={{
                    left: `${c.left}%`,
                    top: -10,
                    width: c.size,
                    height: c.size * 0.6,
                    backgroundColor: c.color,
                    borderRadius: 2,
                    animationDelay: `${c.delay}s`,
                    animationDuration: `${c.duration}s`,
                    transform: `rotate(${c.rotation}deg)`,
                  }}
                />
              ))}
            </div>

            {/* Celebration card in approved column */}
            <div
              className="absolute z-[74] flex justify-center pointer-events-none"
              style={{ left: r.left, top: r.top + 70, width: r.width }}
            >
              <div className="bg-surface border border-green-500/30 rounded-xl shadow-2xl shadow-green-500/20 px-4 py-3 text-center animate-[celebrateIn_0.5s_ease-out] max-w-[90%]">
                <div className="text-3xl mb-1">🎉</div>
                <h3 className="text-sm font-bold text-tx-primary mb-1.5">{t.onboardCelebrationTitle}</h3>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400 font-mono">{t.onboardCelebrationLink}</span>
                </div>
              </div>
            </div>
          </>
        )}

        <style>{`
          @keyframes confettiFall {
            0% { opacity: 1; transform: translateY(0) rotate(0deg); }
            100% { opacity: 0; transform: translateY(${r?.height ?? 400}px) rotate(720deg); }
          }
          @keyframes celebrateIn {
            0% { opacity: 0; transform: scale(0.8) translateY(16px); }
            50% { transform: scale(1.03) translateY(-4px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // ── Tutorial complete ──
  if (phase === 'tutorial-complete') {
    return (
      <div className="fixed inset-0 z-[70]">
        <div className="absolute inset-0 bg-black/50" />
        <div className="fixed inset-0 z-[74] flex items-center justify-center p-6">
          <div className="bg-surface border border-th-border-strong rounded-2xl shadow-2xl shadow-black/50 px-8 py-7 max-w-sm w-full text-center animate-[fadeSlideIn_0.4s_ease-out]">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-lg font-bold text-tx-primary mb-2">{t.onboardCompleteTitle}</h3>
            <p className="text-sm text-tx-secondary mb-3">{t.onboardCompleteDesc}</p>
            <p className="text-xs text-tx-faint mb-2">{t.onboardFeedbackQuestion}</p>
            <div className="flex justify-center gap-1 mb-5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => { setRating(n); submitFeedback(n).catch(() => {}); }}
                  onMouseEnter={() => setHoveredStar(n)}
                  onMouseLeave={() => setHoveredStar(null)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star size={22}
                    className={n <= (hoveredStar ?? rating ?? 0)
                      ? 'text-amber-400 fill-amber-400 transition-colors'
                      : 'text-tx-ghost transition-colors'}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={onDone}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-semibold rounded-lg hover:from-amber-400 hover:to-red-400 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.97]"
            >
              {t.onboardCompleteBtn} →
            </button>
          </div>
        </div>
        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // ── Render ──
  const showNextBtn = phase === 'idle';
  const showOverlayElements = showTooltip;

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Backdrop — no click dismiss */}
      <div className={`absolute inset-0 transition-colors duration-300 ${showFakeModal ? 'bg-black/70' : 'bg-black/60'}`} />

      {/* Highlight ring + arrow — only in tooltip mode */}
      {showOverlayElements && (
        <>
          <div className="absolute rounded-xl border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] pointer-events-none transition-all duration-300 z-[71]" style={highlightStyle} />
          <div className="absolute bg-transparent z-[71] rounded-xl" style={{ ...highlightStyle, border: 'none', boxShadow: 'none' }} />
          <div className="absolute z-[73] pointer-events-none transition-all duration-300" style={arrowStyle}>{arrowSvg[arrowDirection]}</div>
        </>
      )}

      {/* Animated cursor — always in DOM, visibility toggled */}
      <div
        ref={cursorRef}
        className="fixed z-[80] pointer-events-none"
        style={{
          top: 0,
          left: 0,
          opacity: cursorVisible ? 1 : 0,
          visibility: cursorVisible ? 'visible' : 'hidden',
        }}
      >
        <svg width="20" height="24" viewBox="0 0 20 24" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}>
          <path d="M5 2v18l5-5 6 7 2-2-6-7h7z" fill="white" stroke="#222" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Click ripple */}
      {clickRipple && (
        <div className="fixed z-[79] pointer-events-none" style={{ left: clickRipple.x - 20, top: clickRipple.y - 20 }}>
          <div className="w-10 h-10 rounded-full border-2 border-green-400 animate-[clickRipple_0.5s_ease-out_forwards]" />
          <div className="w-10 h-10 rounded-full border-2 border-green-400/50 animate-[clickRipple_0.5s_ease-out_0.1s_forwards] absolute inset-0" />
        </div>
      )}

      {/* Fake CreateTicketModal */}
      {showFakeModal && (
        <div className="fixed inset-0 z-[74] flex items-center justify-center pointer-events-none">
          <div
            data-onboard-modal
            className="w-full max-w-lg bg-surface border border-th-border-strong rounded-2xl shadow-2xl shadow-black/50 p-8 animate-[fadeSlideIn_0.25s_ease-out]"
          >
            <h2 className="text-xl font-bold text-tx-primary mb-6">{t.createTitle}</h2>

            {/* Title input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-tx-secondary mb-1.5">{t.titleLabel}</label>
              <div className={`bg-subtle border rounded-lg px-4 py-2.5 text-sm text-tx-primary min-h-[40px] flex items-center transition-colors ${activeField === 'title' ? 'border-amber-500/50 shadow-[0_0_0_3px_rgba(245,158,11,0.1)]' : 'border-th-border-strong'}`}>
                {typedTitle || <span className="text-tx-faint">{t.titlePlaceholder}</span>}
                {activeField === 'title' && <span className="animate-[blink_1s_step-end_infinite] ml-0.5 text-amber-400 font-light">|</span>}
              </div>
            </div>

            {/* Description textarea */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-tx-secondary mb-1.5">{t.descriptionLabel}</label>
              <div className={`bg-subtle border rounded-lg px-4 py-2.5 text-sm text-tx-primary min-h-[80px] transition-colors ${activeField === 'desc' ? 'border-amber-500/50 shadow-[0_0_0_3px_rgba(245,158,11,0.1)]' : 'border-th-border-strong'}`}>
                {typedDesc || <span className="text-tx-faint">{t.descriptionPlaceholder}</span>}
                {activeField === 'desc' && <span className="animate-[blink_1s_step-end_infinite] ml-0.5 text-amber-400 font-light">|</span>}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 text-sm text-tx-faint rounded-lg hover:bg-subtle-hover transition-colors">{t.cancel}</button>
              <button
                data-onboard-create-btn
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-amber-500/20"
              >
                {t.create}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip card — only in idle phase */}
      {showTooltip && (
        <>
          <div
            className="absolute z-[73] w-[340px] bg-surface border border-th-border-strong rounded-2xl shadow-2xl shadow-black/50 overflow-hidden transition-all duration-300 animate-[fadeSlideIn_0.3s_ease-out]"
            style={tooltipStyle}
          >
            <div className="px-6 pt-5 pb-3 flex items-center gap-3">
              <span className="text-2xl flex items-center justify-center">{steps[step].icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {step + 1}/{steps.length}
                  </span>
                </div>
                <p className="text-sm text-tx-secondary leading-relaxed">{steps[step].text}</p>
              </div>
            </div>

            <div className="flex gap-1.5 px-6 pb-3">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === step ? 'flex-[2] bg-gradient-to-r from-amber-500 to-red-500' :
                    i < step ? 'flex-1 bg-amber-500/40' : 'flex-1 bg-subtle-hover'
                  }`}
                />
              ))}
            </div>

            <div className="px-6 pb-5 flex items-center justify-between">
              <span className="text-[11px] text-tx-faint italic">{t.onboardQuickTour}</span>
              {showNextBtn && (
                <button
                  onClick={handleNext}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-semibold rounded-lg hover:from-amber-400 hover:to-red-400 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.97]"
                >
                  {isLast ? t.onboardGo : t.onboardNext} →
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes clickRipple {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
