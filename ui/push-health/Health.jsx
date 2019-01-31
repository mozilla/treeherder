import React from 'react';
import PropTypes from 'prop-types';
import { Table, Container, Spinner } from 'reactstrap';

import ErrorMessages from '../shared/ErrorMessages';
import { getJobsUrl } from '../helpers/url';
import PushModel from '../models/push';

import { resultColorMap } from './helpers';
import Metric from './Metric';
import Navigation from './Navigation';

export default class Health extends React.Component {
  constructor(props) {
    super(props);

    const params = new URLSearchParams(props.location.search);

    this.state = {
      user: { isLoggedIn: false },
      revision: params.get('revision'),
      repo: params.get('repo'),
      healthData: null,
      failureMessage: null,
      failureStatus: null,
    };
  }

  componentDidMount() {
    // Get the test data
    this.updatePushHealth();

    // Update the tests every two minutes.
    this.testTimerId = setInterval(() => this.updatePushHealth(), 120000);
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
    const newState = !failureStatus
      ? { healthData: data }
      : { failureMessage: data, failureStatus };

    this.setState(newState);
  };

  render() {
    const {
      healthData,
      user,
      repo,
      revision,
      failureMessage,
      failureStatus,
    } = this.state;
    const overallResult = healthData
      ? resultColorMap[healthData.result]
      : 'none';

    return (
      <React.Fragment>
        <Navigation user={user} setUser={this.setUser} />
        <Container fluid className="mt-2">
          {healthData && (
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
              <Table size="sm">
                <tbody>
                  {healthData.metrics.map(metric => (
                    <tr key={metric.name}>
                      <Metric
                        name={metric.name}
                        result={metric.result}
                        value={metric.value}
                        details={metric.details}
                        failures={metric.failures}
                        repo={repo}
                        revision={revision}
                      />
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          {failureMessage && (
            <ErrorMessages
              failureMessage={failureMessage}
              failureStatus={failureStatus}
            />
          )}
          {!failureMessage && !healthData && <Spinner />}
        </Container>
      </React.Fragment>
    );
  }
}

Health.propTypes = {
  location: PropTypes.object.isRequired,
};
