import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons';

const NO_TEST_KEY = '__no_test__';
const NO_TEST_LABEL = 'Other errors';

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

const groupByTest = (errors) => {
  const order = [];
  const buckets = new Map();
  errors.forEach((err) => {
    const key = err.test ? err.test : NO_TEST_KEY;
    if (!buckets.has(key)) {
      order.push(key);
      buckets.set(key, []);
    }
    buckets.get(key).push(err);
  });
  return order.map((key) => ({
    key,
    label: key === NO_TEST_KEY ? NO_TEST_LABEL : key,
    errors: buckets.get(key),
  }));
};

const ErrorRow = ({ err }) => (
  <li
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
    <pre className="mb-0 mt-1 text-wrap text-break small">{err.message}</pre>
  </li>
);

ErrorRow.propTypes = {
  err: PropTypes.shape({
    id: PropTypes.number.isRequired,
    action: PropTypes.string,
    time: PropTypes.number,
    thread: PropTypes.string,
    pid: PropTypes.number,
    source: PropTypes.string,
    message: PropTypes.string,
    level: PropTypes.string,
    test: PropTypes.string,
  }).isRequired,
};

export default function StructuredErrorsList(props) {
  const { errors } = props;
  const groups = useMemo(() => groupByTest(errors), [errors]);
  const [expanded, setExpanded] = useState(() => new Set());

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <li className="structured-errors-list">
      <ul className="list-unstyled mt-1 mb-0">
        {groups.map((group) => {
          const isOpen = expanded.has(group.key);
          return (
            <li
              key={group.key}
              className="border-bottom"
              data-testid="structured-log-test-group"
            >
              <button
                type="button"
                className="btn btn-link text-start text-decoration-none w-100 d-flex align-items-center py-1 px-0"
                aria-expanded={isOpen}
                onClick={() => toggle(group.key)}
                data-testid="structured-log-test-toggle"
              >
                <FontAwesomeIcon
                  icon={isOpen ? faChevronDown : faChevronRight}
                  className="me-2"
                  fixedWidth
                />
                <span className="text-break flex-grow-1">{group.label}</span>
                <span
                  className="badge bg-secondary ms-2"
                  title="Number of errors"
                >
                  {group.errors.length}
                </span>
              </button>
              {isOpen && (
                <ul className="list-unstyled ms-4 mb-0">
                  {group.errors.map((err) => (
                    <ErrorRow key={err.id} err={err} />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
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
      test: PropTypes.string,
    }),
  ).isRequired,
};
