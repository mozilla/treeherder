import _ from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';

import JobButton from './JobButton';
import JobCountComponent from './JobCount';
import { getBtnClass, getStatus } from "../helpers/job";
import { getUrlParam } from "../helpers/location";
import { thFailureResults, thEvents } from "../js/constants";

class GroupSymbol extends React.PureComponent {
  render() {
    const { symbol, tier, toggleExpanded } = this.props;
    const groupSymbol = symbol === '?' ? '' : symbol;

    return (
      <button
        className="btn group-symbol"
        onClick={toggleExpanded}
      >{groupSymbol}{tier !== 1 && <span className="small text-muted">[tier {tier}]</span>}
      </button>
    );
  }
}

GroupSymbol.propTypes = {
  symbol: PropTypes.string.isRequired,
  tier: PropTypes.number.isRequired,
  toggleExpanded: PropTypes.func.isRequired,
};


export default class JobGroup extends React.Component {
  constructor(props) {
    super(props);
    const { $injector } = this.props;
    this.$rootScope = $injector.get('$rootScope');

    // The group should be expanded initially if the global group state is expanded
    const groupState = getUrlParam('group_state');
    const duplicateJobs = getUrlParam('duplicate_jobs');
    this.state = {
      expanded: groupState === 'expanded',
      showDuplicateJobs: duplicateJobs === 'visible',
    };
  }

  componentWillMount() {
    this.duplicateJobsVisibilityChangedUnlisten = this.$rootScope.$on(
      thEvents.duplicateJobsVisibilityChanged,
      () => {
        this.setState({ showDuplicateJobs: !this.state.showDuplicateJobs });
      }
    );

    this.groupStateChangedUnlisten = this.$rootScope.$on(
      thEvents.groupStateChanged,
      (e, newState) => {
        this.setState({ expanded: newState === 'expanded' });
      }
    );
    this.toggleExpanded = this.toggleExpanded.bind(this);
  }

  componentWillUnmount() {
    this.duplicateJobsVisibilityChangedUnlisten();
    this.groupStateChangedUnlisten();
  }

  toggleExpanded() {
    this.setState({ expanded: !this.state.expanded });
  }

  groupButtonsAndCounts(jobs, expanded, showDuplicateJobs) {
    let buttons = [];
    const counts = [];
    if (expanded) {
      // All buttons should be shown when the group is expanded
      buttons = jobs;
    } else {
      const stateCounts = {};
      const typeSymbolCounts = _.countBy(jobs, 'job_type_symbol');
      jobs.forEach((job) => {
        if (!job.visible) return;
        const status = getStatus(job);
        let countInfo = {
          btnClass: getBtnClass(status, job.failure_classification_id),
          countText: status
        };
        if (thFailureResults.includes(status) ||
          (typeSymbolCounts[job.job_type_symbol] > 1 && showDuplicateJobs)) {
          // render the job itself, not a count
          buttons.push(job);
        } else {
          const lastJobSelected = {};
          countInfo = { ...countInfo, ...stateCounts[countInfo.btnClass] };
          if (!_.isEmpty(lastJobSelected.job) && (lastJobSelected.job.id === job.id)) {
            countInfo.selectedClasses = ['selected-count', 'btn-lg-xform'];
          } else {
            countInfo.selectedClasses = [];
          }
          if (stateCounts[countInfo.btnClass]) {
            countInfo.count = stateCounts[countInfo.btnClass].count + 1;
          } else {
            countInfo.count = 1;
          }
          countInfo.lastJob = job;
          stateCounts[countInfo.btnClass] = countInfo;
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
      $injector, repoName, filterPlatformCb, platform,
      group: { name: groupName, symbol: groupSymbol, tier: groupTier, jobs: groupJobs }
    } = this.props;
    const { expanded, showDuplicateJobs } = this.state;
    const { buttons, counts } = this.groupButtonsAndCounts(
      groupJobs,
      expanded,
      showDuplicateJobs
    );

    return (
      <span className="platform-group">
        <span
          className="disabled job-group"
          title={groupName}
        >
          <GroupSymbol
            symbol={groupSymbol}
            tier={groupTier}
            toggleExpanded={this.toggleExpanded}
          />
          <span className="group-content">
            <span className="group-job-list">
              {buttons.map(job => (
                <JobButton
                  job={job}
                  $injector={$injector}
                  visible={job.visible}
                  status={getStatus(job)}
                  failureClassificationId={job.failure_classification_id}
                  repoName={repoName}
                  filterPlatformCb={filterPlatformCb}
                  platform={platform}
                  key={job.id}
                />
              ))}
            </span>
            <span className="group-count-list">
              {counts.map(countInfo => (
                <JobCountComponent
                  count={countInfo.count}
                  onClick={this.toggleExpanded}
                  className={`${countInfo.btnClass}-count`}
                  title={`${countInfo.count} ${countInfo.countText} jobs in group`}
                  key={countInfo.lastJob.id}
                  countKey={countInfo.lastJob.id}
                />
              ))}
            </span>
          </span>
        </span>
      </span>
    );
  }
}

JobGroup.propTypes = {
  group: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  platform: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
};
