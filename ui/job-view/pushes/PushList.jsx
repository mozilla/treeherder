import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';

import Push from './Push';
import {
  findInstance,
  findSelectedInstance,
  findJobInstance,
  scrollToElement,
} from '../../helpers/job';
import PushLoadErrors from './PushLoadErrors';
import { thDefaultRepo, thEvents, thMaxPushFetchSize } from '../../js/constants';
import JobModel from '../../models/job';
import PushModel from '../../models/push';
import ErrorBoundary from '../../shared/ErrorBoundary';
import {
  getAllUrlParams,
  getQueryString,
  getUrlParam,
  setLocation,
  setUrlParam,
} from '../../helpers/location';
import { parseQueryParams } from '../../helpers/url';
import { reloadOnChangeParameters } from '../../helpers/filter';

export default class PushList extends React.Component {

  constructor(props) {
    super(props);
    const { $injector, repoName } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.$timeout = $injector.get('$timeout');
    this.thNotify = $injector.get('thNotify');
    this.ThResultSetStore = $injector.get('ThResultSetStore');

    this.ThResultSetStore.initRepository(repoName);

    this.closeJob = this.closeJob.bind(this);

    this.skipNextPageReload = false;

    this.state = {
      pushList: [],
      loadingPushes: true,
      jobsReady: false,
      notificationSupported: 'Notification' in window,
      cachedReloadTriggerParams: this.getNewReloadTriggerParams(),
    };

    // get our first set of resultsets
    const fromchange = getUrlParam('fromchange');
    // If we have a ``fromchange`` url param.  We don't want to limit ourselves
    // to the default of 10 pushes on the first load.
    this.ThResultSetStore.fetchPushes(
      fromchange ? thMaxPushFetchSize : this.ThResultSetStore.defaultPushCount);
  }

  componentWillMount() {
    this.getNextPushes = this.getNextPushes.bind(this);
    this.handleUrlChanges = this.handleUrlChanges.bind(this);
    this.updateUrlFromchange = this.updateUrlFromchange.bind(this);

    this.pushesLoadedUnlisten = this.$rootScope.$on(thEvents.pushesLoaded, () => {
      const pushList = this.ThResultSetStore.getPushArray();
      this.$timeout(() => {
        this.setState({ pushList, loadingPushes: false });
      }, 0);
    });

    this.jobsLoadedUnlisten = this.$rootScope.$on(thEvents.jobsLoaded, () => {
      const pushList = [...this.ThResultSetStore.getPushArray()];

      if (!this.state.jobsReady) {
        const selectedJobId = parseInt(getUrlParam('selectedJob'));
        if (selectedJobId) {
          this.setSelectedJobFromQueryString(selectedJobId);
        }
      }

      this.$timeout(() => {
        this.setState({ pushList, jobsReady: true });
      }, 0);
    });

    this.jobClickUnlisten = this.$rootScope.$on(thEvents.jobClick, (ev, job) => {
      const { repoName } = this.props;

      setUrlParam('selectedJob', job.id);
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
        this.setState({ pushList: [...this.state.pushList] });
      },
    );
    window.addEventListener('hashchange', this.handleUrlChanges, false);
  }

  componentWillUnmount() {
    this.pushesLoadedUnlisten();
    this.jobsLoadedUnlisten();
    this.jobClickUnlisten();
    this.clearSelectedJobUnlisten();
    this.changeSelectionUnlisten();
    this.jobsLoadedUnlisten();
    this.jobsClassifiedUnlisten();
    window.removeEventListener('hashchange', this.handleUrlChanges, false);
  }

  getNextPushes(count) {
    const revision = getUrlParam('revision');
    this.setState({ loadingPushes: true });
    if (revision) {
      this.skipNextPageReload = true;
      const params = getAllUrlParams();
      params.delete('revision');
      params.set('tochange', revision);
      setLocation(params);
    }
    this.ThResultSetStore.fetchPushes(count)
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
        PushModel.get(job.result_set_id).then(async (resp) => {
          if (resp.ok) {
            const push = await resp.json();
            setUrlParam('selectedJob', null);
            const url = `${urlBasePath}?repo=${repoName}&revision=${push.data.revision}&selectedJob=${selectedJobId}`;

            // the job exists, but isn't in any loaded push.
            // provide a message and link to load the right push
            this.thNotify.send(
              `Selected job id: ${selectedJobId} not within current push range.`,
              'danger',
              { sticky: true, linkText: 'Load push', url });
          }
        });
      }).catch((error) => {
        // the job wasn't found in the db.  Either never existed,
        // or was expired and deleted.
        setUrlParam('selectedJob', null);
        this.thNotify.send(`Selected Job - ${error}`,
          'danger',
          { sticky: true });
      });
    }
  }

  getNewReloadTriggerParams() {
    const params = parseQueryParams(getQueryString());

    return reloadOnChangeParameters.reduce(
      (acc, prop) => (params[prop] ? { ...acc, [prop]: params[prop] } : acc), {});
  }

  // reload the page if certain params were changed in the URL.  For
  // others, such as filtering, just re-filter without reload.

  // the param ``skipNextPageReload`` will cause a single run through
  // this code to skip the page reloading even on a param that would
  // otherwise trigger a page reload.  This is useful for a param that
  // is being changed by code in a specific situation as opposed to when
  // the user manually edits the URL location bar.
  handleUrlChanges() {
    const { cachedReloadTriggerParams } = this.state;
    const newReloadTriggerParams = this.getNewReloadTriggerParams();
    // if we are just setting the repo to the default because none was
    // set initially, then don't reload the page.
    const defaulting = newReloadTriggerParams.repo === thDefaultRepo &&
      !cachedReloadTriggerParams.repo;

    if (!defaulting && cachedReloadTriggerParams &&
      !isEqual(newReloadTriggerParams, cachedReloadTriggerParams) &&
      !this.skipNextPageReload) {
      location.reload();
    } else {
      this.setState({ cachedReloadTriggerParams: newReloadTriggerParams });
    }

    this.skipNextPageReload = false;
  }

  updateUrlFromchange() {
    // since we fetched more pushes, we need to persist the
    // push state in the URL.
    const rsArray = this.ThResultSetStore.getPushArray();
    const updatedLastRevision = rsArray[rsArray.length - 1].revision;

    if (getUrlParam('fromchange') !== updatedLastRevision) {
      this.skipNextPageReload = true;
      setUrlParam('fromchange', updatedLastRevision);
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
    const { $injector, user, repoName, revision, currentRepo, filterModel } = this.props;
    const { pushList, loadingPushes, jobsReady, notificationSupported } = this.state;
    const { isLoggedIn, isStaff } = user;

    return (
      <div>
        {jobsReady && <span className="hidden ready" />}
        {repoName && pushList.map(push => (
          <ErrorBoundary
            errorClasses="pl-2 border-top border-bottom border-dark d-block"
            message={`Error on push with revision ${push.revision}: `}
            key={push.id}
          >
            <Push
              push={push}
              isLoggedIn={isLoggedIn || false}
              currentRepo={currentRepo}
              isStaff={isStaff}
              repoName={repoName}
              filterModel={filterModel}
              $injector={$injector}
              notificationSupported={notificationSupported}
            />
          </ErrorBoundary>
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
                onClick={() => (this.getNextPushes(count))}
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
  filterModel: PropTypes.object.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.object,
};

PushList.defaultProps = {
  revision: null,
  currentRepo: {},
};
