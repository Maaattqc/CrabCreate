import { useEffect } from 'react';
import type { RemoteCursor } from '../../types';

interface LiveCursorsProps {
  cursors: RemoteCursor[];
  sendCursorMove: (x: number, y: number) => void;
  sendCursorLeave: () => void;
}

function getInitial(email: string): string {
  return (email[0] || '?').toUpperCase();
}

export default function LiveCursors({ cursors, sendCursorMove, sendCursorLeave }: LiveCursorsProps) {
  // Track local mouse and emit page-relative pixel coordinates
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      sendCursorMove(e.pageX, e.pageY);
    };

    const handleMouseLeave = () => {
      sendCursorLeave();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) sendCursorLeave();
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sendCursorMove, sendCursorLeave]);

  if (cursors.length === 0) return null;

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-[9999]" style={{ minHeight: '100vh' }}>
      {cursors.map(cursor => (
        <div
          key={cursor.userId}
          className="absolute"
          style={{
            left: cursor.x,
            top: cursor.y,
            transition: 'left 150ms cubic-bezier(0.16, 1, 0.3, 1), top 150ms cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'left, top',
          }}
        >
          {/* SVG cursor arrow */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="drop-shadow-md"
          >
            <path
              d="M5.65 2.65L16.47 10.18L10.53 11.08L7.65 16.87L5.65 2.65Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          {/* Badge with initial */}
          <div
            className="absolute left-4 top-4 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg whitespace-nowrap"
            style={{ backgroundColor: cursor.color }}
          >
            {getInitial(cursor.email)}
          </div>
        </div>
      ))}
    </div>
  );
}
