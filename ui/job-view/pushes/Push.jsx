import React from 'react';
import PropTypes from 'prop-types';
import PushJobs from './PushJobs';
import PushHeader from './PushHeader';
import { RevisionList } from './RevisionList';
import { thEvents } from '../../js/constants';

const watchCycleStates = [
  'none',
  'push',
  'job',
  'none',
];

export default class Push extends React.Component {
  constructor(props) {
    super(props);
    const { $injector, push } = props;
    const { job_counts } = push;

    this.$rootScope = $injector.get('$rootScope');
    this.ThResultSetStore = $injector.get('ThResultSetStore');

    this.state = {
      runnableVisible: false,
      watched: 'none',

      // props.push isn't actually immutable due to the way it hooks up to angular, therefore we
      // need to keep the previous value in the state.
      last_job_counts: job_counts ? { ...job_counts } : null,
      hasBoundaryError: false,
      boundaryError: '',
    };
  }
  componentDidMount() {
    this.showRunnableJobs = this.showRunnableJobs.bind(this);
    this.hideRunnableJobs = this.hideRunnableJobs.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.showUpdateNotifications(nextProps);
  }

  componentDidCatch(error) {
    this.setState({
      hasBoundaryError: true,
      boundaryError: error,
    });
  }

  showUpdateNotifications(nextProps) {
    const { watched, last_job_counts } = this.state;
    const {
      repoName, notificationSupported, push: { revision, id: pushId },
    } = this.props;

    if (!notificationSupported || Notification.permission !== 'granted' || watched === 'none') {
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
        message = 'Push completed';
        this.setState({ watched: 'none' });
      } else if (watched === 'job' && lastCompleted < nextCompleted) {
        const completeCount = nextCompleted - lastCompleted;
        message = completeCount + ' jobs completed';
      }

      if (message) {
        const notification = new Notification(message, {
          body: `${repoName} rev ${revision.substring(0, 12)}`,
          tag: pushId,
        });

        notification.onerror = (event) => {
          this.thNotify.send(`${event.target.title}: ${event.target.body}`, 'danger');
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
    if (!this.props.notificationSupported) {
      return;
    }

    let next = watchCycleStates[watchCycleStates.indexOf(this.state.watched) + 1];

    if (next !== 'none' && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();

      if (result === 'denied') {
        this.thNotify.send('Notification permission denied', 'danger');

        next = 'none';
      }
    }
    this.setState({ watched: next });
  }

  render() {
    const {
      push, isLoggedIn, $injector, repoName, currentRepo,
      filterModel, notificationSupported,
    } = this.props;
    const { watched, runnableVisible, hasBoundaryError, boundaryError } = this.state;
    const { id, push_timestamp, revision, job_counts, author } = push;

    if (hasBoundaryError) {
      return (
        <div className="border-bottom border-top ml-1">
          <div>Error displaying push with revision: {revision}</div>
          <div>{boundaryError.toString()}</div>
        </div>
      );
    }

    return (
      <div className="push" ref={(ref) => { this.container = ref; }} data-job-clear-on-click>
        <PushHeader
          push={push}
          pushId={id}
          pushTimestamp={push_timestamp}
          author={author}
          revision={revision}
          jobCounts={job_counts}
          watchState={watched}
          isLoggedIn={isLoggedIn}
          repoName={repoName}
          filterModel={filterModel}
          $injector={$injector}
          runnableVisible={runnableVisible}
          showRunnableJobsCb={this.showRunnableJobs}
          hideRunnableJobsCb={this.hideRunnableJobs}
          cycleWatchState={() => this.cycleWatchState()}
          notificationSupported={notificationSupported}
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
          <span className="job-list job-list-pad col-7" data-job-clear-on-click>
            <PushJobs
              push={push}
              repoName={repoName}
              filterModel={filterModel}
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
  currentRepo: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
  filterModel: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  notificationSupported: PropTypes.bool.isRequired,
};
