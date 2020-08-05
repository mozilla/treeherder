import React from 'react';
import PropTypes from 'prop-types';
import { Button, Navbar, Nav, Container, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock,
  faExclamationTriangle,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import camelCase from 'lodash/camelCase';
import { Helmet } from 'react-helmet';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import faviconBroken from '../img/push-health-broken.png';
import faviconOk from '../img/push-health-ok.png';
import ErrorMessages from '../shared/ErrorMessages';
import NotificationList from '../shared/NotificationList';
import {
  clearNotificationAtIndex,
  clearExpiredTransientNotifications,
} from '../helpers/notifications';
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

import { resultColorMap } from './helpers';
import Navigation from './Navigation';
import TestMetric from './TestMetric';
import JobListMetric from './JobListMetric';
import CommitHistory from './CommitHistory';

export default class Health extends React.PureComponent {
  constructor(props) {
    super(props);

    const params = new URLSearchParams(props.location.search);

    this.state = {
      user: { isLoggedIn: false },
      revision: params.get('revision'),
      repo: params.get('repo'),
      currentRepo: null,
      metrics: {},
      jobs: null,
      result: null,
      failureMessage: null,
      notifications: [],
      defaultTabIndex: 0,
      showParentMatches: false,
      searchStr: params.get('searchStr') || '',
    };
  }

  async componentDidMount() {
    const { repo } = this.state;
    const {
      metrics: { linting, builds, tests },
    } = await this.updatePushHealth();
    const defaultTabIndex = [linting, builds, tests].findIndex(
      (metric) => metric.result === 'fail',
    );
    const repos = await RepositoryModel.getList();
    const currentRepo = repos.find((repoObj) => repoObj.name === repo);

    this.setState({ defaultTabIndex, currentRepo });

    // Update the tests every two minutes.
    this.testTimerId = setInterval(() => this.updatePushHealth(), 120000);
    this.notificationsId = setInterval(() => {
      const { notifications } = this.state;

      this.setState(clearExpiredTransientNotifications(notifications));
    }, 4000);
  }

  componentWillUnmount() {
    clearInterval(this.testTimerId);
  }

  setUser = (user) => {
    this.setState({ user });
  };

  updatePushHealth = async () => {
    const { repo, revision } = this.state;
    const { data, failureStatus } = await PushModel.getHealth(repo, revision);
    const newState = !failureStatus ? data : { failureMessage: data };

    this.setState(newState);
    return newState;
  };

  notify = (message, severity, options = {}) => {
    const { notifications } = this.state;
    const notification = {
      ...options,
      message,
      severity: severity || 'darker-info',
      created: Date.now(),
    };
    const newNotifications = [notification, ...notifications];

    this.setState({
      notifications: newNotifications,
    });
  };

  clearNotification = (index) => {
    const { notifications } = this.state;

    this.setState(clearNotificationAtIndex(notifications, index));
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

  getIcon = (result) => {
    switch (result) {
      case 'pass':
        return faCheck;
      case 'fail':
        return faExclamationTriangle;
    }
    return faClock;
  };

  render() {
    const {
      metrics,
      result,
      user,
      repo,
      revision,
      jobs,
      failureMessage,
      notifications,
      status,
      searchStr,
      currentRepo,
      showParentMatches,
      defaultTabIndex,
    } = this.state;
    const { tests, commitHistory, linting, builds } = metrics;
    const needInvestigationCount = tests
      ? tests.details.needInvestigation.length
      : 0;

    return (
      <React.Fragment>
        <Helmet>
          <link
            rel="shortcut icon"
            href={result === 'fail' ? faviconBroken : faviconOk}
          />
          <title>{`[${needInvestigationCount}] Push Health`}</title>
        </Helmet>
        <Navigation
          user={user}
          setUser={this.setUser}
          notify={this.notify}
          result={result}
          repo={repo}
          revision={revision}
        >
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
        </Navigation>
        <Container fluid className="mt-2 mb-5 max-width-default">
          <NotificationList
            notifications={notifications}
            clearNotification={this.clearNotification}
          />
          {!!tests && !!currentRepo && (
            <React.Fragment>
              <div className="d-flex mb-5">
                <StatusProgress counts={status} />
                <div className="mt-4 ml-2">
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
                className="w-100 h-100 mr-5 mt-2"
                selectedTabClassName="selected-detail-tab"
                defaultIndex={defaultTabIndex}
              >
                <TabList className="font-weight-500 text-secondary d-flex justify-content-end border-bottom font-size-18">
                  <Tab className="pb-2 list-inline-item ml-4 pointable">
                    <span className="text-success">
                      <FontAwesomeIcon
                        icon={this.getIcon(linting.result)}
                        className={`mr-1 text-${
                          resultColorMap[linting.result]
                        }`}
                      />
                    </span>
                    Linting
                  </Tab>
                  <Tab className="list-inline-item ml-4 pointable">
                    <FontAwesomeIcon
                      icon={this.getIcon(builds.result)}
                      className={`mr-1 text-${resultColorMap[builds.result]}`}
                    />
                    Builds
                  </Tab>
                  <Tab className="list-inline-item ml-4 pointable">
                    <FontAwesomeIcon
                      fill={resultColorMap[tests.result]}
                      icon={this.getIcon(tests.result)}
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
                      notify={this.notify}
                      setExpanded={this.setExpanded}
                      searchStr={searchStr}
                      showParentMatches={showParentMatches}
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
