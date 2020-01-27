import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';

import PushModel from '../models/push';
import { getPushHealthUrl } from '../helpers/url';
import { didObjectsChange } from '../helpers/object';

class PushHealthStatus extends Component {
  constructor(props) {
    super(props);

    this.state = {
      healthStatus: '',
      needInvestigation: 0,
    };
  }

  async componentDidMount() {
    const {
      jobCounts: { completed },
    } = this.props;

    if (completed > 0) {
      await this.loadLatestStatus();
    }
  }

  async componentDidUpdate(prevProps) {
    const { jobCounts } = this.props;
    const fields = ['completed', 'fixedByCommit', 'pending', 'running'];

    if (didObjectsChange(jobCounts, prevProps.jobCounts, fields)) {
      await this.loadLatestStatus();
    }
  }

  async loadLatestStatus() {
    const { repoName, revision } = this.props;
    const { data, failureStatus } = await PushModel.getHealthSummary(
      repoName,
      revision,
    );

    if (!failureStatus) {
      const { needInvestigation } = data;
      const testsNeed = needInvestigation > 1 ? 'tests need' : 'test needs';
      const healthStatus = needInvestigation
        ? `${needInvestigation} ${testsNeed} investigation`
        : 'OK';

      this.setState({ healthStatus, needInvestigation });
    }
  }

  render() {
    const { repoName, revision } = this.props;
    const { healthStatus, needInvestigation } = this.state;
    const color = needInvestigation ? 'danger' : 'success';
    const extraTitle = needInvestigation ? 'Needs investigation' : 'Looks good';

    return (
      <a
        href={getPushHealthUrl({ repo: repoName, revision })}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Badge
          color={color}
          title={`Push Health status - click for details: ${extraTitle}`}
        >
          {healthStatus}
        </Badge>
      </a>
    );
  }
}

PushHealthStatus.propTypes = {
  revision: PropTypes.string.isRequired,
  repoName: PropTypes.string.isRequired,
  jobCounts: PropTypes.shape({
    pending: PropTypes.number.isRequired,
    running: PropTypes.number.isRequired,
    completed: PropTypes.number.isRequired,
  }).isRequired,
};

export default PushHealthStatus;
