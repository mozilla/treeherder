import React from 'react';
import PropTypes from 'prop-types';
import { Button, Navbar, Nav, Container, Row, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import camelCase from 'lodash/camelCase';

import ErrorMessages from '../shared/ErrorMessages';
import NotificationList from '../shared/NotificationList';
import {
  clearNotificationAtIndex,
  clearExpiredTransientNotifications,
} from '../helpers/notifications';
import PushModel from '../models/push';
import StatusProgress from '../shared/StatusProgress';
import { getPercentComplete } from '../helpers/display';
import { scrollToLine } from '../helpers/utils';
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
import ParentPush from './ParentPush';

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
      parentPushExpanded: false,
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
        [`${key}Expanded`]: metric.result === 'fail',
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
      severity: severity || 'darker-info',
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
      parentPushExpanded,
      lintingExpanded,
      buildsExpanded,
      testsExpanded,
      performanceExpanded,
      searchStr,
    } = this.state;
    const { tests, parent, linting, builds, performance } = metrics;
    const { currentRepo } = this.props;
    const percentComplete = status ? getPercentComplete(status) : 0;
    const progress = {
      name: 'Progress',
      value: `${percentComplete}%`,
      result: percentComplete === 100 ? 'done' : 'in progress',
      details: [],
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
          <Navbar color="light" light expand="sm" className="w-100">
            {!!tests && (
              <Nav className="metric-buttons mb-2 pt-2 pl-3 justify-content-between w-100">
                <span>
                  {[progress, linting, builds, tests, performance, parent].map(
                    metric => (
                      <span key={metric.name}>
                        {!!metric.details && (
                          <Button
                            size="sm"
                            className="mr-2"
                            color={resultColorMap[metric.result]}
                            title={`Click to toggle ${
                              metric.name
                            }: ${metric.result.toUpperCase()}`}
                            onClick={() => this.setExpanded(metric.name, true)}
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
                              <span className="ml-1">{metric.value}</span>
                            )}
                          </Button>
                        )}
                      </span>
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
        <Container fluid className="mt-2 mb-5">
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
                  setExpanded={this.setExpanded}
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
                  setExpanded={this.setExpanded}
                />
              </Row>
              <Row>
                <JobListMetric
                  data={builds}
                  repo={repo}
                  revision={revision}
                  expanded={buildsExpanded}
                  setExpanded={this.setExpanded}
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
                  setExpanded={this.setExpanded}
                  searchStr={searchStr}
                />
              </Row>
              <Row>
                <JobListMetric
                  data={performance}
                  repo={repo}
                  revision={revision}
                  expanded={performanceExpanded}
                  setExpanded={this.setExpanded}
                />
              </Row>
              {parent.details && (
                <Row className="w-100">
                  <Metric
                    name="Parent Push"
                    result=""
                    expanded={parentPushExpanded}
                    setExpanded={this.setExpanded}
                  >
                    <ParentPush parent={parent.details} />
                  </Metric>
                </Row>
              )}
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
