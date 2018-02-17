import PropTypes from 'prop-types';
import * as _ from 'lodash';
import JobButton from './JobButton';
import JobCountComponent from './JobCount';
import { getBtnClass, getStatus } from "../helpers/jobHelper";
import { getUrlParam } from "../helpers/locationHelper";

export default class JobGroup extends React.Component {
  constructor(props) {
    super(props);
    const { $injector } = this.props;
    this.$rootScope = $injector.get('$rootScope');
    this.thEvents = $injector.get('thEvents');

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
      this.thEvents.duplicateJobsVisibilityChanged,
      () => {
        this.setState({ showDuplicateJobs: !this.state.showDuplicateJobs });
      }
    );

    this.groupStateChangedUnlisten = this.$rootScope.$on(
      this.thEvents.groupStateChanged,
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

  groupButtonsAndCounts(jobs) {
    let buttons = [];
    const counts = [];
    const stateCounts = {};
    if (this.state.expanded) {
      // All buttons should be shown when the group is expanded
      buttons = jobs;
    } else {
      const typeSymbolCounts = _.countBy(jobs, 'job_type_symbol');
      jobs.forEach((job) => {
        if (!job.visible) return;
        const status = getStatus(job);
        let countInfo = {
          btnClass: getBtnClass(status, job.failure_classification_id),
          countText: status
        };
        if (['testfailed', 'busted', 'exception'].includes(status) ||
          (typeSymbolCounts[job.job_type_symbol] > 1 && this.state.showDuplicateJobs)) {
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
    const { group, $injector, repoName, filterPlatformCb, platform } = this.props;
    this.items = this.groupButtonsAndCounts(group.jobs);

    return (
      <span className="platform-group">
        <span
          className="disabled job-group"
          title={group.name}
          data-grkey={group.grkey}
        >
          <button
            className="btn group-symbol"
            data-ignore-job-clear-on-click
            onClick={this.toggleExpanded}
          >{group.symbol}{group.tier &&
            <span className="small text-muted">[tier {group.tier}]</span>
           }</button>

          <span className="group-content">
            <span className="group-job-list">
              {this.items.buttons.map((job, i) => (
                <JobButton
                  job={job}
                  $injector={$injector}
                  visible={job.visible}
                  status={getStatus(job)}
                  failureClassificationId={job.failure_classification_id}
                  repoName={repoName}
                  filterPlatformCb={filterPlatformCb}
                  platform={platform}
                  hasGroup
                  key={job.id}
                  ref={i}
                  refOrder={i}
                />
              ))}
            </span>
            <span className="group-count-list">
              {this.items.counts.map(countInfo => (
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
    $injector: PropTypes.object.isRequired,
};
