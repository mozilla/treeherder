import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Container, Spinner, Navbar, Nav } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import camelCase from 'lodash/camelCase';
import { Helmet } from 'react-helmet';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import faviconBroken from '../img/push-health-broken.png';
import faviconOk from '../img/push-health-ok.png';
import ErrorMessages from '../shared/ErrorMessages';
import PushModel from '../models/push';
import RepositoryModel from '../models/repository';
import StatusProgress from '../shared/StatusProgress';
import { scrollToLine } from '../helpers/utils';
import { resultColorMap, getIcon } from '../helpers/display';
import {
  createQueryParams,
  parseQueryParams,
  updateQueryParams,
} from '../helpers/url';
import InputFilter from '../shared/InputFilter';

import TestMetric from './TestMetric';
import JobListMetric from './JobListMetric';
import CommitHistory from './CommitHistory';

const Health = (props) => {
  const { location, history, notify, clearNotification } = props;
  const params = new URLSearchParams(location.search);

  const [revision] = useState(params.get('revision'));
  const [repo] = useState(params.get('repo'));
  const [currentRepo, setCurrentRepo] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [jobs, setJobs] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [failureMessage, setFailureMessage] = useState(null);
  const [testGroup] = useState(params.get('testGroup') || '');
  const [selectedTest, setSelectedTest] = useState(
    params.get('selectedTest') || '',
  );
  const [selectedTaskId, setSelectedTaskId] = useState(
    params.get('selectedTaskId') || '',
  );
  const [selectedJobName, setSelectedJobName] = useState(
    params.get('selectedJobName') || '',
  );
  const [searchStr, setSearchStr] = useState(params.get('searchStr') || '');
  const [regressionsOrderBy, setRegressionsOrderBy] = useState(
    params.get('regressionsOrderBy') || 'count',
  );
  const [regressionsGroupBy, setRegressionsGroupBy] = useState(
    params.get('regressionsGroupBy') || 'path',
  );
  const [knownIssuesOrderBy, setKnownIssuesOrderBy] = useState(
    params.get('knownIssuesOrderBy') || 'count',
  );
  const [knownIssuesGroupBy, setKnownIssuesGroupBy] = useState(
    params.get('knownIssuesGroupBy') || 'path',
  );
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showAllFailures, setShowAllFailures] = useState(false);
  const [isLimited, setIsLimited] = useState(false);
  const [displayedFailures, setDisplayedFailures] = useState(0);
  const [totalFailedJobsInPush, setTotalFailedJobsInPush] = useState(null);
  const [selectedTabIndex, setSelectedTabIndex] = useState(2); // Default to Tests tab

  const testTimerRef = useRef(null);
  const notificationsRef = useRef(null);
  const updatePushHealthRef = useRef(null);

  const updatePushHealth = useCallback(async () => {
    if (status) {
      const { running, pending, completed } = status;

      if (completed > 0 && pending === 0 && running === 0) {
        clearInterval(testTimerRef.current);
        return;
      }
    }

    // Start both fetches concurrently, but handle them independently for progressive rendering
    setDetailsLoading(true);

    // Fetch summary (fast - ~1s)
    const summaryPromise = PushModel.getHealthSummary(repo, revision);

    // Determine parameters based on showAllFailures state
    const limit = showAllFailures ? null : 50;
    const classificationIds = showAllFailures ? '1,6,8' : '6';

    // Fetch details with limit and classification filter
    const detailsPromise = PushModel.getHealthDetails(
      repo,
      revision,
      limit,
      classificationIds,
    );

    // Handle summary as soon as it arrives
    summaryPromise.then((summaryResponse) => {
      if (!summaryResponse.failureStatus && summaryResponse.data) {
        const summaryData = summaryResponse.data;
        if (summaryData.metrics) {
          setMetrics((prevMetrics) => ({
            ...prevMetrics,
            commitHistory: summaryData.metrics.commitHistory,
          }));
        }
        if (summaryData.status !== undefined) setStatus(summaryData.status);
      } else if (summaryResponse.failureStatus) {
        setFailureMessage(summaryResponse.data);
      }
    });

    // Handle details when they arrive (independently)
    detailsPromise.then((detailsResponse) => {
      setDetailsLoading(false);

      if (!detailsResponse.failureStatus && detailsResponse.data) {
        const detailsData = detailsResponse.data;
        if (detailsData.jobs !== undefined) setJobs(detailsData.jobs);
        if (detailsData.result !== undefined) setResult(detailsData.result);
        if (detailsData.metrics) {
          setMetrics((prevMetrics) => ({
            ...prevMetrics,
            ...detailsData.metrics,
          }));
        }
        // Update status with totalFailures count if provided
        if (detailsData.totalFailures !== undefined) {
          setStatus((prevStatus) => ({
            ...prevStatus,
            testfailed: detailsData.totalFailures,
          }));
        }
        // Store limiting information
        if (detailsData.isLimited !== undefined) {
          setIsLimited(detailsData.isLimited);
        }
        if (detailsData.displayedFailures !== undefined) {
          setDisplayedFailures(detailsData.displayedFailures);
        }
        if (detailsData.totalFailedJobsInPush !== undefined) {
          setTotalFailedJobsInPush(detailsData.totalFailedJobsInPush);
        }
      } else if (detailsResponse.failureStatus) {
        setFailureMessage(detailsResponse.data);
      }
    });

    // Wait for both to complete before returning
    const [summaryResponse, detailsResponse] = await Promise.all([
      summaryPromise,
      detailsPromise,
    ]);

    return {
      ...summaryResponse.data,
      ...detailsResponse.data,
    };
  }, [repo, revision, showAllFailures]);

  // Store the latest updatePushHealth in a ref so the interval can use it without re-creating
  updatePushHealthRef.current = updatePushHealth;

  const handleShowAllFailures = useCallback(async () => {
    setShowAllFailures(true);
    setDetailsLoading(true);

    // Fetch summary (fast - ~1s)
    const summaryPromise = PushModel.getHealthSummary(repo, revision);

    // Fetch details with no limit and all classification IDs
    const detailsPromise = PushModel.getHealthDetails(
      repo,
      revision,
      null, // no limit
      '1,6,8', // all failure types
    );

    // Handle summary as soon as it arrives
    summaryPromise.then((summaryResponse) => {
      if (!summaryResponse.failureStatus && summaryResponse.data) {
        const summaryData = summaryResponse.data;
        if (summaryData.metrics) {
          setMetrics((prevMetrics) => ({
            ...prevMetrics,
            commitHistory: summaryData.metrics.commitHistory,
          }));
        }
        if (summaryData.status !== undefined) setStatus(summaryData.status);
      } else if (summaryResponse.failureStatus) {
        setFailureMessage(summaryResponse.data);
      }
    });

    // Handle details when they arrive
    detailsPromise.then((detailsResponse) => {
      setDetailsLoading(false);

      if (!detailsResponse.failureStatus && detailsResponse.data) {
        const detailsData = detailsResponse.data;
        if (detailsData.jobs !== undefined) setJobs(detailsData.jobs);
        if (detailsData.result !== undefined) setResult(detailsData.result);
        if (detailsData.metrics) {
          setMetrics((prevMetrics) => ({
            ...prevMetrics,
            ...detailsData.metrics,
          }));
        }
        if (detailsData.totalFailures !== undefined) {
          setStatus((prevStatus) => ({
            ...prevStatus,
            testfailed: detailsData.totalFailures,
          }));
        }
        // Store limiting information
        if (detailsData.isLimited !== undefined) {
          setIsLimited(detailsData.isLimited);
        }
        if (detailsData.displayedFailures !== undefined) {
          setDisplayedFailures(detailsData.displayedFailures);
        }
        if (detailsData.totalFailedJobsInPush !== undefined) {
          setTotalFailedJobsInPush(detailsData.totalFailedJobsInPush);
        }
      } else if (detailsResponse.failureStatus) {
        setFailureMessage(detailsResponse.data);
      }
    });

    // Wait for both to complete
    await Promise.all([summaryPromise, detailsPromise]);
  }, [repo, revision]);

  const updateParamsAndState = useCallback(
    (stateObj) => {
      const newParams = {
        ...parseQueryParams(location.search),
        ...stateObj,
      };
      const queryString = createQueryParams(newParams);

      updateQueryParams(queryString, history, location);

      if (stateObj.selectedTest !== undefined)
        setSelectedTest(stateObj.selectedTest);
      if (stateObj.selectedTaskId !== undefined)
        setSelectedTaskId(stateObj.selectedTaskId);
      if (stateObj.selectedJobName !== undefined)
        setSelectedJobName(stateObj.selectedJobName);
      if (stateObj.searchStr !== undefined) setSearchStr(stateObj.searchStr);
      if (stateObj.regressionsOrderBy !== undefined)
        setRegressionsOrderBy(stateObj.regressionsOrderBy);
      if (stateObj.regressionsGroupBy !== undefined)
        setRegressionsGroupBy(stateObj.regressionsGroupBy);
      if (stateObj.knownIssuesOrderBy !== undefined)
        setKnownIssuesOrderBy(stateObj.knownIssuesOrderBy);
      if (stateObj.knownIssuesGroupBy !== undefined)
        setKnownIssuesGroupBy(stateObj.knownIssuesGroupBy);
    },
    [location, history],
  );

  const setExpanded = useCallback((metricName, expanded) => {
    const root = camelCase(metricName);

    if (expanded) {
      scrollToLine(`#${root}Metric`, 0, 0, {
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, []);

  const filter = useCallback(
    (filterStr) => {
      const newParams = {
        ...parseQueryParams(location.search),
        searchStr: filterStr,
      };

      if (!filterStr.length) {
        delete newParams.searchStr;
      }

      const queryString = createQueryParams(newParams);

      updateQueryParams(queryString, history, location);

      setSearchStr(filterStr);
    },
    [location, history],
  );

  useEffect(() => {
    const initializeComponent = async () => {
      // Use the ref to call the latest version of updatePushHealth
      await updatePushHealthRef.current();

      const urlParams = parseQueryParams(location.search);
      let tabIndex;

      // Tab indices are now fixed: Linting=0, Builds=1, Tests=2
      if (urlParams.tab !== undefined) {
        const requestedTab = urlParams.tab;
        const tabMap = {
          linting: 0,
          builds: 1,
          tests: 2,
        };
        tabIndex =
          tabMap[requestedTab] !== undefined ? tabMap[requestedTab] : 2;
      } else {
        // Default to tests tab (index 2)
        tabIndex = 2;
      }

      const repos = await RepositoryModel.getList();
      const foundRepo = repos.find((repoObj) => repoObj.name === repo);

      setSelectedTabIndex(tabIndex);
      setCurrentRepo(foundRepo);

      // Update the tests every two minutes using the ref
      testTimerRef.current = setInterval(
        () => updatePushHealthRef.current(),
        120000,
      );
      notificationsRef.current = setInterval(() => {
        clearNotification();
      }, 4000);
    };

    initializeComponent();

    return () => {
      if (testTimerRef.current) clearInterval(testTimerRef.current);
      if (notificationsRef.current) clearInterval(notificationsRef.current);
    };
  }, [testGroup, clearNotification, repo, revision]);

  const { tests, commitHistory = {}, linting = {}, builds = {} } =
    metrics || {};

  return (
    <React.Fragment>
      <Navbar color="light" light expand="sm" className="w-100">
        {!!tests && (
          <Nav className="mb-2 pt-2 pl-3 justify-content-between w-100">
            <span />
            <span className="mr-2 d-flex">
              <InputFilter
                updateFilterText={filter}
                placeholder="filter path or platform"
              />
            </span>
          </Nav>
        )}
      </Navbar>
      <Helmet>
        <link
          rel="shortcut icon"
          href={result === 'fail' ? faviconBroken : faviconOk}
        />
        <title>{`[${
          (status && status.testfailed) || 0
        } failures] Push Health`}</title>
      </Helmet>
      <Container fluid className="mt-2 mb-5 max-width-default">
        {(!!commitHistory.details || !!tests) && !!currentRepo && (
          <React.Fragment>
            <div className="d-flex my-5">
              <StatusProgress counts={status} customStyle="progress-relative" />
              <div className="mt-4 ml-2">
                {commitHistory.details && (
                  <CommitHistory
                    history={commitHistory.details}
                    revision={revision}
                    currentRepo={currentRepo}
                  />
                )}
              </div>
            </div>
            <div className="mb-3" />
            {detailsLoading && !tests ? (
              <h4 className="mt-5">
                <Spinner />
                <span className="ml-2 pb-1">Loading test failures...</span>
              </h4>
            ) : (
              <Tabs
                className="w-100 h-100 mr-5 mt-2"
                selectedTabClassName="selected-detail-tab"
                selectedIndex={selectedTabIndex}
                onSelect={(index) => setSelectedTabIndex(index)}
              >
                <TabList className="font-weight-500 text-secondary d-flex justify-content-end border-bottom font-size-18">
                  <Tab
                    className={`pb-2 list-inline-item ml-4 pointable ${
                      linting.result === 'none' ? 'text-muted' : ''
                    }`}
                    disabled={linting.result === 'none'}
                  >
                    <span className="text-success">
                      <FontAwesomeIcon
                        icon={getIcon(linting.result)}
                        className={`mr-1 text-${
                          linting.result === 'none'
                            ? 'muted'
                            : resultColorMap[linting.result]
                        }`}
                      />
                    </span>
                    Linting
                  </Tab>
                  <Tab
                    className={`list-inline-item ml-4 pointable ${
                      builds.result === 'none' ? 'text-muted' : ''
                    }`}
                    disabled={builds.result === 'none'}
                  >
                    <FontAwesomeIcon
                      icon={getIcon(builds.result)}
                      className={`mr-1 text-${
                        builds.result === 'none'
                          ? 'muted'
                          : resultColorMap[builds.result]
                      }`}
                    />
                    Builds
                  </Tab>
                  <Tab
                    className={`list-inline-item ml-4 pointable ${
                      tests.result === 'none' ? 'text-muted' : ''
                    }`}
                    disabled={tests.result === 'none'}
                  >
                    <FontAwesomeIcon
                      fill={
                        tests.result === 'none'
                          ? 'muted'
                          : resultColorMap[tests.result]
                      }
                      icon={getIcon(tests.result)}
                      className={`mr-1 text-${
                        tests.result === 'none'
                          ? 'muted'
                          : resultColorMap[tests.result]
                      }`}
                    />
                    Tests
                  </Tab>
                </TabList>
                <div>
                  <TabPanel>
                    <JobListMetric
                      data={linting}
                      currentRepo={currentRepo}
                      revision={revision}
                      setExpanded={setExpanded}
                      updateParamsAndState={updateParamsAndState}
                      notify={notify}
                      selectedTaskId={selectedTaskId}
                      selectedJobName={selectedJobName}
                    />
                  </TabPanel>
                  <TabPanel>
                    <JobListMetric
                      data={builds}
                      currentRepo={currentRepo}
                      revision={revision}
                      setExpanded={setExpanded}
                      updateParamsAndState={updateParamsAndState}
                      notify={notify}
                      selectedTaskId={selectedTaskId}
                      selectedJobName={selectedJobName}
                    />
                  </TabPanel>
                  <TabPanel>
                    <TestMetric
                      jobs={jobs}
                      data={tests}
                      repo={repo}
                      currentRepo={currentRepo}
                      revision={revision}
                      notify={notify}
                      setExpanded={setExpanded}
                      searchStr={searchStr}
                      testGroup={testGroup}
                      selectedTest={selectedTest}
                      regressionsOrderBy={regressionsOrderBy}
                      regressionsGroupBy={regressionsGroupBy}
                      knownIssuesOrderBy={knownIssuesOrderBy}
                      knownIssuesGroupBy={knownIssuesGroupBy}
                      selectedTaskId={selectedTaskId}
                      selectedJobName={selectedJobName}
                      updateParamsAndState={updateParamsAndState}
                      updatePushHealth={updatePushHealth}
                      isLimited={isLimited}
                      displayedFailures={displayedFailures}
                      totalFailedJobsInPush={totalFailedJobsInPush}
                      handleShowAllFailures={handleShowAllFailures}
                      detailsLoading={detailsLoading}
                    />
                  </TabPanel>
                </div>
              </Tabs>
            )}
          </React.Fragment>
        )}
        {failureMessage && <ErrorMessages failureMessage={failureMessage} />}
        {!failureMessage && !commitHistory.details && !tests && (
          <h4>
            <Spinner />
            <span className="ml-2 pb-1">Gathering health data...</span>
          </h4>
        )}
      </Container>
    </React.Fragment>
  );
};

Health.propTypes = {
  location: PropTypes.shape({}).isRequired,
  history: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  clearNotification: PropTypes.func.isRequired,
};

export default Health;
