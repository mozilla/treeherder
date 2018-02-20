import React from 'react';
import PropTypes from 'prop-types';
import PushJobs from './PushJobs';
import PushHeader from './PushHeader';
import { RevisionList } from './RevisionList';
import * as aggregateIds from './aggregateIds';

export default class Push extends React.Component {
  constructor(props) {
    super(props);
    const { $injector, repoName, push } = props;

    this.$rootScope = $injector.get('$rootScope');
    this.thEvents = $injector.get('thEvents');
    this.ThResultSetStore = $injector.get('ThResultSetStore');

    this.aggregateId = aggregateIds.getPushTableId(
      repoName, push.id, push.revision
    );
    this.showRunnableJobs = this.showRunnableJobs.bind(this);
    this.hideRunnableJobs = this.hideRunnableJobs.bind(this);

    this.state = {
      runnableVisible: false
    };
  }

  showRunnableJobs() {
    this.$rootScope.$emit(this.thEvents.showRunnableJobs, this.props.push.id);
    this.setState({ runnableVisible: true });
  }

  hideRunnableJobs() {
    this.ThResultSetStore.deleteRunnableJobs(this.props.repoName, this.props.push.id);
    this.$rootScope.$emit(this.thEvents.deleteRunnableJobs, this.props.push.id);
    this.setState({ runnableVisible: false });
  }

  render() {
    const { push, loggedIn, isStaff, isTryRepo, $injector, repoName } = this.props;
    const { currentRepo, urlBasePath } = this.$rootScope;
    const { id, push_timestamp, revision, job_counts, author } = push;

    return (
      <div className="push">
        <PushHeader
          pushId={id}
          pushTimestamp={push_timestamp}
          author={author}
          revision={revision}
          jobCounts={job_counts}
          loggedIn={loggedIn}
          isStaff={isStaff}
          repoName={repoName}
          isTryRepo={isTryRepo}
          urlBasePath={urlBasePath}
          $injector={$injector}
          runnableVisible={this.state.runnableVisible}
          showRunnableJobsCb={this.showRunnableJobs}
          hideRunnableJobsCb={this.hideRunnableJobs}
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
  isTryRepo: PropTypes.bool,
  loggedIn: PropTypes.bool,
  isStaff: PropTypes.bool,
  repoName: PropTypes.string,
  $injector: PropTypes.object.isRequired,
};
