import PropTypes from 'prop-types';

import { NO_GROUP } from '../../../../helpers/testSummary';

// The tests behind one count of the summary line (see listTestsByOutcome), by
// manifest. A test comes with what the artifact says of it: why it was
// skipped, or the statuses that made it a known intermittent.
const TestOutcomeList = ({ id, title, groups }) => (
  <section
    id={id}
    aria-labelledby={`${id}-title`}
    className="border-bottom mb-2 pb-2"
  >
    <h3
      id={`${id}-title`}
      className="failure-summary-line-empty font-size-12 fw-bold mb-0"
    >
      {title}
    </h3>
    <ul className="list-unstyled mb-0">
      {groups.map((group) => (
        <li key={group.name}>
          {/* Tests with no manifest (web-platform-tests) need no heading. */}
          {group.name !== NO_GROUP && (
            <p className="failure-summary-line-empty fw-bold mb-0 mt-1">
              {group.name}{' '}
              <span className="fw-normal text-muted">
                ({group.tests.length})
              </span>
            </p>
          )}
          <ul className="list-unstyled mb-0">
            {group.tests.map((test, index) => (
              <li
                key={`${test.name}-${index}`} // eslint-disable-line react/no-array-index-key
                className="failure-summary-line-empty text-break"
              >
                {test.name}
                {test.details.length > 0 && (
                  <span className="text-muted">
                    {' — '}
                    {test.details.join('; ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  </section>
);

TestOutcomeList.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  groups: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      tests: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string.isRequired,
          details: PropTypes.arrayOf(PropTypes.string).isRequired,
        }),
      ).isRequired,
    }),
  ).isRequired,
};

export default TestOutcomeList;
