import React from 'react';
import Push from './Push';
import {
  findInstance,
  findSelectedInstance,
  findJobInstance,
  scrollToElement
} from '../helpers/jobHelper';
import PushLoadErrors from './PushLoadErrors';

export default class PushList extends React.Component {

  constructor(props) {
    super(props);
    const { $injector, repoName } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.$location = $injector.get('$location');
    this.$timeout = $injector.get('$timeout');
    this.thEvents = $injector.get('thEvents');
    this.thNotify = $injector.get('thNotify');
    this.thPinboard = $injector.get('thPinboard');
    this.thJobFilters = $injector.get('thJobFilters');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.ThResultSetModel = $injector.get('ThResultSetModel');
    this.ThJobModel = $injector.get('ThJobModel');

    this.ThResultSetStore.initRepository(repoName);

    this.getNextPushes = this.getNextPushes.bind(this);
    this.updateUrlFromchange = this.updateUrlFromchange.bind(this);
    this.clearJobOnClick = this.clearJobOnClick.bind(this);

    this.state = {
      pushList: [],
      loadingPushes: true,
      jobsReady: false,
    };

    // get our first set of resultsets
    this.ThResultSetStore.fetchPushes(
        this.ThResultSetStore.defaultResultSetCount,
        true
    );
  }

  componentWillMount() {
    this.pushesLoadedUnlisten = this.$rootScope.$on(this.thEvents.pushesLoaded, () => {
      const pushList = this.ThResultSetStore.getPushArray();
      this.$timeout(() => {
        this.setState({ pushList, loadingPushes: false });
      }, 0);
    });

    this.jobsLoadedUnlisten = this.$rootScope.$on(this.thEvents.jobsLoaded, () => {
      const pushList = this.ThResultSetStore.getPushArray();
      this.$timeout(() => {
        this.setState({ pushList, jobsReady: true });
      }, 0);
    });

    this.jobClickUnlisten = this.$rootScope.$on(this.thEvents.jobClick, (ev, job) => {
      this.$location.search('selectedJob', job.id);
      const { repoName } = this.props;
      if (repoName) {
        this.ThResultSetStore.setSelectedJob(job);
      }
    });

    this.clearSelectedJobUnlisten = this.$rootScope.$on(this.thEvents.clearSelectedJob, () => {
      this.$location.search('selectedJob', null);
    });

    this.changeSelectionUnlisten = this.$rootScope.$on(
      this.thEvents.changeSelection, (ev, direction, jobNavSelector) => {
        this.changeSelectedJob(ev, direction, jobNavSelector);
      }
    );

    this.jobsLoadedUnlisten = this.$rootScope.$on(
      this.thEvents.jobsLoaded, () => {
        const selectedJobId = parseInt(this.$location.search().selectedJob);
        if (selectedJobId) {
          this.setSelectedJobFromQueryString(selectedJobId);
        }
      }
    );

    this.jobsClassifiedUnlisten = this.$rootScope.$on(
      this.thEvents.jobsClassified, (ev, { jobs }) => {
        Object.values(jobs).forEach((job) => {
          findJobInstance(job.id).props.job.failure_classification_id = job.failure_classification_id;
        });
        this.$rootScope.$emit(this.thEvents.globalFilterChanged);
      }
    );
  }

  componentWillUnmount() {
    this.pushesLoadedUnlisten();
    this.jobsLoadedUnlisten();
    this.jobClickUnlisten();
    this.clearSelectedJobUnlisten();
    this.changeSelectionUnlisten();
    this.jobsLoadedUnlisten();
    this.jobsClassifiedUnlisten();
  }

  getNextPushes(count, keepFilters) {
    this.setState({ loadingPushes: true });
    const revision = this.$location.search().revision;
    if (revision) {
      this.$rootScope.skipNextPageReload = true;
      this.$location.search('revision', null);
      this.$location.search('tochange', revision);
    }
    this.ThResultSetStore.fetchPushes(count, keepFilters)
      .then(this.updateUrlFromchange);

  }

  /**
   * If the URL has a query string param of ``selectedJob`` then select
   * that job on load.
   *
   * If that job isn't in any of the loaded pushes, then throw
   * an error and provide a link to load it with the right push.
   */
  setSelectedJobFromQueryString(selectedJobId) {
    const { repoName } = this.props;
    const { urlBasePath } = this.$rootScope;
    const jobMap = this.ThResultSetStore.getJobMap();
    const selectedJobEl = jobMap[`${selectedJobId}`];

    // select the job in question
    if (selectedJobEl) {
      this.$rootScope.$emit(this.thEvents.jobClick, selectedJobEl.job_obj);
    } else {
      // If the ``selectedJob`` was not mapped, then we need to notify
      // the user it's not in the range of the current result set list.
      this.ThJobModel.get(repoName, selectedJobId).then((job) => {
        this.ThResultSetModel.getResultSet(repoName, job.result_set_id).then((push) => {
          const url = `${urlBasePath}?repo=${repoName}&revision=${push.data.revision}&selectedJob=${selectedJobId}`;

          // the job exists, but isn't in any loaded push.
          // provide a message and link to load the right push
          this.thNotify.send(`Selected job id: ${selectedJobId} not within current push range.`,
            'danger',
            { sticky: true, linkText: 'Load push', url });

        });
      }, function () {
        // the job wasn't found in the db.  Either never existed,
        // or was expired and deleted.
        this.thNotify.send(
          `Unable to find job with id ${selectedJobId}`,
          'danger',
          { sticky: true });
      });
    }
  }

  updateUrlFromchange() {
    // since we fetched more pushes, we need to persist the
    // push state in the URL.
    const rsArray = this.ThResultSetStore.getPushArray();
    const updatedLastRevision = _.last(rsArray).revision;
    if (this.$location.search().fromchange !== updatedLastRevision) {
      this.$rootScope.skipNextPageReload = true;
      this.$location.search('fromchange', updatedLastRevision);
    }
  }

  changeSelectedJob(ev, direction, jobNavSelector) {
    const jobMap = this.ThResultSetStore.getJobMap();
    // Get the appropriate next index based on the direction and current job
    // selection (if any).  Must wrap end to end.
    const getIndex = direction === 'next' ?
      (idx, jobs) => (idx + 1 > jobs.length - 1 ? 0 : idx + 1) :
      (idx, jobs) => (idx - 1 < 0 ? jobs.length - 1 : idx - 1);

    // TODO: Move from using jquery here to using the ReactJS state tree (bug 1434679)
    // to find the next/prev component to select so that setState can be called
    // on the component directly.
    //
    // Filter the list of possible jobs down to ONLY ones in the .th-view-content
    // div (excluding pinboard) and then to the specific selector passed
    // in.  And then to only VISIBLE (not filtered away) jobs.  The exception
    // is for the .selected-job.  If that's not visible, we still want to
    // include it, because it is the anchor from which we find
    // the next/previous job.
    //
    // The .selected-job can be invisible, for instance, when filtered to
    // unclassified failures only, and you then classify the selected job.
    // It's still selected, but no longer visible.
    const jobs = $('.th-view-content')
      .find(jobNavSelector.selector)
      .filter(':visible, .selected-job');

    if (jobs.length) {
      const selectedEl = jobs.filter('.selected-job').first();
      const selIdx = jobs.index(selectedEl);
      const idx = getIndex(selIdx, jobs);
      const jobEl = $(jobs[idx]);

      if (selectedEl.length) {
        const selected = findInstance(selectedEl[0]);
        selected.setSelected(false);
      }

      const nextSelected = findInstance(jobEl[0]);
      nextSelected.setSelected(true);

      const jobId = jobEl.attr('data-job-id');

      if (jobMap && jobMap[jobId] && selIdx !== idx) {
        this.selectJob(jobMap[jobId].job_obj, jobEl);
        return;
      }
    }
    // if there was no new job selected, then ensure that we clear any job that
    // was previously selected.
    if ($('.selected-job').css('display') === 'none') {
      this.$rootScope.closeJob();
    }
  }

  selectJob(job, jobEl) {
    // Delay switching jobs right away, in case the user is switching rapidly between jobs
    scrollToElement(jobEl);
    if (this.jobChangedTimeout) {
      window.clearTimeout(this.jobChangedTimeout);
    }
    this.jobChangedTimeout = window.setTimeout(() => {
      this.$rootScope.$emit(this.thEvents.jobClick, job);
    }, 200);
  }

  // Clear the job if it occurs in a particular area
  clearJobOnClick(event) {
      // Suppress for various UI elements so selection is preserved
      const ignoreClear = event.target.hasAttribute("data-ignore-job-clear-on-click");

      if (!ignoreClear && !this.thPinboard.hasPinnedJobs()) {
        const selected = findSelectedInstance();
        if (selected) {
          selected.setSelected(false);
        }
        this.$timeout(this.$rootScope.closeJob);
      }
  }

  render() {
    const { $injector, user, repoName, revision } = this.props;
    const currentRepo = this.props.currentRepo || {};
    const { pushList, loadingPushes, jobsReady } = this.state;
    const { loggedin, is_staff } = user;

    return (
      <div onClick={this.clearJobOnClick}>
        {jobsReady && <span className="hidden ready" />}
        {repoName && pushList.map(push => (
          <Push
            push={push}
            isTryRepo={currentRepo.is_try_repo}
            loggedIn={loggedin || false}
            isStaff={is_staff}
            repoName={repoName}
            $injector={$injector}
            key={push.id}
          />
        ))}
        {loadingPushes &&
          <div
            className="progress active progress-bar progress-bar-striped"
            role="progressbar"
          />
        }
        {pushList.length === 0 && !loadingPushes &&
          <PushLoadErrors
            loadingPushes={loadingPushes}
            currentRepo={currentRepo}
            repoName={repoName}
            revision={revision}
          />
        }
        <div className="card card-body get-next">
          <span>get next:</span>
          <div className="btn-group">
            {[10, 20, 50].map(count => (
            <div
              className="btn btn-light-bordered"
              onClick={() => (this.getNextPushes(count, true))}
              key={count}
            >{count}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

treeherder.directive('pushList', ['reactDirective', '$injector',
  (reactDirective, $injector) => reactDirective(
    PushList,
    ['repoName', 'user', 'revision', 'currentRepo'],
    {},
    { $injector }
  )
]);
