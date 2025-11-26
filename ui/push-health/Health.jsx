import React from 'react';
import PropTypes from 'prop-types';
import { Container, Spinner, Navbar, Nav, Alert } from 'react-bootstrap';
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

export default class Health extends React.PureComponent {
  constructor(props) {
    super(props);

    const params = new URLSearchParams(props.location.search);

    this.state = {
      revision: params.get('revision'),
      repo: params.get('repo'),
      currentRepo: null,
      metrics: {},
      jobs: null,
      result: null,
      failureMessage: null,
      defaultTabIndex: 0,
      testGroup: params.get('testGroup') || '',
      selectedTest: params.get('selectedTest') || '',
      selectedTaskId: params.get('selectedTaskId') || '',
      selectedJobName: params.get('selectedJobName') || '',
      searchStr: params.get('searchStr') || '',
      regressionsOrderBy: params.get('regressionsOrderBy') || 'count',
      regressionsGroupBy: params.get('regressionsGroupBy') || 'path',
      showIntermittentAlert:
        localStorage.getItem('dismissedIntermittentAlert') !== 'true',
    };
  }

  async componentDidMount() {
    const { repo, testGroup } = this.state;
    const { location } = this.props;
    const {
      metrics: { linting, builds, tests },
    } = await this.updatePushHealth();

    const params = parseQueryParams(location.search);
    let defaultTabIndex;

    if (params.tab !== undefined) {
      defaultTabIndex = ['linting', 'builds', 'tests'].findIndex(
        (metric) => metric === params.tab,
      );
    } else if (testGroup) {
      defaultTabIndex = 2;
    } else {
      defaultTabIndex = [linting, builds, tests].findIndex(
        (metric) => metric.result === 'fail',
      );
    }

    const repos = await RepositoryModel.getList();
    const currentRepo = repos.find((repoObj) => repoObj.name === repo);

    this.setState({ defaultTabIndex, currentRepo });

    // Update the tests every two minutes.
    this.testTimerId = setInterval(() => this.updatePushHealth(), 120000);
    this.notificationsId = setInterval(() => {
      this.props.clearNotification();
    }, 4000);
  }

  componentWillUnmount() {
    clearInterval(this.testTimerId);
  }

  updateParamsAndState = (stateObj) => {
    const { location, history } = this.props;
    const newParams = {
      ...parseQueryParams(location.search),
      ...stateObj,
    };
    const queryString = createQueryParams(newParams);

    updateQueryParams(queryString, history, location);
    this.setState(stateObj);
  };

  updatePushHealth = async () => {
    const { repo, revision, status } = this.state;

    if (status) {
      const { running, pending, completed } = status;

      if (completed > 0 && pending === 0 && running === 0) {
        clearInterval(this.testTimerId);
        return;
      }
    }

    const { data, failureStatus } = await PushModel.getHealth(repo, revision);
    const newState = !failureStatus ? data : { failureMessage: data };

    this.setState(newState);
    return newState;
  };

  dismissIntermittentAlert = () => {
    localStorage.setItem('dismissedIntermittentAlert', 'true');
    this.setState({ showIntermittentAlert: false });
  };

  setExpanded = (metricName, expanded) => {
    const root = camelCase(metricName);
    const key = `${root}Expanded`;
    const { [key]: oldExpanded } = this.state;

    if (oldExpanded !== expanded) {
      this.setState({
        [key]: expanded,
      });
    } else if (expanded) {
      scrollToLine(`#${root}Metric`, 0, 0, {
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  filter = (searchStr) => {
    const { location, history } = this.props;
    const newParams = { ...parseQueryParams(location.search), searchStr };

    if (!searchStr.length) {
      delete newParams.searchStr;
    }

    const queryString = createQueryParams(newParams);

    updateQueryParams(queryString, history, location);

    this.setState({ searchStr });
  };

  render() {
    const {
      metrics,
      result,
      repo,
      revision,
      jobs,
      failureMessage,
      status,
      searchStr,
      currentRepo,
      testGroup,
      selectedTest,
      defaultTabIndex,
      selectedTaskId,
      selectedJobName,
      regressionsOrderBy,
      regressionsGroupBy,
      showIntermittentAlert,
    } = this.state;
    const { tests, commitHistory, linting, builds } = metrics;

    const { notify } = this.props;
    return (
      <React.Fragment>
        <Navbar variant="light" expand="sm" className="w-100">
          {!!tests && (
            <Nav className="mb-2 pt-2 ps-3 justify-content-between w-100">
              <span />
              <span className="me-2 d-flex">
                <InputFilter
                  updateFilterText={this.filter}
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
          {!!tests && !!currentRepo && (
            <React.Fragment>
              {showIntermittentAlert && (
                <Alert
                  variant="info"
                  className="mb-3"
                  dismissible
                  show={showIntermittentAlert}
                  onClose={this.dismissIntermittentAlert}
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
                      compareWithParent={this.compareWithParent}
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
                      setExpanded={this.setExpanded}
                      updateParamsAndState={this.updateParamsAndState}
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
                      setExpanded={this.setExpanded}
                      updateParamsAndState={this.updateParamsAndState}
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
                      setExpanded={this.setExpanded}
                      searchStr={searchStr}
                      testGroup={testGroup}
                      selectedTest={selectedTest}
                      regressionsOrderBy={regressionsOrderBy}
                      regressionsGroupBy={regressionsGroupBy}
                      selectedTaskId={selectedTaskId}
                      selectedJobName={selectedJobName}
                      updateParamsAndState={this.updateParamsAndState}
                      investigateTest={this.investigateTest}
                      unInvestigateTest={this.unInvestigateTest}
                      updatePushHealth={this.updatePushHealth}
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
}

Health.propTypes = {
  location: PropTypes.shape({}).isRequired,
  clearNotification: PropTypes.func.isRequired,
};
