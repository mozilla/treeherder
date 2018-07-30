import React from 'react';
import PropTypes from 'prop-types';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import { thEvents } from '../../../js/constants';
import { getAllUrlParams } from '../../../helpers/location';
import { getStatus } from '../../../helpers/job';

import JobDetailsTab from './JobDetailsTab';
import FailureSummaryTab from './failureSummary/FailureSummaryTab';
import PerformanceTab from './PerformanceTab';
import AutoclassifyTab from './autoclassify/AutoclassifyTab';
import AnnotationsTab from './AnnotationsTab';
import SimilarJobsTab from './SimilarJobsTab';

export default class TabsPanel extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.$rootScope = $injector.get('$rootScope');

    this.state = {
      showAutoclassifyTab: getAllUrlParams().has('autoclassify'),
      tabIndex: 0,
      perfJobDetailSize: 0,
      jobId: null,
    };
  }

  static getDerivedStateFromProps(props, state) {
    const { perfJobDetail, selectedJob } = props;
    const { showAutoclassifyTab } = state;

    // This fires every time the props change.  But we only want to figure out the new default
    // tab when we get a new job.  However, the job could change, then later, the perf details fetch
    // returns.  So we need to check for a change in the size of the perfJobDetail too.
    if (state.jobId !== selectedJob.id || state.perfJobDetailSize !== perfJobDetail.length) {
      const tabIndex = TabsPanel.getDefaultTabIndex(
        getStatus(selectedJob),
        !!perfJobDetail.length, showAutoclassifyTab,
      );

      return {
        tabIndex,
        jobId: selectedJob.id,
        perfJobDetailSize: perfJobDetail.length,
      };
    }
    return {};
  }

  componentDidMount() {
    this.selectNextTabUnlisten = this.$rootScope.$on(thEvents.selectNextTab, () => {
      const { tabIndex, showAutoclassifyTab } = this.state;
      const { perfJobDetail } = this.props;
      const nextIndex = tabIndex + 1;
      const tabCount = TabsPanel.getTabNames(!!perfJobDetail.length, showAutoclassifyTab).length;
      this.setState({ tabIndex: nextIndex < tabCount ? nextIndex : 0 });
    });

    this.setTabIndex = this.setTabIndex.bind(this);
  }

  componentWillUnmount() {
    this.selectNextTabUnlisten();
  }

  static getDefaultTabIndex(status, showPerf, showAutoclassify) {
    let idx = 0;
    const tabNames = TabsPanel.getTabNames(showPerf, showAutoclassify);
    const tabIndexes = tabNames.reduce((acc, name) => ({ ...acc, [name]: idx++ }), {});

    let tabIndex = showPerf ? tabIndexes.perf : tabIndexes.details;
    if (['busted', 'testfailed', 'exception'].includes(status)) {
      tabIndex = showAutoclassify ? tabIndexes.autoclassify : tabIndexes.failure;
    }
    return tabIndex;
  }

  static getTabNames(showPerf, showAutoclassify) {
    return [
      'details', 'failure', 'autoclassify', 'annotations', 'similar', 'perf',
    ].filter(name => (
      !((name === 'autoclassify' && !showAutoclassify) || (name === 'perf' && !showPerf))
    ));
  }

  setTabIndex(tabIndex) {
    this.setState({ tabIndex });
  }

  render() {
    const {
      jobDetails, jobLogUrls, logParseStatus, suggestions, errors, pinJob, user, bugs,
      bugSuggestionsLoading, selectedJob, perfJobDetail, repoName, jobRevision,
      classifications, togglePinBoardVisibility, isPinBoardVisible, pinnedJobs, addBug,
      classificationTypes, logViewerFullUrl, reftestUrl, $injector,
    } = this.props;
    const { showAutoclassifyTab, tabIndex } = this.state;
    const countPinnedJobs = Object.keys(pinnedJobs).length;

    return (
      <div id="tabs-panel">
        <Tabs
          selectedTabClassName="selected-tab"
          selectedIndex={tabIndex}
          onSelect={this.setTabIndex}
        >
          <TabList className="tab-headers">
            <span className="tab-header-tabs">
              <Tab>Job Details</Tab>
              <Tab>Failure Summary</Tab>
              {showAutoclassifyTab && <Tab>Failure Classification</Tab>}
              <Tab>Annotations</Tab>
              <Tab>Similar Jobs</Tab>
              {!!perfJobDetail.length && <Tab>Performance</Tab>}
            </span>
            <span id="tab-header-buttons" className="details-panel-controls pull-right">
              <span
                id="pinboard-btn"
                className="btn pinboard-btn-text"
                onClick={togglePinBoardVisibility}
                title={isPinBoardVisible ? 'Close the pinboard' : 'Open the pinboard'}
              >PinBoard
                {!!countPinnedJobs && <div
                  title={`You have ${countPinnedJobs} job${countPinnedJobs > 1 ? 's' : ''} pinned`}
                  className={`pin-count-group ${countPinnedJobs > 99 ? 'pin-count-group-3-digit' : ''}`}
                >
                  <div
                    className={`pin-count-text ${countPinnedJobs > 99 ? 'pin-count-group-3-digit' : ''}`}
                  >{countPinnedJobs}</div>
                </div>}
                <span
                  className={`fa ${isPinBoardVisible ? 'fa-angle-down' : 'fa-angle-up'}`}
                />
              </span>
              <span
                onClick={() => this.$rootScope.$emit(thEvents.clearSelectedJob)}
                className="btn details-panel-close-btn"
              ><span className="fa fa-times" /></span>
            </span>
          </TabList>
          <TabPanel>
            <JobDetailsTab jobDetails={jobDetails} />
          </TabPanel>
          <TabPanel>
            <FailureSummaryTab
              suggestions={suggestions}
              selectedJob={selectedJob}
              errors={errors}
              bugSuggestionsLoading={bugSuggestionsLoading}
              jobLogUrls={jobLogUrls}
              logParseStatus={logParseStatus}
              addBug={addBug}
              pinJob={pinJob}
              logViewerFullUrl={logViewerFullUrl}
              reftestUrl={reftestUrl}
              $injector={$injector}
            />
          </TabPanel>
          {showAutoclassifyTab && <TabPanel>
            <AutoclassifyTab
              job={selectedJob}
              hasLogs={!!jobLogUrls.length}
              logsParsed={logParseStatus !== 'pending'}
              logParseStatus={logParseStatus}
              addBug={addBug}
              pinJob={pinJob}
              pinnedJobs={pinnedJobs}
              user={user}
              $injector={$injector}
            />
          </TabPanel>}
          <TabPanel>
            <AnnotationsTab
              classificationTypes={classificationTypes}
              classifications={classifications}
              selectedJob={selectedJob}
              bugs={bugs}
              $injector={$injector}
            />
          </TabPanel>
          <TabPanel>
            <SimilarJobsTab
              selectedJob={selectedJob}
              repoName={repoName}
              $injector={$injector}
            />
          </TabPanel>
          {!!perfJobDetail.length && <TabPanel>
            <PerformanceTab
              repoName={repoName}
              perfJobDetail={perfJobDetail}
              revision={jobRevision}
            />
          </TabPanel>}
        </Tabs>
      </div>
    );
  }
}

TabsPanel.propTypes = {
  classificationTypes: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
  jobDetails: PropTypes.array.isRequired,
  repoName: PropTypes.string.isRequired,
  classifications: PropTypes.array.isRequired,
  togglePinBoardVisibility: PropTypes.func.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  pinnedJobs: PropTypes.object.isRequired,
  bugs: PropTypes.array.isRequired,
  addBug: PropTypes.func.isRequired,
  pinJob: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  perfJobDetail: PropTypes.array,
  suggestions: PropTypes.array,
  selectedJob: PropTypes.object,
  jobRevision: PropTypes.string,
  errors: PropTypes.array,
  bugSuggestionsLoading: PropTypes.bool,
  jobLogUrls: PropTypes.array,
  logParseStatus: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
  reftestUrl: PropTypes.string,
};

TabsPanel.defaultProps = {
  suggestions: [],
  selectedJob: null,
  errors: [],
  bugSuggestionsLoading: false,
  jobLogUrls: [],
  logParseStatus: 'pending',
  perfJobDetail: [],
  jobRevision: null,
  logViewerFullUrl: null,
  reftestUrl: null,
};
