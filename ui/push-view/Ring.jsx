// A push drawn as a ring of jobs: failures first from twelve o'clock, then
// passes, then whatever is still running and waiting. Each tick is a share of
// the push's jobs, so a glance gives the shape of the whole thing.

import { finishedCount } from './helpers';

const BAD_RESULTS = ['testfailed', 'busted', 'exception'];

// Split `ticks` across the categories in proportion to their job counts,
// giving any non-empty category at least one tick (largest remainder).
export const allocateTicks = (status, ticks) => {
  const bad = BAD_RESULTS.reduce((n, r) => n + (status?.[r] || 0), 0);
  const good = status?.success || 0;
  const other = Math.max(0, finishedCount(status) - bad - good);
  const running = status?.running || 0;
  const pending = (status?.pending || 0) + (status?.unscheduled || 0);
  const parts = [
    ['bad', bad],
    ['good', good],
    ['other', other],
    ['running', running],
    ['pending', pending],
  ];
  const total = parts.reduce((n, [, c]) => n + c, 0);
  if (!total) return Array(ticks).fill('pending');

  const nonEmpty = parts.filter(([, c]) => c > 0);
  const spare = ticks - nonEmpty.length;
  const shares = nonEmpty.map(([kind, c]) => {
    const exact = (c / total) * spare;
    return { kind, n: 1 + Math.floor(exact), rest: exact % 1 };
  });
  let left = ticks - shares.reduce((n, s) => n + s.n, 0);
  for (const s of [...shares].sort((a, b) => b.rest - a.rest)) {
    if (left-- <= 0) break;
    s.n += 1;
  }
  return shares.flatMap((s) => Array(s.n).fill(s.kind));
};

const Ring = ({ status, ticks = 90, size = 240, weight = 3, loading, children }) => {
  const kinds = loading ? Array(ticks).fill('loading') : allocateTicks(status, ticks);
  const outer = 96;
  const inner = outer - Math.max(14, 1200 / ticks / 2);

  return (
    <div className="pv-ring" style={{ width: size, height: size }}>
      <svg viewBox="-100 -100 200 200" aria-hidden="true">
        {kinds.map((kind, i) => {
          const a = (i / ticks) * 2 * Math.PI - Math.PI / 2;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          return (
            <line
              // Ticks keep their slot, so a job changing state recolours in
              // place instead of the ring redrawing.
              key={i}
              className={`pv-tick pv-tick-${kind}`}
              x1={cos * inner}
              y1={sin * inner}
              x2={cos * outer}
              y2={sin * outer}
              strokeWidth={weight}
              style={{
                '--in': `${i * (700 / ticks)}ms`,
                '--wave': `${(i / ticks) * 2.4}s`,
              }}
            />
          );
        })}
      </svg>
      {children && <div className="pv-ring-center">{children}</div>}
    </div>
  );
};

export default Ring;
