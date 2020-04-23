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
import JobDetails from '../../../shared/JobDetails';
import { clearSelectedJob } from '../../redux/stores/selectedJob';

import FailureSummaryTab from './failureSummary/FailureSummaryTab';
import PerformanceTab from './PerformanceTab';
import AnnotationsTab from './AnnotationsTab';
import SimilarJobsTab from './SimilarJobsTab';

class TabsPanel extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      tabIndex: 0,
    };
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
        !!perfJobDetail.length,
      );

      return {
        tabIndex,
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
    const { perfJobDetail } = this.props;
    const nextIndex = tabIndex + 1;
    const tabCount = TabsPanel.getTabNames(!!perfJobDetail.length).length;
    this.setState({ tabIndex: nextIndex < tabCount ? nextIndex : 0 });
  };

  static getDefaultTabIndex(status, showPerf) {
    let idx = 0;
    const tabNames = TabsPanel.getTabNames(showPerf);
    const tabIndexes = tabNames.reduce(
      (acc, name) => ({ ...acc, [name]: idx++ }),
      {},
    );

    let tabIndex = showPerf ? tabIndexes.perf : tabIndexes.details;
    if (['busted', 'testfailed', 'exception'].includes(status)) {
      tabIndex = tabIndexes.failure;
    }
    return tabIndex;
  }

  static getTabNames(showPerf) {
    return ['details', 'failure', 'annotations', 'similar', 'perf'].filter(
      name => !(name === 'perf' && !showPerf),
    );
  }

  setTabIndex = tabIndex => {
    this.setState({ tabIndex });
  };

  render() {
    const {
      jobDetails,
      jobLogUrls,
      logParseStatus,
      suggestions,
      errors,
      bugs,
      bugSuggestionsLoading,
      perfJobDetail,
      repoName,
      jobRevision,
      classifications,
      togglePinBoardVisibility,
      isPinBoardVisible,
      pinnedJobs,
      classificationMap,
      logViewerFullUrl,
      reftestUrl,
      clearSelectedJob,
      selectedJobFull,
    } = this.props;
    const { tabIndex } = this.state;
    const countPinnedJobs = Object.keys(pinnedJobs).length;

    return (
      <div id="tabs-panel" role="region" aria-label="Job">
        <Tabs
          selectedTabClassName="selected-tab"
          selectedIndex={tabIndex}
          onSelect={this.setTabIndex}
        >
          <TabList className="tab-headers">
            <span className="tab-header-tabs">
              <Tab>Job Details</Tab>
              <Tab>Failure Summary</Tab>
              <Tab>Annotations</Tab>
              <Tab>Similar Jobs</Tab>
              {!!perfJobDetail.length && <Tab>Performance</Tab>}
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
            <JobDetails jobDetails={jobDetails} />
          </TabPanel>
          <TabPanel>
            <FailureSummaryTab
              suggestions={suggestions}
              errors={errors}
              bugSuggestionsLoading={bugSuggestionsLoading}
              jobLogUrls={jobLogUrls}
              logParseStatus={logParseStatus}
              logViewerFullUrl={logViewerFullUrl}
              reftestUrl={reftestUrl}
              selectedJobFull={selectedJobFull}
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
              repoName={repoName}
              classificationMap={classificationMap}
              selectedJobFull={selectedJobFull}
            />
          </TabPanel>
          {!!perfJobDetail.length && (
            <TabPanel>
              <PerformanceTab
                repoName={repoName}
                perfJobDetail={perfJobDetail}
                revision={jobRevision}
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
  repoName: PropTypes.string.isRequired,
  classifications: PropTypes.arrayOf(PropTypes.object).isRequired,
  togglePinBoardVisibility: PropTypes.func.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  pinnedJobs: PropTypes.shape({}).isRequired,
  bugs: PropTypes.arrayOf(PropTypes.object).isRequired,
  clearSelectedJob: PropTypes.func.isRequired,
  selectedJobFull: PropTypes.shape({}).isRequired,
  perfJobDetail: PropTypes.arrayOf(PropTypes.object),
  suggestions: PropTypes.arrayOf(PropTypes.object),
  jobRevision: PropTypes.string,
  errors: PropTypes.arrayOf(PropTypes.object),
  bugSuggestionsLoading: PropTypes.bool,
  jobLogUrls: PropTypes.arrayOf(PropTypes.object),
  logParseStatus: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
  reftestUrl: PropTypes.string,
};

TabsPanel.defaultProps = {
  suggestions: [],
  errors: [],
  bugSuggestionsLoading: false,
  jobLogUrls: [],
  logParseStatus: 'pending',
  perfJobDetail: [],
  jobRevision: null,
  logViewerFullUrl: null,
  reftestUrl: null,
};

const mapStateToProps = ({
  pinnedJobs: { pinnedJobs, isPinBoardVisible },
}) => ({ pinnedJobs, isPinBoardVisible });

export default connect(mapStateToProps, { clearSelectedJob })(TabsPanel);
