import React from 'react';
import { react2angular } from "react2angular/index";
import { actions, store } from "../redux/store";

class Repo extends React.PureComponent {

  // While this component doesn't render anything, it acts as a top-level,
  // single-point for some events so that they don't happen for each push
  // object that is rendered.

  // TODO: Once we migrate the ng-repeat to ReactJS for the list of
  // pushes, this component will do the rendering of that array.
  // This component could arguably be renamed as PushList at that time.

  constructor(props) {
    super(props);
    this.$rootScope = this.props.$injector.get('$rootScope');
    this.$location = this.props.$injector.get('$location');
    this.thEvents = this.props.$injector.get('thEvents');
    this.ThResultSetStore = this.props.$injector.get('ThResultSetStore');
  }

  componentWillMount() {
    this.$rootScope.$on(this.thEvents.jobClick, () => {
      const jobId = this.$location.search().selectedJob;
      if (jobId) {
        store.dispatch(actions.pushes.setSelectedJobId(parseInt(jobId)));
      }
    });
  }

  componentDidMount() {
    this.$rootScope.$on(
      this.thEvents.changeSelection, (ev, direction, jobNavSelector) => {
        this.changeSelectedJob(ev, direction, jobNavSelector);
      }
    );
  }

  changeSelectedJob(ev, direction, jobNavSelector) {
    const jobMap = this.ThResultSetStore.getJobMap(this.$rootScope.repoName);
    let el, jobId, jobs, getIndex;

    if (direction === 'next') {
      getIndex = function (idx, jobs) {
        return idx + 1 > Object.keys(jobs).length - 1 ? 0 : idx + 1;
      };
    } else if (direction === 'previous') {
      getIndex = function (idx, jobs) {
        return idx - 1 < 0 ? Object.keys(jobs).length - 1 : idx - 1;
      };
    }

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
    jobs = $(".th-view-content").find(jobNavSelector.selector).filter(":visible, .selected-job, .selected-count");
    if (jobs.length) {
      const selIdx = jobs.index(jobs.filter(".selected-job, .selected-count").first());
      const idx = getIndex(selIdx, jobs);

      el = $(jobs[idx]);
      jobId = el.attr('data-job-id');
      if (jobMap && jobMap[jobId] && selIdx !== idx) {
        this.selectJob(jobMap[jobId].job_obj);
        return;
      }
    }
    // if there was no new job selected, then ensure that we clear any job that
    // was previously selected.
    if ($(".selected-job").css('display') === 'none') {
      this.$rootScope.closeJob();
    }
  }

  selectJob(job) {
    // Delay switching jobs right away, in case the user is switching rapidly between jobs
    store.dispatch(actions.pushes.setSelectedJobId(job.id));
    if (this.jobChangedTimeout) {
      window.clearTimeout(this.jobChangedTimeout);
    }
    this.jobChangedTimeout = window.setTimeout(() => {
      this.$rootScope.$emit(this.thEvents.jobClick, job);
    }, 200);
  }

  render() {
    return (<div className="hidden" />);
  }
}

treeherder.constant('store', store);
treeherder.component('repo',
                     react2angular(Repo,
                                   ['repo'], ['$injector', 'store']));
