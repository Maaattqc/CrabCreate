export default function SkeletonBoard() {
  return (
    <div className="flex-1 flex gap-3 px-3 py-4 overflow-hidden">
      {Array.from({ length: 7 }).map((_, col) => (
        <div key={col} className="flex-1 min-w-[120px] space-y-3">
          {/* Column header skeleton */}
          <div className="flex items-center gap-2 px-1.5">
            <div className="ai-skeleton w-6 h-6 rounded-md" />
            <div className="ai-skeleton h-4 flex-1 rounded" />
          </div>
          <div className="ai-skeleton h-[2px] mx-1.5 rounded-full" />

          {/* Card skeletons */}
          {Array.from({ length: col < 2 ? 3 : col < 4 ? 2 : 1 }).map((_, card) => (
            <div key={card} className="p-3.5 rounded-xl border border-th-border space-y-2.5" style={{ animationDelay: `${(col * 3 + card) * 0.1}s` }}>
              <div className="ai-skeleton h-4 w-4/5 rounded" />
              <div className="ai-skeleton h-3 w-3/5 rounded" />
              <div className="flex items-center gap-2 pt-1">
                <div className="ai-skeleton w-6 h-6 rounded-md" />
                <div className="flex-1" />
                <div className="ai-skeleton w-10 h-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
