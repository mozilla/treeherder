import React from 'react';
import PropTypes from 'prop-types';
import PushJobs from './PushJobs';
import PushHeader from './PushHeader';
import { RevisionList } from './RevisionList';
import { getPushTableId } from '../helpers/aggregateId';
import { thEvents } from "../js/constants";

const watchCycleStates = [
  "none",
  "push",
  "job",
  "none"
];

export default class Push extends React.Component {
  constructor(props) {
    super(props);
    const { $injector, repoName, push } = props;
    const { id: pushId, revision, job_counts } = push;

    this.$rootScope = $injector.get('$rootScope');
    this.ThResultSetStore = $injector.get('ThResultSetStore');

    this.aggregateId = getPushTableId(repoName, pushId, revision);
    this.showRunnableJobs = this.showRunnableJobs.bind(this);
    this.hideRunnableJobs = this.hideRunnableJobs.bind(this);

    this.state = {
      runnableVisible: false,
      watched: "none",

      // props.push isn't actually immutable due to the way it hooks up to angular, therefore we
      // need to keep the previous value in the state.
      last_job_counts: job_counts ? { ...job_counts } : null,
    };
  }

  componentWillReceiveProps(nextProps) {
    this.showUpdateNotifications(nextProps);
  }

  showUpdateNotifications(nextProps) {
    const { watched, last_job_counts } = this.state;
    const { repoName, push: { revision, id: pushId } } = this.props;

    if (Notification.permission !== "granted" || watched === "none") {
      return;
    }

    const nextCounts = nextProps.push.job_counts;
    if (last_job_counts) {
      const nextUncompleted = nextCounts.pending + nextCounts.running;
      const lastUncompleted = last_job_counts.pending + last_job_counts.running;

      const nextCompleted = nextCounts.completed;
      const lastCompleted = last_job_counts.completed;

      let message;
      if (lastUncompleted > 0 && nextUncompleted === 0) {
        message = "Push completed";
        this.setState({ watched: "none" });
      } else if (watched === "job" && lastCompleted < nextCompleted) {
        const completeCount = nextCompleted - lastCompleted;
        message = completeCount + " jobs completed";
      }

      if (message) {
        const notification = new Notification(message, {
          body: `${repoName} rev ${revision.substring(0, 12)}`,
          tag: pushId
        });

        notification.onerror = (event) => {
          this.thNotify.send(`${event.target.title}: ${event.target.body}`, "danger");
        };

        notification.onclick = (event) => {
          if (this.container) {
            this.container.scrollIntoView();
            event.target.close();
          }
        };
      }
    }

    if (nextCounts) {
      this.setState({ last_job_counts: Object.assign({}, nextCounts) });
    }
  }

  showRunnableJobs() {
    this.$rootScope.$emit(thEvents.showRunnableJobs, this.props.push.id);
    this.setState({ runnableVisible: true });
  }

  hideRunnableJobs() {
    this.ThResultSetStore.deleteRunnableJobs(this.props.push.id);
    this.$rootScope.$emit(thEvents.deleteRunnableJobs, this.props.push.id);
    this.setState({ runnableVisible: false });
  }

  async cycleWatchState() {
    let next = watchCycleStates[watchCycleStates.indexOf(this.state.watched) + 1];

    if (next !== "none" && Notification.permission !== "granted") {
      const result = await Notification.requestPermission();

      if (result === "denied") {
        this.thNotify.send("Notification permission denied", "danger");

        next = "none";
      }
    }
    this.setState({ watched: next });
  }

  render() {
    const { push, isLoggedIn, isStaff, $injector, repoName } = this.props;
    const { watched, runnableVisible } = this.state;
    const { currentRepo, urlBasePath } = this.$rootScope;
    const { id, push_timestamp, revision, job_counts, author } = push;

    return (
      <div className="push" ref={(ref) => { this.container = ref; }}>
        <PushHeader
          pushId={id}
          pushTimestamp={push_timestamp}
          author={author}
          revision={revision}
          jobCounts={job_counts}
          watchState={watched}
          isLoggedIn={isLoggedIn}
          isStaff={isStaff}
          repoName={repoName}
          urlBasePath={urlBasePath}
          $injector={$injector}
          runnableVisible={runnableVisible}
          showRunnableJobsCb={this.showRunnableJobs}
          hideRunnableJobsCb={this.hideRunnableJobs}
          cycleWatchState={() => this.cycleWatchState()}
        />
        <div className="push-body-divider" />
        <div className="row push clearfix">
          {currentRepo &&
            <RevisionList
              push={push}
              $injector={$injector}
              repo={currentRepo}
            />
          }
          <span className="job-list job-list-pad col-7">
            <PushJobs
              push={push}
              repoName={repoName}
              $injector={$injector}
            />
          </span>
        </div>
      </div>
    );
  }
}

Push.propTypes = {
  push: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
  isLoggedIn: PropTypes.bool,
  isStaff: PropTypes.bool,
  repoName: PropTypes.string,
};

Push.defaultProps = {
  isLoggedIn: false,
  isStaff: false,
  repoName: 'mozilla-inbound',
};
