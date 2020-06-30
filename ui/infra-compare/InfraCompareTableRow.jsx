import React from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip } from 'reactstrap';

import { getJobsUrl } from '../helpers/url';

export default class InfraCompareTableRow extends React.PureComponent {
  render() {
    const {
      hashkey,
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
      <tr color="danger">
        <th className="text-left">{suite}</th>
        <td>
          <span
            style={{ textDecoration: 'underline', color: 'blue' }}
            id={`originalValue${hashkey}`}
          >
            {originalValue}
          </span>
          <UncontrolledTooltip
            placement="top"
            target={`originalValue${hashkey}`}
            autohide={false}
          >
            {originalJobs.size > 0 ? (
              Array.from(originalJobs).map(([jobName, durations]) => (
                <p>
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
          </UncontrolledTooltip>
        </td>
        <td>
          {originalValue < newValue && <span>&lt;</span>}
          {originalValue > newValue && <span>&gt;</span>}
        </td>
        <td>
          <span
            style={{ textDecoration: 'underline', color: 'blue' }}
            id={`newValue${hashkey}`}
          >
            {newValue}
          </span>
        </td>
        <UncontrolledTooltip
          placement="top"
          target={`newValue${hashkey}`}
          autohide={false}
        >
          {newJobs.size > 0 ? (
            Array.from(newJobs).map(([jobName, duration]) => (
              <p>
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
        </UncontrolledTooltip>
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
