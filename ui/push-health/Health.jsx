import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Spinner, Navbar, Nav, Alert } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import camelCase from 'lodash/camelCase';
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

// Previously a PureComponent; wrap with React.memo if memoization is needed
function Health({ notify, clearNotification }) {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);

  const [revision] = useState(() => params.get('revision'));
  const [repo] = useState(() => params.get('repo'));
  const [currentRepo, setCurrentRepo] = useState(null);
  const [healthData, setHealthData] = useState({});
  const [failureMessage, setFailureMessage] = useState(null);
  const [defaultTabIndex, setDefaultTabIndex] = useState(0);
  const [testGroup, setTestGroup] = useState(
    () => params.get('testGroup') || '',
  );
  const [selectedTest, setSelectedTest] = useState(
    () => params.get('selectedTest') || '',
  );
  const [selectedTaskId, setSelectedTaskId] = useState(
    () => params.get('selectedTaskId') || '',
  );
  const [selectedJobName, setSelectedJobName] = useState(
    () => params.get('selectedJobName') || '',
  );
  const [searchStr, setSearchStr] = useState(
    () => params.get('searchStr') || '',
  );
  const [regressionsOrderBy, setRegressionsOrderBy] = useState(
    () => params.get('regressionsOrderBy') || 'count',
  );
  const [regressionsGroupBy, setRegressionsGroupBy] = useState(
    () => params.get('regressionsGroupBy') || 'path',
  );
  const [showIntermittentAlert, setShowIntermittentAlert] = useState(
    () => localStorage.getItem('dismissedIntermittentAlert') !== 'true',
  );
  const [expandedState, setExpandedState] = useState({});

  const testTimerRef = useRef(null);
  const notificationsTimerRef = useRef(null);

  // Refs for latest values in async callbacks
  const healthDataRef = useRef(healthData);
  healthDataRef.current = healthData;
  const locationRef = useRef(location);
  locationRef.current = location;

  const updateParamsAndState = useCallback(
    (stateObj) => {
      const currentLocation = locationRef.current;
      const newParams = {
        ...parseQueryParams(currentLocation.search),
        ...stateObj,
      };
      const queryStr = createQueryParams(newParams);

      updateQueryParams(queryStr, navigate, currentLocation);

      // Apply known state fields
      if (stateObj.testGroup !== undefined) setTestGroup(stateObj.testGroup);
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
    },
    [navigate],
  );

  const updatePushHealth = useCallback(async () => {
    const currentHealthData = healthDataRef.current;

    if (currentHealthData.status) {
      const { running, pending, completed } = currentHealthData.status;

      if (completed > 0 && pending === 0 && running === 0) {
        clearInterval(testTimerRef.current);
        return;
      }
    }

    const { data, failureStatus } = await PushModel.getHealth(repo, revision);

    if (!failureStatus) {
      setHealthData((prev) => ({ ...prev, ...data }));
      setFailureMessage(null);
      return data;
    }
    setFailureMessage(data);
    return { failureMessage: data };
  }, [repo, revision]);

  // componentDidMount
  useEffect(() => {
    const init = async () => {
      const healthResult = await updatePushHealth();

      if (healthResult?.metrics) {
        const { linting, builds, tests } = healthResult.metrics;
        const urlParams = parseQueryParams(location.search);
        let tabIndex;

        if (urlParams.tab !== undefined) {
          tabIndex = ['linting', 'builds', 'tests'].indexOf(urlParams.tab);
        } else if (testGroup) {
          tabIndex = 2;
        } else {
          tabIndex = [linting, builds, tests].findIndex(
            (metric) => metric.result === 'fail',
          );
        }

        setDefaultTabIndex(tabIndex);
      }

      const reposList = await RepositoryModel.getList();
      const foundRepo = reposList.find((repoObj) => repoObj.name === repo);
      setCurrentRepo(foundRepo);

      // Update the tests every two minutes
      testTimerRef.current = setInterval(() => updatePushHealth(), 120000);
      notificationsTimerRef.current = setInterval(() => {
        clearNotification();
      }, 4000);
    };

    init();

    return () => {
      clearInterval(testTimerRef.current);
      clearInterval(notificationsTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissIntermittentAlert = () => {
    localStorage.setItem('dismissedIntermittentAlert', 'true');
    setShowIntermittentAlert(false);
  };

  const setExpanded = useCallback(
    (metricName, expanded) => {
      const root = camelCase(metricName);
      const key = `${root}Expanded`;
      const oldExpanded = expandedState[key];

      if (oldExpanded !== expanded) {
        setExpandedState((prev) => ({ ...prev, [key]: expanded }));
      } else if (expanded) {
        scrollToLine(`#${root}Metric`, 0, 0, {
          behavior: 'smooth',
          block: 'center',
        });
      }
    },
    [expandedState],
  );

  const filter = useCallback(
    (newSearchStr) => {
      const newParams = {
        ...parseQueryParams(locationRef.current.search),
        searchStr: newSearchStr,
      };

      if (!newSearchStr.length) {
        delete newParams.searchStr;
      }

      const queryStr = createQueryParams(newParams);
      updateQueryParams(queryStr, navigate, locationRef.current);
      setSearchStr(newSearchStr);
    },
    [navigate],
  );

  const { metrics = {}, result, jobs, status } = healthData;
  const { tests, commitHistory, linting, builds } = metrics;

  return (
    <React.Fragment>
      <Navbar variant="light" expand="sm" className="w-100">
        {!!tests && (
          <Nav className="mb-2 pt-2 ps-3 justify-content-between w-100">
            <span />
            <span className="me-2 d-flex">
              <InputFilter
                updateFilterText={filter}
                placeholder="filter path or platform"
              />
            </span>
          </Nav>
        )}
      </Navbar>
      <link
        rel="shortcut icon"
        href={result === 'fail' ? faviconBroken : faviconOk}
      />
      <title>{`[${status?.testfailed || 0} failures] Push Health`}</title>
      <Container fluid className="mt-2 mb-5 max-width-default">
        {!!tests && !!currentRepo && (
          <React.Fragment>
            {showIntermittentAlert && (
              <Alert
                variant="info"
                className="mb-3"
                dismissible
                show={showIntermittentAlert}
                onClose={dismissIntermittentAlert}
              >
                Displaying only issues not known to be intermittents
              </Alert>
            )}
            <div className="d-flex my-5">
              <StatusProgress
                counts={status}
                customStyle="progress-relative"
              />
              <div className="mt-4 ms-2">
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
            <Tabs
              className="w-100 h-100 me-5 mt-2"
              selectedTabClassName="selected-detail-tab"
              defaultIndex={defaultTabIndex}
            >
              <TabList className="font-weight-500 text-secondary d-flex justify-content-end border-bottom font-size-18">
                {linting.result !== 'none' && (
                  <Tab className="pb-2 list-inline-item ms-4 pointable">
                    <span className="text-success">
                      <FontAwesomeIcon
                        icon={getIcon(linting.result)}
                        className={`me-1 text-${
                          resultColorMap[linting.result]
                        }`}
                      />
                    </span>
                    Linting
                  </Tab>
                )}
                {builds.result !== 'none' && (
                  <Tab className="list-inline-item ms-4 pointable">
                    <FontAwesomeIcon
                      icon={getIcon(builds.result)}
                      className={`me-1 text-${resultColorMap[builds.result]}`}
                    />
                    Builds
                  </Tab>
                )}
                {tests.result !== 'none' && (
                  <Tab className="list-inline-item ms-4 pointable">
                    <FontAwesomeIcon
                      fill={resultColorMap[tests.result]}
                      icon={getIcon(tests.result)}
                      className={`me-1 text-${resultColorMap[tests.result]}`}
                    />
                    Tests
                  </Tab>
                )}
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
                    selectedTaskId={selectedTaskId}
                    selectedJobName={selectedJobName}
                    updateParamsAndState={updateParamsAndState}
                    updatePushHealth={updatePushHealth}
                  />
                </TabPanel>
              </div>
            </Tabs>
          </React.Fragment>
        )}
        {failureMessage && <ErrorMessages failureMessage={failureMessage} />}
        {!failureMessage && !tests && (
          <h4>
            <Spinner />
            <span className="ms-2 pb-1">Gathering health data...</span>
          </h4>
        )}
      </Container>
    </React.Fragment>
  );
}

Health.propTypes = {
  notify: PropTypes.func.isRequired,
  clearNotification: PropTypes.func.isRequired,
};

export default Health;
