import PropTypes from 'prop-types';
import React from 'react';
import JobButton from './JobButton';
import JobGroup from './JobGroup';
import { getStatus } from "../helpers/jobHelper";

export default class JobsAndGroups extends React.Component {
  render() {
    const { $injector, groups, repoName, platform, filterPlatformCb } = this.props;

    return (
      <td className="job-row">
        {groups.map((group, i) => {
          if (group.symbol !== '?') {
            return (
              group.visible && <JobGroup
                group={group}
                repoName={repoName}
                $injector={$injector}
                filterPlatformCb={filterPlatformCb}
                platform={platform}
                refOrder={i}
                key={group.mapKey}
                ref={i}
              />
            );
          }
          return (
            group.jobs.map(job => (
              <JobButton
                job={job}
                $injector={$injector}
                repoName={repoName}
                visible={job.visible}
                status={getStatus(job)}
                failureClassificationId={job.failure_classification_id}
                filterPlatformCb={filterPlatformCb}
                platform={platform}
                hasGroup={false}
                key={job.id}
                ref={i}
                refOrder={i}
              />
            ))
          );
        })}
      </td>
    );
  }
}

JobsAndGroups.propTypes = {
  groups: PropTypes.array.isRequired,
  repoName: PropTypes.string.isRequired,
  $injector: PropTypes.object.isRequired,
};
