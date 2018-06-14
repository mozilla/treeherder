import PropTypes from 'prop-types';
import React from 'react';
import JobButton from './JobButton';
import JobGroup from './JobGroup';
import { getStatus } from '../../helpers/job';

export default class JobsAndGroups extends React.Component {
  render() {
    const {
      groups, repoName, platform, filterPlatformCb, filterModel,
      pushGroupState, duplicateJobsVisible, groupCountsExpanded,
    } = this.props;

    return (
      <td className="job-row" data-job-clear-on-click>
        {groups.map((group) => {
          if (group.tier !== 1 || group.symbol !== '') {
            return (
              group.visible && <JobGroup
                group={group}
                repoName={repoName}
                filterModel={filterModel}
                filterPlatformCb={filterPlatformCb}
                platform={platform}
                key={group.mapKey}
                pushGroupState={pushGroupState}
                duplicateJobsVisible={duplicateJobsVisible}
                groupCountsExpanded={groupCountsExpanded}
              />
            );
          }
          return (
            group.jobs.map(job => (
              <JobButton
                job={job}
                filterModel={filterModel}
                repoName={repoName}
                visible={job.visible}
                status={getStatus(job)}
                failureClassificationId={job.failure_classification_id}
                filterPlatformCb={filterPlatformCb}
                platform={platform}
                key={job.id}
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
  filterModel: PropTypes.object.isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  platform: PropTypes.object.isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
};
