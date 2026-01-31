import { useCallback } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { setPinBoardVisible } from '../redux/stores/pinnedJobs';

import PinBoard from './PinBoard';
import SummaryPanel from './summary/SummaryPanel';
import TabsPanel from './tabs/TabsPanel';
import useJobDetails from './useJobDetails';

function DetailsPanel({
  user,
  currentRepo,
  resizedHeight,
  classificationMap,
  classificationTypes,
  selectedJob = null,
  pushList,
  isPinBoardVisible,
  setPinBoardVisible: setPinBoardVisibleAction,
  frameworks = [],
}) {
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
  } = useJobDetails(selectedJob, currentRepo, pushList, frameworks);

  const togglePinBoardVisibility = useCallback(() => {
    setPinBoardVisibleAction(!isPinBoardVisible);
  }, [setPinBoardVisibleAction, isPinBoardVisible]);

  return (
    <div
      id="details-panel"
      style={{ height: `${resizedHeight}px` }}
      className={selectedJobFull ? 'details-panel-slide' : 'hidden'}
    >
      <PinBoard
        currentRepo={currentRepo}
        isLoggedIn={user.isLoggedIn || false}
        isStaff={user.isStaff || false}
        classificationTypes={classificationTypes}
        selectedJobFull={selectedJobFull}
      />
      {!!selectedJobFull && !!selectedJob && (
        <div id="details-panel-content">
          <SummaryPanel
            selectedJobFull={selectedJobFull}
            currentRepo={currentRepo}
            classificationMap={classificationMap}
            jobLogUrls={jobLogUrls}
            logParseStatus={logParseStatus}
            jobDetails={jobDetails}
            jobDetailLoading={jobDetailLoading}
            latestClassification={
              classifications.length
                ? classifications[classifications.length - 1]
                : null
            }
            logViewerUrl={logViewerUrl}
            logViewerFullUrl={logViewerFullUrl}
            bugs={bugs}
            user={user}
          />
          <span className="job-tabs-divider" />
          <TabsPanel
            selectedJob={selectedJob}
            selectedJobFull={selectedJobFull}
            currentRepo={currentRepo}
            jobDetails={jobDetails}
            jobArtifactsLoading={jobArtifactsLoading}
            perfJobDetail={perfJobDetail}
            repoName={currentRepo.name}
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
      )}
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
  }).isRequired,
  user: PropTypes.shape({
    isLoggedIn: PropTypes.bool,
    isStaff: PropTypes.bool,
  }).isRequired,
  resizedHeight: PropTypes.number.isRequired,
  classificationTypes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  classificationMap: PropTypes.shape({}).isRequired,
  setPinBoardVisible: PropTypes.func.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  pushList: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  selectedJob: PropTypes.shape({
    id: PropTypes.number,
    push_id: PropTypes.number,
    task_id: PropTypes.string,
    retry_id: PropTypes.number,
    state: PropTypes.string,
    result: PropTypes.string,
    failure_classification_id: PropTypes.number,
    hasSideBySide: PropTypes.bool,
  }),
  frameworks: PropTypes.arrayOf(PropTypes.shape({})),
};

const mapStateToProps = ({
  selectedJob: { selectedJob },
  pushes: { pushList },
  pinnedJobs: { isPinBoardVisible },
}) => ({ selectedJob, pushList, isPinBoardVisible });

export default connect(mapStateToProps, { setPinBoardVisible })(DetailsPanel);
