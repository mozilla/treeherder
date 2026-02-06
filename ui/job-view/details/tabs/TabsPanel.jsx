import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Dropdown, Nav } from 'react-bootstrap';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleDown,
  faAngleUp,
  faTimes,
  faEllipsisH,
} from '@fortawesome/free-solid-svg-icons';

import { thEvents } from '../../../helpers/constants';
import JobArtifacts from '../../../shared/JobArtifacts';
import JobTestGroups from '../JobTestGroups';
import { clearSelectedJob } from '../../redux/stores/selectedJob';
import { pinJob, addBug } from '../../redux/stores/pinnedJobs';
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

const getTabNames = ({ showPerf }) => {
  // The order in here has to match the order within the render method
  return [
    'artifacts',
    'failure',
    'annotations',
    'similar',
    'perf',
    'test-groups',
  ].filter((name) => !(name === 'perf' && !showPerf));
};

const getDefaultTabIndex = (status, props) => {
  const { showPerf } = showTabsFromProps(props);
  let idx = 0;
  const tabNames = getTabNames({ showPerf });
  const tabIndexes = tabNames.reduce(
    (acc, name) => ({ ...acc, [name]: idx++ }),
    {},
  );

  let tabIndex = showPerf ? tabIndexes.perf : tabIndexes.artifacts;
  if (['busted', 'testfailed', 'exception'].includes(status)) {
    tabIndex = tabIndexes.failure;
  }
  return tabIndex;
};

const TabsPanel = ({
  jobArtifactsLoading = false,
  jobDetails,
  jobLogUrls = [],
  logParseStatus = 'pending',
  bugs,
  perfJobDetail = [],
  jobRevision = null,
  classifications,
  togglePinBoardVisibility,
  classificationMap,
  logViewerFullUrl = null,
  selectedJob,
  selectedJobFull,
  currentRepo,
  testGroups = [],
}) => {
  // Redux hooks
  const dispatch = useDispatch();
  const { pinnedJobs, isPinBoardVisible } = useSelector(
    (state) => state.pinnedJobs,
  );

  // Action dispatchers
  const clearSelectedJobAction = useCallback(
    (countPinnedJobs) => {
      dispatch(clearSelectedJob(countPinnedJobs));
    },
    [dispatch],
  );

  const pinJobAction = useCallback(
    (job) => {
      dispatch(pinJob(job));
    },
    [dispatch],
  );

  const addBugAction = useCallback(
    (bug, job) => {
      dispatch(addBug(bug, job));
    },
    [dispatch],
  );

  const [tabIndex, setTabIndex] = useState(0);
  const [overflowTabs, setOverflowTabs] = useState([]);
  const [showOverflowDropdown, setShowOverflowDropdown] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [perfJobDetailSize, setPerfJobDetailSize] = useState(0);
  const [dropdownShow, setDropdownShow] = useState(false);

  const tabListRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const checkTabOverflow = useCallback(() => {
    if (!tabListRef.current) return;

    const container = tabListRef.current;
    const tabsContainer = container.querySelector('.tab-header-tabs');
    const controlsContainer = container.querySelector('#tab-header-buttons');

    if (!tabsContainer || !controlsContainer) return;

    const containerWidth = container.offsetWidth;
    const controlsWidth = controlsContainer.offsetWidth;
    const availableWidth = containerWidth - controlsWidth - 40; // 40px buffer for overflow button

    const tabs = Array.from(tabsContainer.children);
    let totalWidth = 0;
    let overflowIndex = -1;

    tabs.forEach((tab, index) => {
      totalWidth += tab.offsetWidth + 12; // 12px for tighter spacing
      if (totalWidth > availableWidth && overflowIndex === -1) {
        overflowIndex = index;
      }
    });

    const { showPerf } = showTabsFromProps({ perfJobDetail });
    const enableTestGroupsTab = testGroups && testGroups.length > 0;

    // Create tab data array
    const allTabs = [
      { key: 'artifacts', label: 'Artifacts and Debugging Tools', index: 0 },
      { key: 'failure', label: 'Failure Summary', index: 1 },
      { key: 'annotations', label: 'Annotations', index: 2 },
      { key: 'similar', label: 'Similar Jobs', index: 3 },
    ];

    if (showPerf) {
      allTabs.push({
        key: 'perf',
        label: 'Performance',
        index: allTabs.length,
      });
    }
    if (enableTestGroupsTab) {
      allTabs.push({
        key: 'testgroups',
        label: 'Test Groups',
        index: allTabs.length,
      });
    }

    // Use CSS to hide/show tabs instead of conditional rendering
    if (overflowIndex > -1 && overflowIndex < allTabs.length) {
      // Hide tabs that overflow
      tabs.forEach((tab, index) => {
        if (index >= overflowIndex) {
          tab.style.display = 'none';
        } else {
          tab.style.display = '';
        }
      });
      setOverflowTabs(allTabs.slice(overflowIndex));
      setShowOverflowDropdown(true);
    } else {
      // Show all tabs
      tabs.forEach((tab) => {
        tab.style.display = '';
      });
      setOverflowTabs([]);
      setShowOverflowDropdown(false);
    }
  }, [perfJobDetail, testGroups]);

  const setupResizeObserver = useCallback(() => {
    if (tabListRef.current && window.ResizeObserver) {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        // Use requestAnimationFrame to prevent ResizeObserver loop errors
        window.requestAnimationFrame(() => {
          if (!Array.isArray(entries) || !entries.length) {
            return;
          }
          checkTabOverflow();
        });
      });
      resizeObserverRef.current.observe(tabListRef.current);
    }
  }, [checkTabOverflow]);

  const onSelectNextTab = useCallback(() => {
    const nextIndex = tabIndex + 1;
    const tabCount = getTabNames(showTabsFromProps({ perfJobDetail })).length;
    setTabIndex(nextIndex < tabCount ? nextIndex : 0);
  }, [tabIndex, perfJobDetail]);

  const handleOverflowTabClick = useCallback((newTabIndex) => {
    setTabIndex(newTabIndex);
  }, []);

  // Effect for handling job changes and setting default tab index
  useEffect(() => {
    if (
      selectedJob &&
      (jobId !== selectedJob.id || perfJobDetailSize !== perfJobDetail.length)
    ) {
      const newTabIndex = getDefaultTabIndex(selectedJob.resultStatus, {
        perfJobDetail,
      });
      setTabIndex(newTabIndex);
      setJobId(selectedJob.id);
      setPerfJobDetailSize(perfJobDetail.length);
    }
  }, [selectedJob, perfJobDetail, jobId, perfJobDetailSize]);

  // Effect for setting up event listeners and resize observer
  useEffect(() => {
    window.addEventListener(thEvents.selectNextTab, onSelectNextTab);
    setupResizeObserver();
    // Initial check after component mounts
    const timeoutId = setTimeout(() => checkTabOverflow(), 100);

    return () => {
      window.removeEventListener(thEvents.selectNextTab, onSelectNextTab);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      clearTimeout(timeoutId);
    };
  }, [onSelectNextTab, setupResizeObserver, checkTabOverflow]);

  // Effect for checking overflow when performance tab changes
  useEffect(() => {
    const timeoutId = setTimeout(() => checkTabOverflow(), 100);
    return () => clearTimeout(timeoutId);
  }, [perfJobDetail?.length, checkTabOverflow]);

  const countPinnedJobs = Object.keys(pinnedJobs).length;
  const { showPerf } = showTabsFromProps({ perfJobDetail });
  const enableTestGroupsTab = testGroups && testGroups.length > 0;

  return (
    <div id="tabs-panel" role="region" aria-label="Job">
      <Tabs
        selectedTabClassName="selected-tab"
        selectedIndex={tabIndex}
        onSelect={setTabIndex}
      >
        <div className="tab-headers-wrapper" ref={tabListRef}>
          <TabList className="tab-headers">
            <span className="tab-header-tabs">
              <Tab>Artifacts and Debugging Tools</Tab>
              <Tab>Failure Summary</Tab>
              <Tab>Annotations</Tab>
              <Tab>Similar Jobs</Tab>
              {showPerf && <Tab>Performance</Tab>}
              {enableTestGroupsTab && <Tab>Test Groups</Tab>}
              {showOverflowDropdown && overflowTabs.length > 0 && (
                <Dropdown
                  className="d-inline-block ms-2 align-middle"
                  drop="down"
                  show={dropdownShow}
                  onToggle={(isOpen) => setDropdownShow(isOpen)}
                >
                  <Dropdown.Toggle
                    variant="link"
                    className="bg-transparent text-light border-0 p-1 tab-overflow-toggle d-inline-flex align-items-center"
                    title="More tabs"
                    aria-label="More tab options"
                    bsPrefix="custom-dropdown-toggle"
                    style={{ height: '100%' }}
                  >
                    <FontAwesomeIcon
                      icon={faEllipsisH}
                      className="text-light"
                    />
                  </Dropdown.Toggle>
                  <Dropdown.Menu
                    align="start"
                    className="tab-overflow-menu"
                    style={{
                      zIndex: 10000,
                    }}
                    popperConfig={{
                      strategy: 'fixed',
                      modifiers: [
                        {
                          name: 'offset',
                          options: {
                            offset: [0, 4],
                          },
                        },
                        {
                          name: 'preventOverflow',
                          options: {
                            boundary: 'viewport',
                            padding: 8,
                          },
                        },
                        {
                          name: 'flip',
                          options: {
                            fallbackPlacements: ['bottom-end', 'top-end'],
                          },
                        },
                      ],
                    }}
                    renderOnMount
                  >
                    {overflowTabs.map((tab) => (
                      <Nav.Item key={tab.key}>
                        <Nav.Link
                          onClick={() => handleOverflowTabClick(tab.index)}
                          className={`py-2 text-light dropdown-item ${
                            tabIndex === tab.index ? 'active' : ''
                          }`}
                          style={{ cursor: 'pointer', display: 'block' }}
                        >
                          {tab.label}
                        </Nav.Link>
                      </Nav.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
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
                  className="ms-1"
                />
              </Button>
              <Button
                onClick={() => clearSelectedJobAction(countPinnedJobs)}
                className="btn details-panel-close-btn bg-transparent border-0"
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faTimes} title="Close" />
              </Button>
            </span>
          </TabList>
        </div>
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
            selectedJobId={selectedJob && selectedJob.id}
            jobLogUrls={jobLogUrls}
            jobDetails={jobDetails}
            logParseStatus={logParseStatus}
            logViewerFullUrl={logViewerFullUrl}
            addBug={addBugAction}
            pinJob={pinJobAction}
            currentRepo={currentRepo}
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
        {enableTestGroupsTab && (
          <TabPanel>
            <JobTestGroups testGroups={testGroups} />
          </TabPanel>
        )}
      </Tabs>
    </div>
  );
};

TabsPanel.propTypes = {
  classificationMap: PropTypes.shape({}).isRequired,
  jobDetails: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  jobArtifactsLoading: PropTypes.bool,
  classifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  togglePinBoardVisibility: PropTypes.func.isRequired,
  bugs: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  selectedJob: PropTypes.shape({}),
  selectedJobFull: PropTypes.shape({}).isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  perfJobDetail: PropTypes.arrayOf(PropTypes.shape({})),
  jobRevision: PropTypes.string,
  jobLogUrls: PropTypes.arrayOf(PropTypes.shape({})),
  logParseStatus: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
  testGroups: PropTypes.arrayOf(PropTypes.string),
};

export default TabsPanel;
