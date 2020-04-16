import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Badge, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faExclamationTriangle,
  faClock,
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
    const { repoName, revision, statusCallback } = this.props;
    const { data, failureStatus } = await PushModel.getHealthSummary(
      repoName,
      revision,
    );

    if (!failureStatus) {
      statusCallback(data);
      this.setState({ ...data });
    }
  }

  render() {
    const {
      repoName,
      revision,
      jobCounts: { pending, running, completed },
    } = this.props;
    const { needInvestigation, unsupported } = this.state;
    let healthStatus = 'In progress';
    let badgeColor = 'darker-secondary';
    let extraTitle = 'No errors so far';
    let icon = faClock;

    if (completed) {
      if (unsupported) {
        healthStatus = `${unsupported} unsupported ${
          unsupported > 1 ? 'items' : 'item'
        }`;
        badgeColor = 'warning';
        extraTitle = 'Indeterminate';
        icon = faExclamationTriangle;
      }
      if (needInvestigation) {
        healthStatus = `${needInvestigation} ${
          needInvestigation > 1 ? 'items' : 'item'
        }`;
        badgeColor = 'danger';
        extraTitle = 'Needs investigation';
        icon = faExclamationTriangle;
      }
      const inProgress = pending + running;
      if (!inProgress && !unsupported && !needInvestigation) {
        healthStatus = `OK`;
        badgeColor = 'success';
        extraTitle = 'Looks good';
        icon = faCheck;
      }
    }

    return (
      <span data-testid={`health-status-${revision}`}>
        {needInvestigation !== null ? (
          <a
            href={getPushHealthUrl({ repo: repoName, revision })}
            target="_blank"
            rel="noopener noreferrer"
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
      </span>
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
  statusCallback: PropTypes.func,
};

PushHealthStatus.defaultProps = {
  statusCallback: () => {},
};

export default PushHealthStatus;
