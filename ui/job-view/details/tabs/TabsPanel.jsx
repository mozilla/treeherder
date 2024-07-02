import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button } from 'reactstrap';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleDown,
  faAngleUp,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

import { thEvents } from '../../../helpers/constants';
import JobArtifacts from '../../../shared/JobArtifacts';
import JobTestGroups from '../JobTestGroups';
import { clearSelectedJob } from '../../redux/stores/selectedJob';
import { pinJob, addBug, updatePinnedJob } from '../../redux/stores/pinnedJobs';
import FailureSummaryTab from '../../../shared/tabs/failureSummary/FailureSummaryTab';

import PerformanceTab from './PerformanceTab';
import AnnotationsTab from './AnnotationsTab';
import SimilarJobsTab from './SimilarJobsTab';

const showTabsFromProps = (props) => {
  const { perfJobDetail } = props;
  return {
    showPerf: !!perfJobDetail.length,
  };
};

class TabsPanel extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      tabIndex: 0,
      enableTestGroupsTab: false,
    };

    this.handleEnableTestGroupsTab = this.handleEnableTestGroupsTab.bind(this);
  }

  static getDerivedStateFromProps(props, state) {
    const { perfJobDetail, selectedJobFull } = props;

    // This fires every time the props change.  But we only want to figure out the new default
    // tab when we get a new job.  However, the job could change, then later, the perf details fetch
    // returns.  So we need to check for a change in the size of the perfJobDetail too.
    if (
      state.jobId !== selectedJobFull.id ||
      state.perfJobDetailSize !== perfJobDetail.length
    ) {
      const tabIndex = TabsPanel.getDefaultTabIndex(
        selectedJobFull.resultStatus,
        props,
      );

      return {
        tabIndex,
        // Every time we select a different job we need to let the component
        // let us know if we should enable the tab
        enableTestGroupsTab: false,
        jobId: selectedJobFull.id,
        perfJobDetailSize: perfJobDetail.length,
      };
    }
    return {};
  }

  componentDidMount() {
    window.addEventListener(thEvents.selectNextTab, this.onSelectNextTab);
  }

  componentWillUnmount() {
    window.removeEventListener(thEvents.selectNextTab, this.onSelectNextTab);
  }

  onSelectNextTab = () => {
    const { tabIndex } = this.state;
    const nextIndex = tabIndex + 1;
    const tabCount = TabsPanel.getTabNames(showTabsFromProps(this.props))
      .length;
    this.setState({ tabIndex: nextIndex < tabCount ? nextIndex : 0 });
  };

  static getDefaultTabIndex(status, props) {
    const { showPerf } = showTabsFromProps(props);
    let idx = 0;
    const tabNames = TabsPanel.getTabNames({ showPerf });
    const tabIndexes = tabNames.reduce(
      (acc, name) => ({ ...acc, [name]: idx++ }),
      {},
    );

    let tabIndex = showPerf ? tabIndexes.perf : tabIndexes.artifacts;
    if (['busted', 'testfailed', 'exception'].includes(status)) {
      tabIndex = tabIndexes.failure;
    }
    return tabIndex;
  }

  static getTabNames({ showPerf }) {
    // The order in here has to match the order within the render method
    return [
      'artifacts',
      'failure',
      'annotations',
      'similar',
      'perf',
      'test-groups',
    ].filter((name) => !(name === 'perf' && !showPerf));
  }

  handleEnableTestGroupsTab = (stateOfTab) => {
    this.setState({ enableTestGroupsTab: stateOfTab });
  };

  setTabIndex = (tabIndex) => {
    this.setState({ tabIndex });
  };

  render() {
    const {
      jobArtifactsLoading,
      jobDetails,
      jobLogUrls,
      logParseStatus,
      bugs,
      perfJobDetail,
      jobRevision,
      classifications,
      togglePinBoardVisibility,
      isPinBoardVisible,
      pinnedJobs,
      classificationMap,
      logViewerFullUrl,
      clearSelectedJob,
      selectedJobFull,
      currentRepo,
      pinJob,
      addBug,
      taskId,
      rootUrl,
      initializeGlean,
      updatePinnedJob,
    } = this.props;
    const { enableTestGroupsTab, tabIndex } = this.state;
    const countPinnedJobs = Object.keys(pinnedJobs).length;
    const { showPerf } = showTabsFromProps(this.props);

    return (
      <div id="tabs-panel" role="region" aria-label="Job">
        <Tabs
          selectedTabClassName="selected-tab"
          selectedIndex={tabIndex}
          onSelect={this.setTabIndex}
        >
          <TabList className="tab-headers">
            <span className="tab-header-tabs">
              <Tab>Artifacts and Debugging Tools</Tab>
              <Tab>Failure Summary</Tab>
              <Tab>Annotations</Tab>
              <Tab>Similar Jobs</Tab>
              {showPerf && <Tab>Performance</Tab>}
              {enableTestGroupsTab ? (
                <Tab>Test Groups</Tab>
              ) : (
                <Tab disabled>Test Groups</Tab>
              )}
            </span>
            <span
              id="tab-header-buttons"
              className="details-panel-controls pull-right"
            >
              <Button
                id="pinboard-btn"
                className="btn pinboard-btn-text"
                onClick={togglePinBoardVisibility}
                title={
                  isPinBoardVisible ? 'Close the pinboard' : 'Open the pinboard'
                }
              >
                PinBoard
                {!!countPinnedJobs && (
                  <div
                    id="pin-count-group"
                    title={`You have ${countPinnedJobs} job${
                      countPinnedJobs > 1 ? 's' : ''
                    } pinned`}
                    className={`${
                      countPinnedJobs > 99 ? 'pin-count-group-3-digit' : ''
                    }`}
                  >
                    <div
                      className={`pin-count-text ${
                        countPinnedJobs > 99 ? 'pin-count-group-3-digit' : ''
                      }`}
                    >
                      {countPinnedJobs}
                    </div>
                  </div>
                )}
                <FontAwesomeIcon
                  icon={isPinBoardVisible ? faAngleDown : faAngleUp}
                  title={isPinBoardVisible ? 'expand' : 'collapse'}
                  className="ml-1"
                />
              </Button>
              <Button
                onClick={() => clearSelectedJob(countPinnedJobs)}
                className="btn details-panel-close-btn bg-transparent border-0"
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faTimes} title="Close" />
              </Button>
            </span>
          </TabList>
          <TabPanel>
            <JobArtifacts
              jobDetails={jobDetails}
              jobArtifactsLoading={jobArtifactsLoading}
              repoName={currentRepo.name}
              selectedJob={selectedJobFull}
            />
          </TabPanel>
          <TabPanel>
            <FailureSummaryTab
              selectedJob={selectedJobFull}
              jobLogUrls={jobLogUrls}
              logParseStatus={logParseStatus}
              logViewerFullUrl={logViewerFullUrl}
              addBug={addBug}
              pinJob={pinJob}
              updatePinnedJob={updatePinnedJob}
              repoName={currentRepo.name}
              initializeGlean={initializeGlean}
              fontSize="font-size-11"
            />
          </TabPanel>
          <TabPanel>
            <AnnotationsTab
              classificationMap={classificationMap}
              classifications={classifications}
              bugs={bugs}
              selectedJobFull={selectedJobFull}
            />
          </TabPanel>
          <TabPanel>
            <SimilarJobsTab
              repoName={currentRepo.name}
              classificationMap={classificationMap}
              selectedJobFull={selectedJobFull}
            />
          </TabPanel>
          {showPerf && (
            <TabPanel>
              <PerformanceTab
                key={selectedJobFull.id}
                selectedJobFull={selectedJobFull}
                currentRepo={currentRepo}
                repoName={currentRepo.name}
                jobDetails={jobDetails}
                perfJobDetail={perfJobDetail}
                revision={jobRevision}
              />
            </TabPanel>
          )}
          {enableTestGroupsTab ? (
            <TabPanel>
              <JobTestGroups
                taskId={taskId}
                rootUrl={rootUrl}
                notifyTestGroupsAvailable={this.handleEnableTestGroupsTab}
              />
            </TabPanel>
          ) : (
            <TabPanel disabled forceRender>
              <JobTestGroups
                taskId={taskId}
                rootUrl={rootUrl}
                notifyTestGroupsAvailable={this.handleEnableTestGroupsTab}
              />
            </TabPanel>
          )}
        </Tabs>
      </div>
    );
  }
}

TabsPanel.propTypes = {
  classificationMap: PropTypes.shape({}).isRequired,
  jobDetails: PropTypes.arrayOf(PropTypes.object).isRequired,
  jobArtifactsLoading: PropTypes.bool,
  classifications: PropTypes.arrayOf(PropTypes.object).isRequired,
  togglePinBoardVisibility: PropTypes.func.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  pinnedJobs: PropTypes.shape({}).isRequired,
  bugs: PropTypes.arrayOf(PropTypes.object).isRequired,
  clearSelectedJob: PropTypes.func.isRequired,
  selectedJobFull: PropTypes.shape({}).isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  perfJobDetail: PropTypes.arrayOf(PropTypes.object),
  jobRevision: PropTypes.string,
  jobLogUrls: PropTypes.arrayOf(PropTypes.object),
  logParseStatus: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
  taskId: PropTypes.string.isRequired,
  rootUrl: PropTypes.string.isRequired,
  initializeGlean: PropTypes.func.isRequired,
};

TabsPanel.defaultProps = {
  jobArtifactsLoading: false,
  jobLogUrls: [],
  logParseStatus: 'pending',
  perfJobDetail: [],
  jobRevision: null,
  logViewerFullUrl: null,
};

const mapStateToProps = ({
  pinnedJobs: { pinnedJobs, isPinBoardVisible },
}) => ({ pinnedJobs, isPinBoardVisible });

export default connect(mapStateToProps, {
  clearSelectedJob,
  pinJob,
  addBug,
  updatePinnedJob,
})(TabsPanel);
