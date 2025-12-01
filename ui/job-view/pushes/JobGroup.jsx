import React from 'react';
import PropTypes from 'prop-types';
import countBy from 'lodash/countBy';

import { thFailureResults } from '../../helpers/constants';
import { getUrlParam } from '../../helpers/location';
import { getBtnClass } from '../../helpers/job';

import JobButton from './JobButton';
import JobCount from './JobCount';

const GroupSymbol = function GroupSymbol(props) {
  const { symbol, tier, toggleExpanded } = props;

  return (
    <button type="button" className="btn group-symbol" onClick={toggleExpanded}>
      {symbol}
      {tier !== 1 && <span className="small">[tier {tier}]</span>}
    </button>
  );
};

GroupSymbol.propTypes = {
  symbol: PropTypes.string.isRequired,
  toggleExpanded: PropTypes.func.isRequired,
  tier: PropTypes.number,
};

GroupSymbol.defaultProps = {
  tier: 1,
};

export class JobGroupComponent extends React.Component {
  constructor(props) {
    super(props);
    const { pushGroupState } = this.props;

    // The group should be expanded initially if the global group state is expanded
    const groupState = getUrlParam('group_state');

    this.state = {
      expanded: groupState === 'expanded' || pushGroupState === 'expanded',
    };

    this.jobButtonRefs = {};
    for (const job of this.props.group.jobs) {
      this.jobButtonRefs[job.id] = React.createRef();
    }
  }

  static getDerivedStateFromProps(nextProps, state) {
    // We should expand this group if it's own state is set to be expanded,
    // or if the push was set to have all groups expanded.
    return {
      expanded: state.expanded || nextProps.pushGroupState === 'expanded',
    };
  }

  setExpanded(isExpanded) {
    this.setState({ expanded: isExpanded });
  }

  toggleExpanded = () => {
    this.setState((prevState) => ({ expanded: !prevState.expanded }));
  };

  toggleAll() {
    const { toggleSelectedRunnableJob } = this.props;
    for (const ref of Object.values(this.jobButtonRefs)) {
      if (!ref.current.props.visible) {
        continue;
      }
      toggleSelectedRunnableJob(ref.current.props.job.signature);
      ref.current.toggleRunnableSelected();
    }
  }

  groupButtonsAndCounts(jobs, expanded) {
    const { duplicateJobsVisible, groupCountsExpanded } = this.props;
    let buttons = [];
    const counts = [];
    const selectedTaskRun = getUrlParam('selectedTaskRun');

    if (expanded || groupCountsExpanded) {
      // All buttons should be shown when the group is expanded
      buttons = jobs;
    } else {
      const stateCounts = {};
      const typeSymbolCounts = countBy(jobs, 'job_type_symbol');
      jobs.forEach((job) => {
        const { resultStatus, visible } = job;
        const { status } = getBtnClass(resultStatus);
        if (!visible) return;

        let countInfo = {
          status,
          countText: resultStatus,
        };
        if (
          thFailureResults.includes(resultStatus) ||
          (typeSymbolCounts[job.job_type_symbol] > 1 && duplicateJobsVisible)
        ) {
          // render the job itself, not a count
          buttons.push(job);
        } else {
          countInfo = { ...countInfo, ...stateCounts[countInfo.status] };
          if (selectedTaskRun === job.task_run || countInfo.selectedClasses) {
            countInfo.selectedClasses = ' selected-count btn-lg-xform';
          } else {
            countInfo.selectedClasses = '';
          }
          if (stateCounts[countInfo.status]) {
            countInfo.count = stateCounts[countInfo.status].count + 1;
          } else {
            countInfo.count = 1;
          }
          countInfo.lastJob = job;
          stateCounts[countInfo.status] = countInfo;
        }
      });
      Object.entries(stateCounts).forEach(([, countInfo]) => {
        if (countInfo.count === 1) {
          buttons.push(countInfo.lastJob);
        } else {
          counts.push(countInfo);
        }
      });
    }
    return { buttons, counts };
  }

  render() {
    const {
      repoName,
      filterPlatformCb,
      filterModel,
      group: {
        name: groupName,
        symbol: groupSymbol,
        tier: groupTier,
        jobs: groupJobs,
        mapKey: groupMapKey,
      },
      intermittentJobTypeNames,
      runnableVisible,
    } = this.props;
    const { expanded } = this.state;
    const { buttons, counts } = this.groupButtonsAndCounts(groupJobs, expanded);

    function isIntermittent(job) {
      if (job.result !== 'testfailed') {
        return false;
      }

      return intermittentJobTypeNames.has(job.job_type_name);
    }

    return (
      <span className="platform-group" data-group-key={groupMapKey}>
        <span className="disabled job-group" title={groupName}>
          <GroupSymbol
            symbol={groupSymbol}
            tier={groupTier}
            toggleExpanded={this.toggleExpanded}
          />
          {runnableVisible && expanded && (
            <button
              className="btn group-select-all-runnable"
              type="button"
              title="Select or deselect all jobs in this group"
              onClick={this.toggleAll.bind(this)}
            >
              [All]
            </button>
          )}
          <span className="group-content">
            <span className="group-job-list">
              {buttons.map((job) => (
                <JobButton
                  job={job}
                  filterModel={filterModel}
                  visible={job.visible}
                  resultStatus={job.resultStatus}
                  failureClassificationId={job.failure_classification_id}
                  repoName={repoName}
                  filterPlatformCb={filterPlatformCb}
                  intermittent={isIntermittent(job)}
                  key={job.id}
                  ref={this.jobButtonRefs[job.id]}
                />
              ))}
            </span>
            <span className="group-count-list">
              {counts.map((countInfo) => (
                <JobCount
                  count={countInfo.count}
                  onClick={this.toggleExpanded}
                  className={countInfo.selectedClasses}
                  status={countInfo.status}
                  title={`${countInfo.count} ${countInfo.countText} jobs in group`}
                  key={countInfo.lastJob.id}
                />
              ))}
            </span>
          </span>
        </span>
      </span>
    );
  }
}

JobGroupComponent.propTypes = {
  group: PropTypes.shape({}).isRequired,
  confirmGroup: PropTypes.shape({}).isRequired,
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
};

export default JobGroupComponent;
