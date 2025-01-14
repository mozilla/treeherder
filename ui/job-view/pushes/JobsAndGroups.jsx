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
      runnableVisible,
      toggleSelectedRunnableJob,
    } = this.props;

    const confirmGroups = {};
    for (const g of groups) {
      // group.mapKey == pushID groupSymbol Tier platform buildtype
      // find matching group.mapKey
      if (g.symbol.endsWith('-cf')) {
        let foundTier = false;
        let gname = '';
        for (let tier = 1; tier <= 3; tier++) {
          gname = g.mapKey.replace('-cf3', tier);
          for (const t of groups) {
            if (t.mapKey === gname) foundTier = true;
          }
          if (foundTier) break;
        }

        if (foundTier) {
          confirmGroups[gname] = g;
        }
      }
    }

    return (
      <td className="job-row">
        {groups.map((group) => {
          if (group.tier !== 1 || group.symbol !== '') {
            return (
              group.visible && (
                <JobGroup
                  group={group}
                  confirmGroup={
                    confirmGroups[group.mapKey] === undefined
                      ? {}
                      : confirmGroups[group.mapKey]
                  }
                  repoName={repoName}
                  filterModel={filterModel}
                  filterPlatformCb={filterPlatformCb}
                  key={group.mapKey}
                  pushGroupState={pushGroupState}
                  duplicateJobsVisible={duplicateJobsVisible}
                  groupCountsExpanded={groupCountsExpanded}
                  runnableVisible={runnableVisible}
                  toggleSelectedRunnableJob={toggleSelectedRunnableJob}
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
  groups: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
};
