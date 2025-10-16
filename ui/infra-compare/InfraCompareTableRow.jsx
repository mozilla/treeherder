import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

import { getJobsUrl } from '../helpers/url';

export default class InfraCompareTableRow extends React.PureComponent {
  render() {
    const {
      rowLevelResults: {
        suite,
        platform,
        originalValue,
        newValue,
        originalFailures,
        newFailures,
        originalDataPoints,
        newDataPoints,
        newJobs,
        originalJobs,
      },
      validated: { originalProject, newProject, originalRevision, newRevision },
    } = this.props;

    return (
      <tr className="table-danger">
        <th className="text-left">{suite}</th>
        <td>
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip>
                {originalJobs.size > 0 ? (
                  Array.from(originalJobs).map(([jobName, durations]) => (
                    <p key={jobName}>
                      {jobName}: {durations.join(', ')}
                    </p>
                  ))
                ) : (
                  <p className="lead text-center">No jobs to show</p>
                )}
                <a
                  href={getJobsUrl({
                    repo: originalProject,
                    revision: originalRevision,
                    searchStr: `${platform} ${suite}`,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Go to treeherder Job View
                </a>
              </Tooltip>
            }
            delay={{ show: 0, hide: 0 }}
          >
            <span style={{ textDecoration: 'underline', color: 'blue' }}>
              {originalValue}
            </span>
          </OverlayTrigger>
        </td>
        <td>
          {originalValue < newValue && <span>&lt;</span>}
          {originalValue > newValue && <span>&gt;</span>}
        </td>
        <td>
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip>
                {newJobs.size > 0 ? (
                  Array.from(newJobs).map(([jobName, duration]) => (
                    <p key={jobName}>
                      {jobName}: {duration.join(', ')}
                    </p>
                  ))
                ) : (
                  <p className="lead text-center">No jobs to show</p>
                )}
                <a
                  href={getJobsUrl({
                    repo: newProject,
                    revision: newRevision,
                    searchStr: `${platform} ${suite}`,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Go to treeherder Job View
                </a>
              </Tooltip>
            }
            delay={{ show: 0, hide: 0 }}
          >
            <span style={{ textDecoration: 'underline', color: 'blue' }}>
              {newValue}
            </span>
          </OverlayTrigger>
        </td>
        <td>{originalFailures}</td>
        <td>
          {originalFailures < newFailures && <span>&lt;</span>}
          {originalFailures > newFailures && <span>&gt;</span>}
        </td>
        <td>{newFailures}</td>
        <td>{originalDataPoints}</td>
        <td>
          {originalDataPoints < newDataPoints && <span>&lt;</span>}
          {originalDataPoints > newDataPoints && <span>&gt;</span>}
        </td>
        <td>{newDataPoints}</td>
      </tr>
    );
  }
}

InfraCompareTableRow.propTypes = {
  user: PropTypes.shape({}).isRequired,
  rowLevelResults: PropTypes.shape({}).isRequired,
  validated: PropTypes.shape({}).isRequired,
};
