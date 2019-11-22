import React from 'react';
import PropTypes from 'prop-types';
import { Table, Container, Spinner } from 'reactstrap';

import ErrorMessages from '../shared/ErrorMessages';
import NotificationList from '../shared/NotificationList';
import { getJobsUrl } from '../helpers/url';
import {
  clearNotificationAtIndex,
  clearExpiredTransientNotifications,
} from '../helpers/notifications';
import PushModel from '../models/push';

import { resultColorMap } from './helpers';
import Metric from './Metric';
import Navigation from './Navigation';
import TestFailures from './TestFailures';

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
    } = this.state;
    const { tests, linting, builds, coverage, performance } = metrics;
    const { currentRepo } = this.props;
    const overallResult = result ? resultColorMap[result] : 'none';

    return (
      <React.Fragment>
        <Navigation user={user} setUser={this.setUser} notify={this.notify} />
        <Container fluid className="mt-2">
          <NotificationList
            notifications={notifications}
            clearNotification={this.clearNotification}
          />
          {!!tests && !!currentRepo && (
            <div className="d-flex flex-column">
              <h3 className="text-center">
                <span className={`badge badge-xl mb-3 badge-${overallResult}`}>
                  <a
                    href={getJobsUrl({ repo, revision })}
                    className="text-white"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {repo} - {revision}
                  </a>
                </span>
              </h3>
              <Table size="sm" className="table-fixed">
                <tbody>
                  <tr>
                    <TestFailures
                      data={tests}
                      repo={repo}
                      currentRepo={currentRepo}
                      revision={revision}
                      user={user}
                      notify={this.notify}
                    />
                  </tr>
                  {[linting, builds, coverage, performance].map(metric => (
                    <tr>
                      <Metric result={metric.result} name={metric.name}>
                        <div>
                          {metric.details.map(detail => (
                            <div>{detail}</div>
                          ))}
                        </div>
                      </Metric>
                    </tr>
                  ))}
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
