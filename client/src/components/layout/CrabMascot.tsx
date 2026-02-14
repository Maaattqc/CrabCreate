import { useMemo } from 'react';
import type { Ticket } from '../../types';

interface CrabMascotProps {
  tickets: Ticket[];
}

type CrabState = 'sleeping' | 'idle' | 'coding' | 'reviewing' | 'testing' | 'deploying' | 'approved' | 'rejected' | 'error';

function deriveCrabState(tickets: Ticket[]): CrabState {
  if (!tickets || tickets.length === 0) return 'sleeping';

  const statuses = tickets.map(t => t.status);
  if (statuses.some(s => s === 'ai_coding')) return 'coding';
  if (statuses.some(s => s === 'ai_review')) return 'reviewing';
  if (statuses.some(s => s === 'testing')) return 'testing';
  if (statuses.some(s => s === 'deploying')) return 'deploying';
  if (statuses.some(s => s === 'estimating' || s === 'queued')) return 'idle';

  // Check recent results
  const hasApproved = statuses.includes('approved');
  const hasRejected = statuses.includes('rejected');
  if (hasRejected && !hasApproved) return 'rejected';
  if (hasApproved) return 'approved';

  return 'sleeping';
}

const STATE_LABELS: Record<CrabState, string> = {
  sleeping: 'zzZ',
  idle: '...',
  coding: '< / >',
  reviewing: '🔍',
  testing: '🤞',
  deploying: '🚀',
  approved: '🎉',
  rejected: '😢',
  error: '⚠️',
};

export default function CrabMascot({ tickets }: CrabMascotProps) {
  const state = useMemo(() => deriveCrabState(tickets), [tickets]);

  const eyeStyle = useMemo(() => {
    switch (state) {
      case 'sleeping': return { left: 'closed', right: 'closed' };
      case 'coding': return { left: 'focused', right: 'focused' };
      case 'reviewing': return { left: 'squint', right: 'open' };
      case 'testing': return { left: 'worried', right: 'worried' };
      case 'deploying': return { left: 'excited', right: 'excited' };
      case 'approved': return { left: 'happy', right: 'happy' };
      case 'rejected': return { left: 'sad', right: 'sad' };
      case 'error': return { left: 'panic', right: 'panic' };
      default: return { left: 'open', right: 'open' };
    }
  }, [state]);

  const bodyClass = `crab-body crab-${state}`;

  return (
    <div className="fixed bottom-5 right-5 z-40 select-none pointer-events-none" style={{ width: 120, height: 120 }}>
      {/* Floating label */}
      <div className="crab-label absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-mono text-tx-faint whitespace-nowrap">
        {STATE_LABELS[state]}
      </div>

      <svg viewBox="0 0 100 100" width="120" height="120" className={bodyClass}>
        {/* Legs (3 per side) */}
        <g className="crab-legs">
          {/* Left legs */}
          <line x1="25" y1="60" x2="8" y2="72" stroke="#ef8a4a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="22" y1="65" x2="6" y2="80" stroke="#ef8a4a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="22" y1="70" x2="10" y2="86" stroke="#ef8a4a" strokeWidth="2.5" strokeLinecap="round" />
          {/* Right legs */}
          <line x1="75" y1="60" x2="92" y2="72" stroke="#ef8a4a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="78" y1="65" x2="94" y2="80" stroke="#ef8a4a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="78" y1="70" x2="90" y2="86" stroke="#ef8a4a" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Left claw arm */}
        <g className="crab-claw-left">
          <line x1="22" y1="48" x2="8" y2="32" stroke="#ef8a4a" strokeWidth="3" strokeLinecap="round" />
          {/* Claw */}
          <ellipse cx="6" cy="27" rx="7" ry="5" fill="#f59e0b" stroke="#ef8a4a" strokeWidth="1.5" />
          <line x1="2" y1="23" x2="6" y2="27" stroke="#ef8a4a" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Right claw arm */}
        <g className="crab-claw-right">
          <line x1="78" y1="48" x2="92" y2="32" stroke="#ef8a4a" strokeWidth="3" strokeLinecap="round" />
          {/* Claw */}
          <ellipse cx="94" cy="27" rx="7" ry="5" fill="#f59e0b" stroke="#ef8a4a" strokeWidth="1.5" />
          <line x1="98" y1="23" x2="94" y2="27" stroke="#ef8a4a" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Shell/body */}
        <ellipse cx="50" cy="58" rx="30" ry="22" fill="url(#crabGrad)" stroke="#ef8a4a" strokeWidth="2" />

        {/* Shell pattern */}
        <path d="M 35 50 Q 50 40 65 50" fill="none" stroke="#d97706" strokeWidth="1" opacity="0.3" />
        <path d="M 30 58 Q 50 46 70 58" fill="none" stroke="#d97706" strokeWidth="1" opacity="0.3" />

        {/* Blush */}
        <ellipse cx="35" cy="64" rx="5" ry="3" fill="#fca5a5" opacity="0.4" />
        <ellipse cx="65" cy="64" rx="5" ry="3" fill="#fca5a5" opacity="0.4" />

        {/* Eyes */}
        <g className="crab-eyes">
          {/* Eye stalks */}
          <line x1="40" y1="42" x2="38" y2="32" stroke="#ef8a4a" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="60" y1="42" x2="62" y2="32" stroke="#ef8a4a" strokeWidth="2.5" strokeLinecap="round" />

          {/* Left eye */}
          <circle cx="38" cy="29" r="6" fill="white" stroke="#ef8a4a" strokeWidth="1.5" />
          {eyeStyle.left === 'closed' ? (
            <line x1="34" y1="29" x2="42" y2="29" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          ) : eyeStyle.left === 'happy' ? (
            <path d="M 34 28 Q 38 24 42 28" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          ) : eyeStyle.left === 'sad' ? (
            <path d="M 34 30 Q 38 34 42 30" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          ) : eyeStyle.left === 'squint' ? (
            <>
              <line x1="34" y1="28" x2="42" y2="30" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="38" cy="29" r="3" fill="#1f2937" />
              <circle cx="39.5" cy="27.5" r="1" fill="white" />
            </>
          )}

          {/* Right eye */}
          <circle cx="62" cy="29" r="6" fill="white" stroke="#ef8a4a" strokeWidth="1.5" />
          {eyeStyle.right === 'closed' ? (
            <line x1="58" y1="29" x2="66" y2="29" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          ) : eyeStyle.right === 'happy' ? (
            <path d="M 58 28 Q 62 24 66 28" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          ) : eyeStyle.right === 'sad' ? (
            <path d="M 58 30 Q 62 34 66 30" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <>
              <circle cx="62" cy="29" r="3" fill="#1f2937" />
              <circle cx="63.5" cy="27.5" r="1" fill="white" />
            </>
          )}
        </g>

        {/* Mouth */}
        {state === 'approved' && <path d="M 44 68 Q 50 74 56 68" fill="none" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" />}
        {state === 'rejected' && <path d="M 44 70 Q 50 66 56 70" fill="none" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" />}
        {state === 'error' && <circle cx="50" cy="69" r="3" fill="none" stroke="#1f2937" strokeWidth="1.5" />}
        {state === 'coding' && <line x1="45" y1="68" x2="55" y2="68" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" />}

        {/* Tear drop for rejected */}
        {state === 'rejected' && (
          <ellipse cx="66" cy="38" rx="2" ry="3" fill="#60a5fa" opacity="0.7" className="crab-tear" />
        )}

        {/* Sweat for testing */}
        {state === 'testing' && (
          <ellipse cx="70" cy="24" rx="2" ry="3" fill="#60a5fa" opacity="0.5" className="crab-sweat" />
        )}

        {/* Sparkles for deploying/approved */}
        {(state === 'deploying' || state === 'approved') && (
          <g className="crab-sparkles">
            <text x="15" y="20" fontSize="8" className="crab-sparkle-1">✨</text>
            <text x="78" y="16" fontSize="7" className="crab-sparkle-2">✨</text>
            <text x="50" y="12" fontSize="6" className="crab-sparkle-3">⭐</text>
          </g>
        )}

        {/* Exclamation for error */}
        {state === 'error' && (
          <g className="crab-alert">
            <text x="42" y="16" fontSize="14" fontWeight="bold" fill="#ef4444">!!</text>
          </g>
        )}

        {/* Gradient definition */}
        <defs>
          <radialGradient id="crabGrad" cx="45%" cy="40%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
