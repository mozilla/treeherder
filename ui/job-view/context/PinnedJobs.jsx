import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { notify } from '../redux/stores/notifications';

const COUNT_ERROR = 'Max pinboard size of 500 reached.';
const MAX_SIZE = 500;
const PinnedJobsContext = React.createContext({});

export class PinnedJobsClass extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      pinnedJobs: {},
      pinnedJobBugs: {},
      failureClassificationComment: '',
      failureClassificationId: 4,
      isPinBoardVisible: false,
    };
    this.value = {
      ...this.state,
      setPinBoardVisible: this.setPinBoardVisible,
      pinJob: this.pinJob,
      unPinJob: this.unPinJob,
      togglePinJob: this.togglePinJob,
      pinJobs: this.pinJobs,
      unPinAll: this.unPinAll,
      addBug: this.addBug,
      removeBug: this.removeBug,
      setClassificationId: this.setClassificationId,
      setClassificationComment: this.setClassificationComment,
    };
  }

  setValue(newState, callback) {
    this.value = { ...this.value, ...newState };
    this.setState(newState, callback);
  }

  setClassificationId = id => {
    this.setValue({ failureClassificationId: id });
  };

  setClassificationComment = text => {
    this.setValue({ failureClassificationComment: text });
  };

  setPinBoardVisible = isPinBoardVisible => {
    this.setValue({ isPinBoardVisible });
  };

  pinJob = (job, callback) => {
    const { pinnedJobs } = this.state;
    const { notify } = this.props;

    if (MAX_SIZE - Object.keys(pinnedJobs).length > 0) {
      this.setValue(
        {
          pinnedJobs: { ...pinnedJobs, [job.id]: job },
          isPinBoardVisible: true,
        },
        () => {
          if (callback) callback();
        },
      );
      this.pulsePinCount();
    } else {
      notify(COUNT_ERROR, 'danger');
    }
  };

  unPinJob = job => {
    const { pinnedJobs } = this.state;

    delete pinnedJobs[job.id];
    this.setValue({ pinnedJobs: { ...pinnedJobs } });
  };

  pinJobs = jobsToPin => {
    const { pinnedJobs } = this.state;
    const { notify } = this.props;
    const spaceRemaining = MAX_SIZE - Object.keys(pinnedJobs).length;
    const showError = jobsToPin.length > spaceRemaining;
    const newPinnedJobs = jobsToPin
      .slice(0, spaceRemaining)
      .reduce((acc, job) => ({ ...acc, [job.id]: job }), {});

    if (!spaceRemaining) {
      notify(COUNT_ERROR, 'danger', { sticky: true });
      return;
    }

    this.setValue(
      {
        pinnedJobs: { ...pinnedJobs, ...newPinnedJobs },
        isPinBoardVisible: true,
      },
      () => {
        if (showError) {
          notify(COUNT_ERROR, 'danger', { sticky: true });
        }
      },
    );
  };

  addBug = (bug, job) => {
    const { pinnedJobBugs } = this.state;

    pinnedJobBugs[bug.id] = bug;
    this.setValue({ pinnedJobBugs: { ...pinnedJobBugs } });
    if (job) {
      this.pinJob(job);
    }
  };

  removeBug = id => {
    const { pinnedJobBugs } = this.state;

    delete pinnedJobBugs[id];
    this.setValue({ pinnedJobBugs: { ...pinnedJobBugs } });
  };

  unPinAll = () => {
    this.setValue({
      failureClassificationId: 4,
      failureClassificationComment: '',
      pinnedJobs: {},
      pinnedJobBugs: {},
    });
  };

  togglePinJob = job => {
    const { pinnedJobs } = this.state;

    if (pinnedJobs[job.id]) {
      this.unPinJob(job);
    } else {
      this.pinJob(job);
    }
  };

  pulsePinCount() {
    const jobEl = document.getElementById('pin-count-group');

    if (jobEl) {
      jobEl.classList.add('pin-count-pulse');
      window.setTimeout(() => {
        jobEl.classList.remove('pin-count-pulse');
      }, 700);
    }
  }

  render() {
    const { children } = this.props;
    return (
      <PinnedJobsContext.Provider value={this.value}>
        {children}
      </PinnedJobsContext.Provider>
    );
  }
}

PinnedJobsClass.propTypes = {
  notify: PropTypes.func.isRequired,
  children: PropTypes.object.isRequired,
};

export const PinnedJobs = connect(
  null,
  { notify },
)(PinnedJobsClass);

export function withPinnedJobs(Component) {
  return function PinBoardComponent(props) {
    return (
      <PinnedJobsContext.Consumer>
        {context => (
          <Component
            {...props}
            pinnedJobs={context.pinnedJobs}
            pinnedJobBugs={context.pinnedJobBugs}
            countPinnedJobs={Object.keys(context.pinnedJobs).length}
            isPinBoardVisible={context.isPinBoardVisible}
            setPinBoardVisible={context.setPinBoardVisible}
            pinJob={context.pinJob}
            unPinJob={context.unPinJob}
            pinJobs={context.pinJobs}
            unPinAll={context.unPinAll}
            togglePinJob={context.togglePinJob}
            addBug={context.addBug}
            removeBug={context.removeBug}
            failureClassificationId={context.failureClassificationId}
            failureClassificationComment={context.failureClassificationComment}
            setClassificationId={context.setClassificationId}
            setClassificationComment={context.setClassificationComment}
          />
        )}
      </PinnedJobsContext.Consumer>
    );
  };
}
