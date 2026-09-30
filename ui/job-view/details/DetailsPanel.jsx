import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';

import {
  usePinnedJobsStore,
  setPinBoardVisible,
} from '../../shared/stores/pinnedJobsStore';
import { useSelectedJobStore } from '../../shared/stores/selectedJobStore';
import { usePushesStore } from '../../shared/stores/pushesStore';

import PinBoard from './PinBoard';
import SummaryPanel from './summary/SummaryPanel';
import TabsPanel from './tabs/TabsPanel';
import useJobDetails from './useJobDetails';

function DetailsPanel({
  user,
  currentRepo,
  resizedHeight,
  mobile = false,
  classificationMap,
  classificationTypes,
  frameworks = [],
}) {
  const pushList = usePushesStore((state) => state.pushList);
  // Subscribe to Zustand stores for reactive updates
  const selectedJob = useSelectedJobStore((state) => state.selectedJob);
  const isPinBoardVisible = usePinnedJobsStore(
    (state) => state.isPinBoardVisible,
  );
  const [summaryOpen, setSummaryOpen] = useState(false);

  const {
    selectedJobFull,
    jobDetails,
    jobLogUrls,
    jobDetailLoading,
    jobArtifactsLoading,
    logViewerUrl,
    logViewerFullUrl,
    perfJobDetail,
    jobRevision,
    logParseStatus,
    classifications,
    testGroups,
    bugs,
    taskExpired,
  } = useJobDetails(selectedJob, currentRepo, pushList, frameworks);

  const togglePinBoardVisibility = useCallback(() => {
    setPinBoardVisible(!isPinBoardVisible);
  }, [isPinBoardVisible]);

  return (
    <div
      id="details-panel"
      style={{ height: mobile ? '100%' : `${resizedHeight}px` }}
      className={`details-panel-slide ${mobile && isPinBoardVisible ? 'mobile-pinboard-visible' : ''}`}
    >
      {mobile && isPinBoardVisible && (
        <button
          className="btn btn-link mobile-pinboard-back"
          type="button"
          onClick={() => setPinBoardVisible(false)}
        >
          Back to job
        </button>
      )}
      <PinBoard
        mobile={mobile}
        currentRepo={currentRepo}
        isLoggedIn={user.isLoggedIn || false}
        isStaff={user.isStaff || false}
        classificationTypes={classificationTypes}
        selectedJobFull={selectedJobFull}
      />
      <div
        id="details-panel-content"
        className={mobile && summaryOpen ? 'mobile-summary-open' : undefined}
      >
        {mobile && (
          <button
            type="button"
            className={`mobile-summary-toggle ${summaryOpen ? 'is-open' : ''}`}
            aria-controls="summary-panel"
            aria-expanded={summaryOpen}
            aria-label={summaryOpen ? 'Hide job summary' : 'Show job summary'}
            onClick={() => setSummaryOpen((open) => !open)}
          >
            <FontAwesomeIcon
              icon={summaryOpen ? faChevronLeft : faChevronRight}
            />
          </button>
        )}
        {(jobDetailLoading || jobArtifactsLoading) && (
          <div className="overlay">
            <div>
              <FontAwesomeIcon
                icon={faSpinner}
                pulse
                className="th-spinner-lg"
                title="Loading..."
              />
            </div>
          </div>
        )}
        <SummaryPanel
          hiddenOnMobile={mobile && !summaryOpen}
          selectedJobFull={selectedJobFull}
          currentRepo={currentRepo}
          classificationMap={classificationMap}
          jobLogUrls={jobLogUrls}
          logParseStatus={logParseStatus}
          jobDetails={jobDetails}
          latestClassification={
            classifications.length
              ? classifications[classifications.length - 1]
              : null
          }
          logViewerUrl={logViewerUrl}
          logViewerFullUrl={logViewerFullUrl}
          bugs={bugs}
          user={user}
          taskExpired={taskExpired}
        />
        <span className="job-tabs-divider" />
        <TabsPanel
          selectedJob={selectedJob}
          selectedJobFull={selectedJobFull}
          currentRepo={currentRepo}
          jobDetails={jobDetails}
          jobArtifactsLoading={jobArtifactsLoading}
          perfJobDetail={perfJobDetail}
          repoName={currentRepo?.name}
          jobRevision={jobRevision}
          suggestions={[]}
          errors={undefined}
          bugSuggestionsLoading={false}
          logParseStatus={logParseStatus}
          classifications={classifications}
          classificationMap={classificationMap}
          jobLogUrls={jobLogUrls}
          bugs={bugs}
          togglePinBoardVisibility={togglePinBoardVisibility}
          logViewerFullUrl={logViewerFullUrl}
          testGroups={testGroups}
        />
      </div>
      <div id="clipboard-container">
        <textarea id="clipboard" />
      </div>
    </div>
  );
}

DetailsPanel.propTypes = {
  currentRepo: PropTypes.shape({
    name: PropTypes.string,
    tc_root_url: PropTypes.string,
  }),
  user: PropTypes.shape({
    isLoggedIn: PropTypes.bool,
    isStaff: PropTypes.bool,
  }).isRequired,
  resizedHeight: PropTypes.number.isRequired,
  mobile: PropTypes.bool,
  classificationTypes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  classificationMap: PropTypes.shape({}).isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})),
};

export default DetailsPanel;
