import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';

import Push from './Push';
import {
  findInstance,
  findSelectedInstance,
  findJobInstance,
  scrollToElement,
} from '../helpers/job';
import PushLoadErrors from './PushLoadErrors';
import { thEvents } from '../js/constants';
import JobModel from '../models/job';

export default class PushList extends React.Component {

  constructor(props) {
    super(props);
    const { $injector, repoName } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.$location = $injector.get('$location');
    this.$timeout = $injector.get('$timeout');
    this.thNotify = $injector.get('thNotify');
    this.thJobFilters = $injector.get('thJobFilters');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.ThResultSetModel = $injector.get('ThResultSetModel');

    this.ThResultSetStore.initRepository(repoName);

    this.getNextPushes = this.getNextPushes.bind(this);
    this.updateUrlFromchange = this.updateUrlFromchange.bind(this);
    this.closeJob = this.closeJob.bind(this);

    this.state = {
      pushList: [],
      loadingPushes: true,
      jobsReady: false,
    };

    // get our first set of resultsets
    this.ThResultSetStore.fetchPushes(
        this.ThResultSetStore.defaultPushCount,
        true,
    );
  }

  componentWillMount() {
    this.pushesLoadedUnlisten = this.$rootScope.$on(thEvents.pushesLoaded, () => {
      const pushList = this.ThResultSetStore.getPushArray();
      this.$timeout(() => {
        this.setState({ pushList, loadingPushes: false });
      }, 0);
    });

    this.jobsLoadedUnlisten = this.$rootScope.$on(thEvents.jobsLoaded, () => {
      const pushList = [...this.ThResultSetStore.getPushArray()];

      if (!this.state.jobsReady) {
        const selectedJobId = parseInt(this.$location.search().selectedJob);
        if (selectedJobId) {
          this.setSelectedJobFromQueryString(selectedJobId);
        }
      }

      this.$timeout(() => {
        this.setState({ pushList, jobsReady: true });
      }, 0);
    });

    this.jobClickUnlisten = this.$rootScope.$on(thEvents.jobClick, (ev, job) => {
      this.$location.search('selectedJob', job.id);
      const { repoName } = this.props;
      if (repoName) {
        this.ThResultSetStore.setSelectedJob(job);
      }
    });

    this.clearSelectedJobUnlisten = this.$rootScope.$on(thEvents.clearSelectedJob, (ev, target) => {
      this.closeJob(target);
    });

    this.changeSelectionUnlisten = this.$rootScope.$on(
      thEvents.changeSelection, (ev, direction, jobNavSelector) => {
        this.changeSelectedJob(ev, direction, jobNavSelector);
      },
    );

    this.jobsClassifiedUnlisten = this.$rootScope.$on(
      thEvents.jobsClassified, (ev, { jobs }) => {
        Object.values(jobs).forEach((job) => {
          findJobInstance(job.id).props.job.failure_classification_id = job.failure_classification_id;
        });
        this.$rootScope.$emit(thEvents.globalFilterChanged);
      },
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
      this.$rootScope.$emit(thEvents.jobClick, selectedJobEl.job_obj);
    } else {
      // If the ``selectedJob`` was not mapped, then we need to notify
      // the user it's not in the range of the current result set list.
      JobModel.get(repoName, selectedJobId).then((job) => {
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
    const updatedLastRevision = rsArray[rsArray.length - 1].revision;
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
    // div (excluding pinBoard) and then to the specific selector passed
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

      let selected;
      if (selectedEl.length) {
        selected = findInstance(selectedEl[0]);
        selected.setSelected(false);
      }

      const nextSelected = findInstance(jobEl[0]);

      if (nextSelected && nextSelected !== selected) {
        nextSelected.setSelected(true);
        const jobId = jobEl.attr('data-job-id');

        if (jobMap && jobMap[jobId] && selIdx !== idx) {
          this.selectJob(jobMap[jobId].job_obj, jobEl);
          return;
        }
      } else {
        this.noMoreUnclassifiedFailures();
      }
    } else {
      this.noMoreUnclassifiedFailures();
    }
    // if there was no new job selected, then ensure that we clear any job that
    // was previously selected.
    if ($('.selected-job').css('display') === 'none') {
      this.$rootScope.$emit(thEvents.clearSelectedJob);
    }
  }

  noMoreUnclassifiedFailures() {
    this.$timeout(() => {
      this.thNotify.send('No unclassified failures to select.');
      this.$rootScope.$emit(thEvents.clearSelectedJob);
    });
  }

  selectJob(job, jobEl) {
    // Delay switching jobs right away, in case the user is switching rapidly between jobs
    scrollToElement(jobEl);
    if (this.jobChangedTimeout) {
      window.clearTimeout(this.jobChangedTimeout);
    }
    this.jobChangedTimeout = window.setTimeout(() => {
      this.$rootScope.$emit(thEvents.jobClick, job);
    }, 200);
  }

  // Clear the selectedJob
  closeJob() {
    // TODO: Should block clearing the selected job if there are pinned jobs
    // But can't get the pinned jobs at this time.  When we're completely on React,
    // or at least have a shared parent between PushList and DetailsPanel, we can share
    // a PinBoardModel or Context so they both have access.
    if (!this.$rootScope.countPinnedJobs()) {
      const selected = findSelectedInstance();
      if (selected) {
        selected.setSelected(false);
      }
    }
  }

  render() {
    const { $injector, user, repoName, revision, currentRepo } = this.props;
    const { pushList, loadingPushes, jobsReady } = this.state;
    const { isLoggedIn, isStaff } = user;

    return (
      <div>
        {jobsReady && <span className="hidden ready" />}
        {repoName && pushList.map(push => (
          <Push
            push={push}
            isLoggedIn={isLoggedIn || false}
            isStaff={isStaff}
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
        <div className="card card-body get-next" data-job-clear-on-click>
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

PushList.propTypes = {
  $injector: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  user: PropTypes.object.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.object,
};

PushList.defaultProps = {
  revision: null,
  currentRepo: {},
};
