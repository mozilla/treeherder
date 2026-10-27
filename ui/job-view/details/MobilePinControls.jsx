import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faThumbtack,
} from '@fortawesome/free-solid-svg-icons';

import {
  usePinnedJobsStore,
  pinJob,
  unPinJob,
  setPinBoardVisible,
} from '../../shared/stores/pinnedJobsStore';

function MobilePinControls({ job }) {
  const isPinned = usePinnedJobsStore((state) => !!state.pinnedJobs[job.id]);
  const pinnedCount = usePinnedJobsStore(
    (state) => Object.keys(state.pinnedJobs).length,
  );
  const isPinBoardVisible = usePinnedJobsStore(
    (state) => state.isPinBoardVisible,
  );

  const togglePinned = () => {
    if (isPinned) {
      unPinJob(job);
    } else {
      pinJob(job);
      // Stay on the job so several jobs can be pinned in a row.
      setPinBoardVisible(false);
    }
  };

  return (
    <div className="mobile-pin-controls">
      <button
        type="button"
        className={`mobile-sheet-action ${isPinned ? 'is-pinned' : ''}`}
        aria-pressed={isPinned}
        aria-label={isPinned ? 'Unpin job' : 'Pin job'}
        title={isPinned ? 'Unpin job' : 'Pin job'}
        onClick={togglePinned}
      >
        <FontAwesomeIcon icon={faThumbtack} />
      </button>
      {pinnedCount > 0 && (
        <button
          type="button"
          className="mobile-sheet-action mobile-pinboard-toggle"
          aria-pressed={isPinBoardVisible}
          aria-label={`${isPinBoardVisible ? 'Hide' : 'Show'} pinboard (${pinnedCount} pinned)`}
          onClick={() => setPinBoardVisible(!isPinBoardVisible)}
        >
          <span className="badge rounded-pill text-bg-secondary">
            {pinnedCount}
          </span>
          <FontAwesomeIcon
            icon={isPinBoardVisible ? faCaretUp : faCaretDown}
            className="ms-1"
          />
        </button>
      )}
    </div>
  );
}

MobilePinControls.propTypes = {
  job: PropTypes.shape({
    id: PropTypes.number.isRequired,
  }).isRequired,
};

export default MobilePinControls;
