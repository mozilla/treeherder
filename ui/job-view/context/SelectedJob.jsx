import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';

import { thEvents, thJobNavSelectors } from '../../helpers/constants';
import {
  findGroupElement,
  findGroupInstance,
  findJobInstance,
  findSelectedInstance,
  scrollToElement,
} from '../../helpers/job';
import { getUrlParam, setUrlParam } from '../../helpers/location';
import { getJobsUrl } from '../../helpers/url';
import JobModel from '../../models/job';
import PushModel from '../../models/push';
import { withPinnedJobs } from './PinnedJobs';
import { withPushes } from './Pushes';
import { withNotifications } from '../../shared/context/Notifications';

const SelectedJobContext = React.createContext({});

class SelectedJobClass extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedJob: null,
      repoName: getUrlParam('repo'),
    };
    this.value = {
      ...this.state,
      setSelectedJob: this.setSelectedJob,
      clearSelectedJob: this.clearSelectedJob,
      changeSelectedJob: this.changeSelectedJob,
    };
  }

  componentDidMount() {
    this.setSelectedJob = this.setSelectedJob.bind(this);
    this.clearSelectedJob = this.clearSelectedJob.bind(this);
    this.changeSelectedJob = this.changeSelectedJob.bind(this);
    this.noMoreUnclassifiedFailures = this.noMoreUnclassifiedFailures.bind(this);
    this.handleApplyNewJobs = this.handleApplyNewJobs.bind(this);

    // TODO: this.value needs to now get the bound versions of the functions.
    // But when we move the function binding to the constructors, we won't
    // have to re-do this in componentDidMount.
    this.value = {
      ...this.state,
      setSelectedJob: this.setSelectedJob,
      clearSelectedJob: this.clearSelectedJob,
      changeSelectedJob: this.changeSelectedJob,
    };
  }

  componentDidUpdate(prevProps) {
    const { jobsLoaded } = this.props;

    if (jobsLoaded !== prevProps.jobsLoaded) {
      this.setSelectedJobFromQueryString();
    }

    window.addEventListener(thEvents.applyNewJobs, this.handleApplyNewJobs);
  }

  componentWillUnmount() {
    window.removeEventListener(thEvents.applyNewJobs, this.handleApplyNewJobs);
  }

  setValue(newState, callback) {
    this.value = { ...this.value, ...newState };
    this.setState(newState, callback);
  }

  /**
   * If the URL has a query string param of ``selectedJob`` then select
   * that job on load.
   *
   * If that job isn't in any of the loaded pushes, then throw
   * an error and provide a link to load it with the right push.
   */
  setSelectedJobFromQueryString() {
    const { notify, jobMap } = this.props;
    const { repoName, selectedJob } = this.state;
    const selectedJobIdStr = getUrlParam('selectedJob');
    const selectedJobId = parseInt(selectedJobIdStr);

    if (selectedJobIdStr && (!selectedJob || selectedJob.id !== selectedJobId)) {
      const selectedJob = jobMap[selectedJobIdStr];

      // select the job in question
      if (selectedJob) {
        this.setSelectedJob(selectedJob);
      } else {
        setUrlParam('selectedJob');
        // If the ``selectedJob`` was not mapped, then we need to notify
        // the user it's not in the range of the current result set list.
        JobModel.get(repoName, selectedJobId).then((job) => {
          PushModel.get(job.push_id).then(async (resp) => {
            if (resp.ok) {
              const push = await resp.json();
              const newPushUrl = getJobsUrl({ repo: repoName, revision: push.revision, selectedJob: selectedJobId });

              // the job exists, but isn't in any loaded push.
              // provide a message and link to load the right push
              notify(
                `Selected job id: ${selectedJobId} not within current push range.`,
                'danger',
                { sticky: true, linkText: 'Load push', url: newPushUrl });
            } else {
              throw Error(`Unable to find push with id ${job.push_id} for selected job`);
            }
          });
        }).catch((error) => {
          // the job wasn't found in the db.  Either never existed,
          // or was expired and deleted.
          this.clearSelectedJob();
          notify(`Selected Job - ${error}`,
            'danger',
            { sticky: true });
        });
      }
    } else if (!selectedJobIdStr && selectedJob) {
      this.setValue({ selectedJob: null });
    }
  }

  setSelectedJob(job, timeout = 0) {
    const { selectedJob } = this.state;

    if (selectedJob) {
      const selected = findSelectedInstance();
      if (selected) selected.setSelected(false);
    }
    const group = findGroupInstance(job);
    if (group) {
      group.setExpanded(true);
    }
    const newSelectedElement = findJobInstance(job.id, true);
    if (newSelectedElement) {
      newSelectedElement.setSelected(true);
    } else {
      // If the job is in a group count, then the job element won't exist, but
      // its group will.  We can try scrolling to that.
      const groupEl = findGroupElement(job);
      if (groupEl) {
        scrollToElement(groupEl);
      }
    }

    // If a timeout is passed in, this will cause a pause before
    // the selection takes place.  This allows for quick-switching
    // with hotkeys.
    if (this.jobChangedTimeout) {
      window.clearTimeout(this.jobChangedTimeout);
    }
    this.jobChangedTimeout = window.setTimeout(() => {
      this.setValue({ selectedJob: job }, () => {
        setUrlParam('selectedJob', job.id);
        this.jobChangedTimeout = null;
      });
    }, timeout);
  }

  clearSelectedJob() {
    const { pinnedJobs } = this.props;

    if (!Object.keys(pinnedJobs).length) {
      this.setValue({ selectedJob: null });
      setUrlParam('selectedJob', null);
      const selected = findSelectedInstance();
      if (selected) selected.setSelected(false);
    }
  }

  handleApplyNewJobs(event) {
    const { updatedSelectedJob } = event.detail;

    if (updatedSelectedJob) {
      this.setSelectedJob(updatedSelectedJob);
    }
  }

  noMoreUnclassifiedFailures() {
    const { pinnedJobs, notify } = this.props;

    notify('No unclassified failures to select.');
    this.clearSelectedJob(Object.keys(pinnedJobs).length);
  }

  changeSelectedJob(direction, unclassifiedOnly) {
    const { pinnedJobs } = this.props;
    const jobNavSelector = unclassifiedOnly ?
      thJobNavSelectors.UNCLASSIFIED_FAILURES : thJobNavSelectors.ALL_JOBS;
    // Get the appropriate next index based on the direction and current job
    // selection (if any).  Must wrap end to end.
    const getIndex = direction === 'next' ?
      (idx, jobs) => (idx + 1 > jobs.length - 1 ? 0 : idx + 1) :
      (idx, jobs) => (idx - 1 < 0 ? jobs.length - 1 : idx - 1);

    // TODO: (bug 1434679) Move from using jquery here to find the next/prev
    // component.  This could perhaps be done either with:
    // * Document functions like ``querySelectorAll``, etc.
    // * ReactJS with ReactDOM and props.children

    // Filter the list of possible jobs down to ONLY ones in the .th-view-content
    // div (excluding pinBoard) and then to the specific selector passed
    // in.  And then to only VISIBLE (not filtered away) jobs.  The exception
    // is for the .selected-job.  Even if the ``visible`` field is set to false,
    // this includes it because it is the anchor from which we find
    // the next/previous job.
    //
    // The .selected-job can be ``visible: false``, but still showing to the
    // user.  This can happen when filtered to unclassified failures only,
    // and you then classify the selected job.  It's ``visible`` field is set
    // to false, but it is still showing to the user because it is still
    // selected.  This is very important to the sheriff workflow.  As soon as
    // selection changes away from it, the job will no longer be visible.
    const jobs = $('.th-view-content')
      .find(jobNavSelector.selector)
      .filter(':visible, .selected-job, .selected-count');

    if (jobs.length) {
      const selectedEl = jobs.filter('.selected-job, .selected-count').first();
      const selIdx = jobs.index(selectedEl);
      const idx = getIndex(selIdx, jobs);
      const jobEl = $(jobs[idx]);

      if (selIdx !== idx) {
        const jobId = jobEl.attr('data-job-id');
        const jobInstance = findJobInstance(jobId, true);

        if (jobInstance) {
          // Delay loading details for the new job right away,
          // in case the user is switching rapidly between jobs
          this.setSelectedJob(jobInstance.props.job, 200);
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
      this.clearSelectedJob(Object.keys(pinnedJobs).length);
    }
  }

  clearIfEligibleTarget(target) {
    if (target.hasAttribute('data-job-clear-on-click')) {
      this.clearSelectedJob();
    }
  }

  render() {
    return (
      <SelectedJobContext.Provider value={this.value}>
        <div
          className="d-flex flex-column h-100"
          onClick={evt => this.clearIfEligibleTarget(evt.target)}
        >
          {this.props.children}
        </div>
      </SelectedJobContext.Provider>
    );
  }

}

SelectedJobClass.propTypes = {
  jobsLoaded: PropTypes.bool.isRequired,
  notify: PropTypes.func.isRequired,
  pinnedJobs: PropTypes.object.isRequired,
  jobMap: PropTypes.object.isRequired,
  children: PropTypes.object.isRequired,
};

export const SelectedJob = withNotifications(withPushes(withPinnedJobs(SelectedJobClass)));

export function withSelectedJob(Component) {
  return function SelectedJobComponent(props) {
    return (
      <SelectedJobContext.Consumer>
        {context => (
          <Component
            {...props}
            selectedJob={context.selectedJob}
            setSelectedJob={context.setSelectedJob}
            clearSelectedJob={context.clearSelectedJob}
            changeSelectedJob={context.changeSelectedJob}
          />
        )}
      </SelectedJobContext.Consumer>
    );
  };
}
