import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleUp, faMinus } from '@fortawesome/free-solid-svg-icons';

import { alertConfidenceLevels } from '../perf-helpers/constants';

// The Font Awesome transforms that stack one, two, or three chevrons
const chevronStacks = {
  1: [null],
  2: ['up-3', 'down-3'],
  3: ['up-6', null, 'down-6'],
};

// Shows the confidence level of an alert as a stack of chevrons
const ConfidenceChevrons = ({ level = null }) => {
  const { text = 'Unknown', chevrons, color = '#6c757d' } =
    alertConfidenceLevels[level] ?? {};

  return (
    <span
      className="fa-layers fa-fw"
      style={{ color }}
      role="img"
      aria-label={`${text} confidence`}
      data-testid="alert-confidence"
    >
      {chevrons ? (
        chevronStacks[chevrons].map((transform, index) => (
          <FontAwesomeIcon key={index} icon={faAngleUp} transform={transform} />
        ))
      ) : (
        <FontAwesomeIcon icon={faMinus} />
      )}
    </span>
  );
};

ConfidenceChevrons.propTypes = {
  level: PropTypes.string,
};

export default ConfidenceChevrons;
