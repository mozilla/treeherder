import React from 'react';
import PropTypes from 'prop-types';
import { Table, Container, Spinner } from 'reactstrap';

import ErrorMessages from '../shared/ErrorMessages';
import NotificationList from '../shared/NotificationList';
import {
  clearNotificationAtIndex,
  clearExpiredTransientNotifications,
} from '../helpers/notifications';
import PushModel from '../models/push';
import StatusProgress from '../shared/StatusProgress';
import { getPercentComplete } from '../helpers/display';

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
    };
  }

  componentDidMount() {
    // Get the test data
    this.updatePushHealth();

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
    } = this.state;
    const { tests, linting, builds, performance } = metrics;
    const { currentRepo } = this.props;
    const percentComplete = status ? getPercentComplete(status) : 0;

    return (
      <React.Fragment>
        <Navigation
          user={user}
          setUser={this.setUser}
          notify={this.notify}
          result={result}
          repo={repo}
          revision={revision}
        />
        <Container fluid className="mt-2">
          <NotificationList
            notifications={notifications}
            clearNotification={this.clearNotification}
          />
          {!!tests && !!currentRepo && (
            <div className="d-flex flex-column">
              <Table size="sm" className="table-fixed">
                <tbody>
                  <tr>
                    <Metric name="Progress" result="">
                      <div>
                        <div>{percentComplete}% Complete</div>
                        <StatusProgress counts={status} />
                      </div>
                    </Metric>
                  </tr>
                  <tr>
                    <JobListMetric
                      data={linting}
                      repo={repo}
                      revision={revision}
                    />
                  </tr>
                  <tr>
                    <JobListMetric
                      data={builds}
                      repo={repo}
                      revision={revision}
                    />
                  </tr>
                  <tr>
                    <TestMetric
                      data={tests}
                      repo={repo}
                      currentRepo={currentRepo}
                      revision={revision}
                      user={user}
                      notify={this.notify}
                    />
                  </tr>
                  <tr>
                    <JobListMetric
                      data={performance}
                      repo={repo}
                      revision={revision}
                    />
                  </tr>
                </tbody>
              </Table>
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
