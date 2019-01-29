import React from 'react';
import PropTypes from 'prop-types';
import { Table, Container } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import { getJobsUrl } from '../helpers/url';

import { healthData, resultColorMap } from './helpers';
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

  updatePushHealth = () => {
    this.setState({ healthData });
  };

  render() {
    const { healthData, user, repo, revision } = this.state;
    const overallResult = healthData
      ? resultColorMap[healthData.result]
      : 'none';

    return (
      <React.Fragment>
        <Navigation user={user} setUser={this.setUser} />
        <Container fluid>
          {healthData ? (
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
          ) : (
            <div>
              <FontAwesomeIcon icon={faSpinner} size="2x" spin />
            </div>
          )}
        </Container>
      </React.Fragment>
    );
  }
}

Health.propTypes = {
  location: PropTypes.object.isRequired,
};
