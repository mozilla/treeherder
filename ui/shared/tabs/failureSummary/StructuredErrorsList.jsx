import PropTypes from 'prop-types';

const formatTime = (epochMs) => {
  if (!epochMs) return '';
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace('T', ' ').replace('Z', '');
};

const levelBadgeClass = (level) => {
  const normalized = (level || '').toUpperCase();
  if (normalized === 'CRITICAL') return 'bg-danger';
  if (normalized === 'ERROR') return 'bg-warning text-dark';
  return 'bg-secondary';
};

export default function StructuredErrorsList(props) {
  const { errors } = props;

  return (
    <li className="structured-errors-list">
      <ul className="list-unstyled mt-1 mb-0">
        {errors.map((err) => (
          <li
            key={err.id}
            className="border-bottom py-1 d-flex flex-column"
            data-testid="structured-log-error"
          >
            <div className="d-flex align-items-center flex-wrap">
              <span
                className={`badge ${levelBadgeClass(err.level)} me-2`}
                title="Log level"
              >
                {(err.level || '').toUpperCase() || 'ERROR'}
              </span>
              {err.action && (
                <span className="badge bg-info text-dark me-2" title="Action">
                  {err.action}
                </span>
              )}
              {err.source && (
                <span className="text-muted me-2" title="Source">
                  {err.source}
                </span>
              )}
              {err.time && (
                <span className="text-muted me-2" title="Timestamp">
                  {formatTime(err.time)}
                </span>
              )}
              {(err.pid || err.thread) && (
                <span className="text-muted small">
                  {err.pid ? `pid ${err.pid}` : ''}
                  {err.pid && err.thread ? ' · ' : ''}
                  {err.thread || ''}
                </span>
              )}
            </div>
            <pre className="mb-0 mt-1 text-wrap text-break small">
              {err.message}
            </pre>
          </li>
        ))}
      </ul>
    </li>
  );
}

StructuredErrorsList.propTypes = {
  errors: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      action: PropTypes.string,
      time: PropTypes.number,
      thread: PropTypes.string,
      pid: PropTypes.number,
      source: PropTypes.string,
      message: PropTypes.string,
      level: PropTypes.string,
    }),
  ).isRequired,
};
