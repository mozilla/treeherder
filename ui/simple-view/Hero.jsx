import { PUSH } from './constants';
import { duration } from './helpers';
import { useCountUp, usePulse } from './hooks';
import Retrigger from './Retrigger';
import Ring from './Ring';

const RingCenter = ({ progress }) => {
  const running = progress.running;
  const pct = progress.total ? Math.floor((progress.done / progress.total) * 100) : 0;
  const n = useCountUp(running ? pct : progress.total);

  // The figure counts up every frame; screen readers get the headline instead.
  return (
    <>
      <span className="sv-ring-figure" aria-hidden="true">
        {n}
        {running && <span className="sv-ring-unit">%</span>}
      </span>
      <span className="sv-ring-label" aria-hidden="true">
        {running ? PUSH.ringDone : PUSH.ringJobs(progress.total)}
      </span>
    </>
  );
};

const Legend = ({ status }) => (
  <ul className="sv-legend">
    {Object.entries(PUSH.legend).map(([kind, label]) => {
      const n = status[kind] || 0;
      return n ? (
        <li key={kind} className={`sv-legend-${kind}`}>
          <span className="sv-legend-dot" />
          {n} {label}
        </li>
      ) : null;
    })}
  </ul>
);

const Hero = ({
  said,
  counts,
  health,
  progress,
  eta,
  error,
  push,
  repo,
  failedJobs,
  testsFailed,
}) => {
  const pulsing = usePulse(said ? said.headline : undefined);

  return (
    <section
      className={`sv-hero sv-tone-${said?.tone || 'quiet'}${pulsing ? ' sv-pulse' : ''}`}
    >
      {!error && (
        <Ring
          status={counts}
          loading={!counts}
          size="min(240px, 64vw)"
        >
          {health && <RingCenter progress={progress} />}
        </Ring>
      )}
      {said ? (
        <div className="sv-rise sv-hero-words">
          <h1 className="sv-headline" aria-live="polite">
            {said.headline}
          </h1>
          <p className="sv-sub" aria-live="polite">
            {said.sub}
          </p>
          <Legend status={counts} />
          {failedJobs.length > 0 && (
            <Retrigger jobs={failedJobs} repo={repo} />
          )}
          {failedJobs.length === 0 && testsFailed && (
            <p className="sv-elapsed">
              {PUSH.alreadyAnswered}
            </p>
          )}
          {eta && <p className="sv-eta-line">{eta.line}</p>}
          {progress.running && push && (
            <p className="sv-elapsed">{PUSH.elapsed(duration(push.push_timestamp))}</p>
          )}
        </div>
      ) : (
        !error && (
          <div className="sv-hero-words" aria-label={PUSH.reading}>
            <span className="sv-skeleton sv-skeleton-headline" />
            <span className="sv-skeleton" />
          </div>
        )
      )}
    </section>
  );
};

export default Hero;
