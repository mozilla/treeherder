import React from 'react';
import PropTypes from 'prop-types';
import { actions, store } from './redux/store';

class Repo extends React.PureComponent {

  // While this component doesn't render anything, it acts as a top-level,
  // single-point for some events so that they don't happen for each push
  // object that is rendered.

  // TODO: Once we migrate the ng-repeat to ReactJS for the list of
  // pushes, this component will do the rendering of that array.
  // This component could arguably be renamed as PushList at that time.
  // (bug 1434677).

  constructor(props) {
    super(props);
    this.$rootScope = this.props.$injector.get('$rootScope');
    this.$location = this.props.$injector.get('$location');
    this.thEvents = this.props.$injector.get('thEvents');
    this.ThResultSetStore = this.props.$injector.get('ThResultSetStore');
    this.thNotify = this.props.$injector.get('thNotify');
    this.thNotify = this.props.$injector.get('thNotify');
    this.ThJobModel = this.props.$injector.get('ThJobModel');
    this.ThResultSetModel = this.props.$injector.get('ThResultSetModel');
  }

  componentDidMount() {
    this.$rootScope.$on(this.thEvents.jobClick, (ev, job) => {
      this.$location.search('selectedJob', job.id);
      this.ThResultSetStore.setSelectedJob(this.$rootScope.repoName, job);
      store.dispatch(actions.pushes.setSelectedJobId(job.id));
    });

    this.$rootScope.$on(this.thEvents.clearSelectedJob, () => {
      this.$location.search('selectedJob', null);
    });

    this.$rootScope.$on(
      this.thEvents.changeSelection, (ev, direction, jobNavSelector) => {
        this.changeSelectedJob(ev, direction, jobNavSelector);
      }
    );

    this.$rootScope.$on(
      this.thEvents.jobsLoaded, () => {
        const selectedJobId = parseInt(this.$location.search().selectedJob);
        if (selectedJobId) {
          this.setSelectedJobFromQueryString(selectedJobId);
        }
      }
    );
  }

  /**
   * If the URL has a query string param of ``selectedJob`` then select
   * that job on load.
   *
   * If that job isn't in any of the loaded resultsets, then throw
   * an error and provide a link to load it with the right resultset.
   */
  setSelectedJobFromQueryString(selectedJobId) {
    const jobMap = this.ThResultSetStore.getJobMap(this.$rootScope.repoName);
    const selectedJobEl = jobMap[`${selectedJobId}`];

    // select the job in question
    if (selectedJobEl) {
      const jobSelector = `button[data-job-id='${selectedJobId}']`;
      this.$rootScope.$emit(this.thEvents.jobClick, selectedJobEl.job_obj);
      // scroll to make it visible
      this.scrollToElement($('.th-view-content').find(jobSelector).first());
    } else {
      // If the ``selectedJob`` was not mapped, then we need to notify
      // the user it's not in the range of the current result set list.
      this.ThJobModel.get(this.$rootScope.repoName, selectedJobId).then((job) => {
        this.ThResultSetModel.getResultSet(this.$rootScope.repoName, job.result_set_id).then(function (resultset) {
          const url = `${this.$rootScope.urlBasePath}?repo=${this.$rootScope.repoName}&revision=${resultset.data.revision}&selectedJob=${selectedJobId}`;

          // the job exists, but isn't in any loaded resultset.
          // provide a message and link to load the right resultset
          this.thNotify.send(`Selected job id: ${selectedJobId} not within current push range.`,
            'danger',
            { sticky: true, linkText: 'Load push', url });

        });
      }, function () {
        // the job wasn't found in the db.  Either never existed,
        // or was expired and deleted.
        this.thNotify.send(`Unable to find job with id ${selectedJobId}`, 'danger', { sticky: true });
      });
    }
  }

  changeSelectedJob(ev, direction, jobNavSelector) {
    const jobMap = this.ThResultSetStore.getJobMap(this.$rootScope.repoName);
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
    const jobs = $('.th-view-content').find(jobNavSelector.selector).filter(':visible, .selected-job, .selected-count');

    if (jobs.length) {
      const selIdx = jobs.index(jobs.filter('.selected-job, .selected-count').first());
      const idx = getIndex(selIdx, jobs);
      const jobEl = $(jobs[idx]);
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

  // TODO: see if Element.scrollIntoView() can be used here. (bug 1434679)
  scrollToElement(el, duration) {
    if (_.isUndefined(duration)) {
        duration = 50;
    }
    if (el.position() !== undefined) {
        var scrollOffset = -50;
        if (window.innerHeight >= 500 && window.innerHeight < 1000) {
            scrollOffset = -100;
        } else if (window.innerHeight >= 1000) {
            scrollOffset = -200;
        }
        if (!this.isOnScreen(el)) {
            $('.th-global-content').scrollTo(el, duration, { offset: scrollOffset });
        }
    }
  }

  isOnScreen(el) {
    const viewport = {};
    viewport.top = $(window).scrollTop() + $('#global-navbar-container').height() + 30;
    const filterbarheight = $('.active-filters-bar').height();
    viewport.top = filterbarheight > 0 ? viewport.top + filterbarheight : viewport.top;
    const updatebarheight = $('.update-alert-panel').height();
    viewport.top = updatebarheight > 0 ? viewport.top + updatebarheight : viewport.top;
    viewport.bottom = $(window).height() - $('#info-panel').height() - 20;
    const bounds = {};
    bounds.top = el.offset().top;
    bounds.bottom = bounds.top + el.outerHeight();
    return ((bounds.top <= viewport.bottom) && (bounds.bottom >= viewport.top));
  }

  selectJob(job, jobEl) {
    // Delay switching jobs right away, in case the user is switching rapidly between jobs
    store.dispatch(actions.pushes.setSelectedJobId(job.id));
    this.scrollToElement(jobEl);
    if (this.jobChangedTimeout) {
      window.clearTimeout(this.jobChangedTimeout);
    }
    this.jobChangedTimeout = window.setTimeout(() => {
      this.$rootScope.$emit(this.thEvents.jobClick, job);
    }, 200);
  }

  render() {
    return null;
  }
}

Repo.propTypes = {
  $injector: PropTypes.object.isRequired,
};

// Need store here because this React component is not wrapped in a <Provider>.
// Once we're completely on React, the entire app will be wrapped in a singular
// <Provider> so all components will get the store.
treeherder.constant('store', store);
treeherder.directive('repo', ['reactDirective', '$injector', (reactDirective, $injector) =>
  reactDirective(Repo, ['repo'], {}, { $injector })]);
