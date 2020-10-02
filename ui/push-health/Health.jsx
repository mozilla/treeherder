import React from 'react';
import PropTypes from 'prop-types';
import { Container, Spinner, Col, Row, Navbar, Button, Nav } from 'reactstrap';
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
import {
  createQueryParams,
  parseQueryParams,
  updateQueryParams,
} from '../helpers/url';
import InputFilter from '../shared/InputFilter';

import { resultColorMap, getIcon } from './helpers';
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
      showParentMatches: false,
      testGroup: params.get('testGroup') || '',
      selectedTest: params.get('selectedTest') || '',
      selectedTaskId: params.get('selectedTaskId') || '',
      selectedJobName: params.get('selectedJobName') || '',
      searchStr: params.get('searchStr') || '',
      regressionsOrderBy: params.get('regressionsOrderBy') || 'count',
      regressionsGroupBy: params.get('regressionsGroupBy') || 'path',
      knownIssuesOrderBy: params.get('knownIssuesOrderBy') || 'count',
      knownIssuesGroupBy: params.get('knownIssuesGroupBy') || 'path',
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
    const { repo, revision } = this.state;
    const { data, failureStatus } = await PushModel.getHealth(repo, revision);
    const newState = !failureStatus ? data : { failureMessage: data };

    this.setState(newState);
    return newState;
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
      showParentMatches,
      testGroup,
      selectedTest,
      defaultTabIndex,
      selectedTaskId,
      selectedJobName,
      regressionsOrderBy,
      regressionsGroupBy,
      knownIssuesOrderBy,
      knownIssuesGroupBy,
    } = this.state;
    const { tests, commitHistory, linting, builds } = metrics;
    const needInvestigationCount = tests
      ? tests.details.needInvestigation.length
      : 0;

    const { notify } = this.props;
    return (
      <React.Fragment>
        <Navbar color="light" light expand="sm" className="w-100">
          {!!tests && (
            <Nav className="mb-2 pt-2 pl-3 justify-content-between w-100">
              <span />
              <span className="mr-2 d-flex">
                <Button
                  size="sm"
                  className="text-nowrap mr-1"
                  title="Toggle failures that also failed in the parent"
                  onClick={() =>
                    this.setState({ showParentMatches: !showParentMatches })
                  }
                >
                  {showParentMatches ? 'Hide' : 'Show'} parent matches
                </Button>
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
          <title>{`[${needInvestigationCount} failures] Push Health`}</title>
        </Helmet>
        <Container fluid className="mt-2 mb-5 max-width-default">
          {!!tests && !!currentRepo && (
            <React.Fragment>
              <Row>
                <Col xs="2">
                  <StatusProgress counts={status} />
                </Col>
                <Col className="mt-4 ml-2">
                  {commitHistory.details && (
                    <CommitHistory
                      history={commitHistory.details}
                      revision={revision}
                      currentRepo={currentRepo}
                      compareWithParent={this.compareWithParent}
                    />
                  )}
                </Col>
              </Row>
              <div className="mb-3" />
              <Tabs
                className="w-100 h-100 mr-5 mt-2"
                selectedTabClassName="selected-detail-tab"
                defaultIndex={defaultTabIndex}
              >
                <TabList className="font-weight-500 text-secondary d-flex justify-content-end border-bottom font-size-18">
                  <Tab className="pb-2 list-inline-item ml-4 pointable">
                    <span className="text-success">
                      <FontAwesomeIcon
                        icon={getIcon(linting.result)}
                        className={`mr-1 text-${
                          resultColorMap[linting.result]
                        }`}
                      />
                    </span>
                    Linting
                  </Tab>
                  <Tab className="list-inline-item ml-4 pointable">
                    <FontAwesomeIcon
                      icon={getIcon(builds.result)}
                      className={`mr-1 text-${resultColorMap[builds.result]}`}
                    />
                    Builds
                  </Tab>
                  <Tab className="list-inline-item ml-4 pointable">
                    <FontAwesomeIcon
                      fill={resultColorMap[tests.result]}
                      icon={getIcon(tests.result)}
                      className={`mr-1 text-${resultColorMap[tests.result]}`}
                    />
                    Tests
                  </Tab>
                </TabList>
                <div>
                  <TabPanel>
                    <JobListMetric
                      data={linting}
                      repo={repo}
                      revision={revision}
                      setExpanded={this.setExpanded}
                      showParentMatches={showParentMatches}
                    />
                  </TabPanel>
                  <TabPanel>
                    <JobListMetric
                      data={builds}
                      repo={repo}
                      revision={revision}
                      setExpanded={this.setExpanded}
                      showParentMatches={showParentMatches}
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
                      showParentMatches={showParentMatches}
                      regressionsOrderBy={regressionsOrderBy}
                      regressionsGroupBy={regressionsGroupBy}
                      knownIssuesOrderBy={knownIssuesOrderBy}
                      knownIssuesGroupBy={knownIssuesGroupBy}
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
              <span className="ml-2 pb-1">
                Gathering health data and comparing with parent push...
              </span>
            </h4>
          )}
        </Container>
      </React.Fragment>
    );
  }
}

Health.propTypes = {
  location: PropTypes.shape({}).isRequired,
};
