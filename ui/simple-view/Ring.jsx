
import { finishedCount } from './helpers';

const ORDER = [
  'testfailed',
  'busted',
  'exception',
  'success',
  'retry',
  'usercancel',
  'superseded',
  'other',
  'running',
  'pending',
  'unscheduled',
];
const NAMED = new Set(ORDER.slice(0, 7));

export const allocateTicks = (status, ticks) => {
  const counts = Object.fromEntries(ORDER.map((k) => [k, status?.[k] || 0]));
  counts.other = Math.max(
    0,
    finishedCount(status) -
      ORDER.filter((k) => NAMED.has(k)).reduce((n, k) => n + counts[k], 0),
  );
  const parts = ORDER.map((k) => [k, counts[k]]);
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
    <div className="sv-ring" style={{ width: size, height: size }}>
      <svg viewBox="-100 -100 200 200" aria-hidden="true">
        {kinds.map((kind, i) => {
          const a = (i / ticks) * 2 * Math.PI - Math.PI / 2;
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          return (
            <line
              key={i}
              className={`sv-tick sv-tick-${kind}`}
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
      {children && <div className="sv-ring-center">{children}</div>}
    </div>
  );
};

export default Ring;
