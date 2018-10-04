import React from 'react';
import PropTypes from 'prop-types';

const COUNT_ERROR = 'Max pinboard size of 500 reached.';
const MAX_SIZE = 500;
const PinnedJobsContext = React.createContext({});

export class PinnedJobs extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      pinnedJobs: {},
      pinnedJobBugs: {},
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
    };
  }

  componentDidMount() {
    this.pinJob = this.pinJob.bind(this);
    this.unPinJob = this.unPinJob.bind(this);
    this.pinJobs = this.pinJobs.bind(this);
    this.addBug = this.addBug.bind(this);
    this.removeBug = this.removeBug.bind(this);
    this.unPinAll = this.unPinAll.bind(this);
    this.togglePinJob = this.togglePinJob.bind(this);
    this.setPinBoardVisible = this.setPinBoardVisible.bind(this);

    // TODO: this.value needs to now get the bound versions of the functions.
    // But when we move the function binding to the constructors, we won't
    // have to re-do this in componentDidMount.
    this.value = {
      ...this.state,
      setPinBoardVisible: this.setPinBoardVisible,
      togglePinJob: this.togglePinJob,
      pinJob: this.pinJob,
      unPinJob: this.unPinJob,
      pinJobs: this.pinJobs,
      unPinAll: this.unPinAll,
      addBug: this.addBug,
      removeBug: this.removeBug,
    };
  }

  setValue(newState, callback) {
    this.value = { ...this.value, ...newState };
    this.setState(newState, callback);
  }

  setPinBoardVisible(isPinBoardVisible) {
    this.setValue({ isPinBoardVisible });
  }

  pinJob(job, callback) {
    const { pinnedJobs } = this.state;
    const { notify } = this.props;

    if (MAX_SIZE - Object.keys(pinnedJobs).length > 0) {
      this.setValue({
        pinnedJobs: { ...pinnedJobs, [job.id]: job },
        isPinBoardVisible: true,
      }, () => { if (callback) callback(); });
      this.pulsePinCount();
    } else {
      notify.send(COUNT_ERROR, 'danger');
    }
  }

  unPinJob(job) {
    const { pinnedJobs } = this.state;

    delete pinnedJobs[job.id];
    this.setValue({ pinnedJobs: { ...pinnedJobs } });
  }

  pinJobs(jobsToPin) {
    const { pinnedJobs } = this.state;
    const { notify } = this.props;
    const spaceRemaining = MAX_SIZE - Object.keys(pinnedJobs).length;
    const showError = jobsToPin.length > spaceRemaining;
    const newPinnedJobs = jobsToPin.slice(0, spaceRemaining).reduce((acc, job) => ({ ...acc, [job.id]: job }), {});

    if (!spaceRemaining) {
      notify.send(COUNT_ERROR, 'danger', { sticky: true });
      return;
    }

    this.setValue({
      pinnedJobs: { ...pinnedJobs, ...newPinnedJobs },
      isPinBoardVisible: true,
    }, () => {
      if (showError) {
        notify.send(COUNT_ERROR, 'danger', { sticky: true });
      }
    });
  }

  addBug(bug, job) {
    const { pinnedJobBugs } = this.state;

    pinnedJobBugs[bug.id] = bug;
    this.setValue({ pinnedJobBugs: { ...pinnedJobBugs } });
    if (job) {
        this.pinJob(job);
    }
  }

  removeBug(id) {
    const { pinnedJobBugs } = this.state;

    delete pinnedJobBugs[id];
    this.setValue({ pinnedJobBugs: { ...pinnedJobBugs } });
  }

  unPinAll() {
    this.setValue({
      pinnedJobs: {},
      pinnedJobBugs: {},
    });
  }

  togglePinJob(job) {
    const { pinnedJobs } = this.state;

    if (pinnedJobs[job.id]) {
      this.unPinJob(job);
    } else {
      this.pinJob(job);
    }
  }

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
    return (
      <PinnedJobsContext.Provider value={this.value}>
        {this.props.children}
      </PinnedJobsContext.Provider>
    );
  }
}

export function withPinnedJobs(Component) {
  return function PinBoardComponent(props) {
    return (
      <PinnedJobsContext.Consumer>
        {context => (
          <Component
            {...props}
            pinnedJobs={context.pinnedJobs}
            pinnedJobBugs={context.pinnedJobBugs}
            isPinBoardVisible={context.isPinBoardVisible}
            setPinBoardVisible={context.setPinBoardVisible}
            pinJob={context.pinJob}
            unPinJob={context.unPinJob}
            pinJobs={context.pinJobs}
            unPinAll={context.unPinAll}
            togglePinJob={context.togglePinJob}
            addBug={context.addBug}
            removeBug={context.removeBug}
          />
        )}
      </PinnedJobsContext.Consumer>
    );
  };
}

PinnedJobs.propTypes = {
  notify: PropTypes.object.isRequired,
  children: PropTypes.object.isRequired,
};
