import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Badge, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

import PushModel from '../models/push';
import { getPushHealthUrl } from '../helpers/url';
import { didObjectsChange } from '../helpers/object';

class PushHealthStatus extends Component {
  constructor(props) {
    super(props);

    this.state = {
      unsupported: null,
      needInvestigation: null,
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
      this.setState({ ...data });
    }
  }

  render() {
    const { repoName, revision } = this.props;
    const { needInvestigation, unsupported } = this.state;
    const testsNeed = needInvestigation > 1 ? 'tests need' : 'test needs';
    const icon =
      needInvestigation + unsupported === 0 ? faCheck : faExclamationTriangle;
    let healthStatus = 'OK';
    let badgeColor = 'success';
    let extraTitle = 'Looks good';

    if (unsupported) {
      healthStatus = `${unsupported} unsupported tests`;
      badgeColor = 'warning';
      extraTitle = 'Indeterminate';
    }
    if (needInvestigation) {
      healthStatus = `${needInvestigation} ${testsNeed} investigation`;
      badgeColor = 'danger';
      extraTitle = 'Needs investigation';
    }

    return (
      <React.Fragment>
        {needInvestigation !== null ? (
          <a
            href={getPushHealthUrl({ repo: repoName, revision })}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`health-status-${revision}`}
          >
            <Badge
              color={badgeColor}
              title={`Push Health status - click for details: ${extraTitle}`}
            >
              <FontAwesomeIcon className="mr-1" icon={icon} />
              {healthStatus}
            </Badge>
          </a>
        ) : (
          <Spinner size="sm" />
        )}
      </React.Fragment>
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
