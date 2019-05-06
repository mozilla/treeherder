import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';

import PushModel from '../models/push';
import { getPushHealthUrl } from '../helpers/url';

class PushHealthStatus extends Component {
  constructor(props) {
    super(props);

    this.state = {
      healthStatus: 'Loading...',
      needInvestigation: 0,
    };
  }

  async componentDidMount() {
    await this.loadLatestStatus();
  }

  shouldComponentUpdate(nextProps, nextState) {
    const { jobCounts } = this.props;
    const { healthStatus } = this.state;

    return (
      jobCounts !== nextProps.jobCounts ||
      healthStatus !== nextState.healthStatus
    );
  }

  async componentDidUpdate() {
    await this.loadLatestStatus();
  }

  async loadLatestStatus() {
    const { repoName, pushId } = this.props;

    PushModel.getHealthSummary(repoName, pushId).then(resp => {
      const { data, error } = resp;
      if (!error) {
        const { needInvestigation } = data;
        const testsNeed = needInvestigation > 1 ? 'tests need' : 'test needs';
        const healthStatus = needInvestigation
          ? `${needInvestigation} ${testsNeed} investigation`
          : 'OK';

        this.setState({ healthStatus, needInvestigation });
      }
    });
  }

  render() {
    const { repoName, revision } = this.props;
    const { healthStatus, needInvestigation } = this.state;
    const color = needInvestigation ? 'danger' : 'success';
    const extraTitle = needInvestigation
      ? 'Count of tests that need investigation'
      : 'Push looks good';

    return (
      <a
        href={getPushHealthUrl({ repo: repoName, revision })}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Badge
          color={color}
          title={`Push Health status for Tests only - click for details: ${extraTitle}`}
        >
          {healthStatus}
        </Badge>
      </a>
    );
  }
}

PushHealthStatus.propTypes = {
  pushId: PropTypes.number.isRequired,
  revision: PropTypes.string.isRequired,
  repoName: PropTypes.string.isRequired,
  jobCounts: PropTypes.shape({
    pending: PropTypes.number.isRequired,
    running: PropTypes.number.isRequired,
    completed: PropTypes.number.isRequired,
  }).isRequired,
};

export default PushHealthStatus;
