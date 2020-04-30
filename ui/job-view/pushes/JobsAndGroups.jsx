import PropTypes from 'prop-types';
import React from 'react';

import JobButton from './JobButton';
import JobGroup from './JobGroup';

export default class JobsAndGroups extends React.Component {
  render() {
    const {
      groups,
      repoName,
      filterPlatformCb,
      filterModel,
      pushGroupState,
      duplicateJobsVisible,
      groupCountsExpanded,
    } = this.props;

    return (
      <td className="job-row">
        {groups.map((group) => {
          if (group.tier !== 1 || group.symbol !== '') {
            return (
              group.visible && (
                <JobGroup
                  group={group}
                  repoName={repoName}
                  filterModel={filterModel}
                  filterPlatformCb={filterPlatformCb}
                  key={group.mapKey}
                  pushGroupState={pushGroupState}
                  duplicateJobsVisible={duplicateJobsVisible}
                  groupCountsExpanded={groupCountsExpanded}
                />
              )
            );
          }
          return group.jobs.map((job) => (
            <JobButton
              job={job}
              filterModel={filterModel}
              repoName={repoName}
              visible={job.visible}
              resultStatus={job.resultStatus}
              failureClassificationId={job.failure_classification_id}
              filterPlatformCb={filterPlatformCb}
              key={job.id}
            />
          ));
        })}
      </td>
    );
  }
}

JobsAndGroups.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.object).isRequired,
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
};
