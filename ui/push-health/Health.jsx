import React from 'react';
import PropTypes from 'prop-types';
import { Button, Navbar, Nav, Container, Row, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

import ErrorMessages from '../shared/ErrorMessages';
import NotificationList from '../shared/NotificationList';
import {
  clearNotificationAtIndex,
  clearExpiredTransientNotifications,
} from '../helpers/notifications';
import PushModel from '../models/push';
import StatusProgress from '../shared/StatusProgress';
import { getPercentComplete } from '../helpers/display';
import {
  createQueryParams,
  parseQueryParams,
  updateQueryParams,
} from '../helpers/url';
import InputFilter from '../shared/InputFilter';

import { resultColorMap } from './helpers';
import Metric from './Metric';
import Navigation from './Navigation';
import TestMetric from './TestMetric';
import JobListMetric from './JobListMetric';

export default class Health extends React.PureComponent {
  constructor(props) {
    super(props);

    const params = new URLSearchParams(props.location.search);

    this.state = {
      user: { isLoggedIn: false },
      revision: params.get('revision'),
      repo: params.get('repo'),
      metrics: {},
      result: null,
      failureMessage: null,
      notifications: [],
      progressExpanded: true,
      lintingExpanded: false,
      buildsExpanded: false,
      testsExpanded: false,
      performanceExpanded: false,
      searchStr: params.get('searchStr') || '',
    };
  }

  async componentDidMount() {
    // Get the test data
    const { metrics } = await this.updatePushHealth();
    const expandedStates = Object.entries(metrics).reduce(
      (acc, [key, metric]) => ({
        ...acc,
        [`${key}Expanded`]: metric.result !== 'pass',
      }),
      {},
    );

    this.setState(expandedStates);

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

  setUser = user => {
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
      severity: severity || 'info',
      created: Date.now(),
    };
    const newNotifications = [notification, ...notifications];

    this.setState({
      notifications: newNotifications,
    });
  };

  clearNotification = index => {
    const { notifications } = this.state;

    this.setState(clearNotificationAtIndex(notifications, index));
  };

  toggleExpanded = metricName => {
    const key = `${metricName.toLowerCase()}Expanded`;
    const { [key]: oldToggle } = this.state;

    this.setState({
      [key]: !oldToggle,
    });
  };

  filter = searchStr => {
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
      user,
      repo,
      revision,
      failureMessage,
      notifications,
      status,
      progressExpanded,
      lintingExpanded,
      buildsExpanded,
      testsExpanded,
      performanceExpanded,
      searchStr,
    } = this.state;
    const { tests, linting, builds, performance } = metrics;
    const { currentRepo } = this.props;
    const percentComplete = status ? getPercentComplete(status) : 0;
    const progress = {
      name: 'Progress',
      value: percentComplete,
      result: percentComplete === 100 ? 'done' : 'in progress',
    };

    return (
      <React.Fragment>
        <Navigation
          user={user}
          setUser={this.setUser}
          notify={this.notify}
          result={result}
          repo={repo}
          revision={revision}
        >
          <Navbar color="light" light expand="sm">
            {!!tests && (
              <Nav className="metric-buttons mb-2 pt-2 pl-3 justify-content-between w-100">
                <span>
                  {[progress, linting, builds, tests, performance].map(
                    metric => (
                      <Button
                        size="sm"
                        className="mr-2"
                        color={resultColorMap[metric.result]}
                        title={`Click to toggle ${
                          metric.name
                        }: ${metric.result.toUpperCase()}`}
                        onClick={() => this.toggleExpanded(metric.name)}
                        key={metric.name}
                      >
                        {metric.name}
                        {['pass', 'fail', 'indeterminate'].includes(
                          metric.result,
                        ) ? (
                          <FontAwesomeIcon
                            className="ml-1"
                            icon={
                              metric.result === 'pass'
                                ? faCheckCircle
                                : faExclamationTriangle
                            }
                          />
                        ) : (
                          <span className="ml-1">{metric.value}%</span>
                        )}
                      </Button>
                    ),
                  )}
                </span>
                <span className="mr-2">
                  <InputFilter
                    updateFilterText={this.filter}
                    placeholder="filter path or platform"
                  />
                </span>
              </Nav>
            )}
          </Navbar>
        </Navigation>
        <Container fluid className="mt-2">
          <NotificationList
            notifications={notifications}
            clearNotification={this.clearNotification}
          />
          {!!tests && !!currentRepo && (
            <div className="d-flex flex-column">
              <Row className="w-100">
                <Metric
                  name="Progress"
                  result=""
                  expanded={progressExpanded}
                  toggleExpanded={this.toggleExpanded}
                >
                  <div>
                    <div>{percentComplete}% Complete</div>
                    <StatusProgress counts={status} />
                  </div>
                </Metric>
              </Row>
              <Row>
                <JobListMetric
                  data={linting}
                  repo={repo}
                  revision={revision}
                  expanded={lintingExpanded}
                  toggleExpanded={this.toggleExpanded}
                />
              </Row>
              <Row>
                <JobListMetric
                  data={builds}
                  repo={repo}
                  revision={revision}
                  expanded={buildsExpanded}
                  toggleExpanded={this.toggleExpanded}
                />
              </Row>
              <Row>
                <TestMetric
                  data={tests}
                  repo={repo}
                  currentRepo={currentRepo}
                  revision={revision}
                  user={user}
                  notify={this.notify}
                  expanded={testsExpanded}
                  toggleExpanded={this.toggleExpanded}
                  searchStr={searchStr}
                />
              </Row>
              <Row>
                <JobListMetric
                  data={performance}
                  repo={repo}
                  revision={revision}
                  expanded={performanceExpanded}
                  toggleExpanded={this.toggleExpanded}
                />
              </Row>
            </div>
          )}
          {failureMessage && <ErrorMessages failureMessage={failureMessage} />}
          {!failureMessage && !tests && <Spinner />}
        </Container>
      </React.Fragment>
    );
  }
}

Health.propTypes = {
  location: PropTypes.object.isRequired,
  currentRepo: PropTypes.object,
};

Health.defaultProps = {
  currentRepo: null,
};
