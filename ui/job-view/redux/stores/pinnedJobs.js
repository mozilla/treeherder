import { findJobInstance } from '../../../helpers/job';

import { notify } from './notifications';

const COUNT_ERROR = 'Max pinboard size of 500 reached.';
const MAX_SIZE = 500;
const SET_CLASSIFICATION_ID = 'SET_CLASSIFICATION_ID';
const SET_CLASSIFICATION_COMMENT = 'SET_CLASSIFICATION_COMMENT';
const SET_PINBOARD_VISIBLE = 'SET_PINBOARD_VISIBLE';
const SET_PINNED_JOBS = 'SET_PINNED_JOBS';
const SET_PINNED_JOB_BUGS = 'SET_PINNED_JOB_BUGS';
const REMOVE_JOB_BUG = 'REMOVE_JOB_BUG';
const UNPIN_ALL_JOBS = 'UNPIN_ALL_JOBS';

const pulsePinCount = () => {
  const jobEl = document.getElementById('pin-count-group');

  if (jobEl) {
    jobEl.classList.add('pin-count-pulse');
    window.setTimeout(() => {
      jobEl.classList.remove('pin-count-pulse');
    }, 700);
  }
};

export const setClassificationId = (id) => ({
  type: SET_CLASSIFICATION_ID,
  payload: {
    failureClassificationId: id,
  },
});

export const setClassificationComment = (text) => ({
  type: SET_CLASSIFICATION_COMMENT,
  payload: {
    failureClassificationComment: text,
  },
});

export const setPinBoardVisible = (isPinBoardVisible) => ({
  type: SET_PINBOARD_VISIBLE,
  payload: {
    isPinBoardVisible,
  },
});

export const pinJob = (job) => {
  return async (dispatch, getState) => {
    const {
      pinnedJobs: { pinnedJobs },
    } = getState();

    if (MAX_SIZE - Object.keys(pinnedJobs).length > 0) {
      dispatch({
        type: SET_PINNED_JOBS,
        payload: {
          pinnedJobs: { ...pinnedJobs, [job.id]: job },
        },
      });
      pulsePinCount();
    } else {
      dispatch(notify(COUNT_ERROR, 'danger'));
    }
  };
};

export const unPinJob = (job) => {
  return async (dispatch, getState) => {
    const {
      pinnedJobs: { pinnedJobs },
    } = getState();

    delete pinnedJobs[job.id];
    dispatch({
      type: SET_PINNED_JOBS,
      payload: { pinnedJobs: { ...pinnedJobs } },
    });
    pulsePinCount();
  };
};

export const pinJobs = (jobsToPin) => {
  return async (dispatch, getState) => {
    const {
      pinnedJobs: { pinnedJobs },
    } = getState();

    const spaceRemaining = MAX_SIZE - Object.keys(pinnedJobs).length;
    const showError = jobsToPin.length > spaceRemaining;
    const newPinnedJobs = jobsToPin
      .slice(0, spaceRemaining)
      .reduce((acc, job) => ({ ...acc, [job.id]: job }), {});

    if (!spaceRemaining || showError) {
      dispatch(notify(COUNT_ERROR, 'danger', { sticky: true }));
      return;
    }

    dispatch({
      type: SET_PINNED_JOBS,
      payload: {
        pinnedJobs: { ...pinnedJobs, ...newPinnedJobs },
      },
    });
  };
};

export const addBug = (bug, job) => {
  return async (dispatch, getState) => {
    const {
      pinnedJobs: { pinnedJobBugs },
    } = getState();

    pinnedJobBugs[bug.id] = bug;
    dispatch({
      type: SET_PINNED_JOB_BUGS,
      pinnedJobBugs: { ...pinnedJobBugs },
    });
    if (job) {
      // ``job`` here is likely passed in from the DetailsPanel which is not
      // the same object instance as the job shown in the normal job field.
      // The one from the DetailsPanel is the ``selectedJobFull``.
      // As a result, if we pin the ``selectedJobFull``, and then update it when
      // classifying, it won't update the display of the same job in the main
      // job field.  Thus, it won't disappear when in "unclassified only" mode.
      const jobInstance = findJobInstance(job.id);
      // Fall back to the ``job`` just in case ``jobInstance`` can't be found.
      // Use this fallback so the job will still get classified, even if it
      // is somehow not displayed in the job field and therefore it does
      // not need to be visually updated.
      const jobToPin = jobInstance ? jobInstance.props.job : job;

      dispatch(pinJob(jobToPin));
    }
  };
};

export const removeBug = (bugId) => ({
  type: REMOVE_JOB_BUG,
  bugId,
});

export const unPinAll = () => ({
  type: UNPIN_ALL_JOBS,
  payload: {
    failureClassificationId: 4,
    failureClassificationComment: '',
    pinnedJobs: {},
    pinnedJobBugs: {},
  },
});

export const togglePinJob = (job) => {
  return async (dispatch, getState) => {
    const {
      pinnedJobs: { pinnedJobs },
    } = getState();

    if (pinnedJobs[job.id]) {
      dispatch(unPinJob(job));
    } else {
      dispatch(pinJob(job));
    }
  };
};

const initialState = {
  pinnedJobs: {},
  pinnedJobBugs: {},
  failureClassificationComment: '',
  failureClassificationId: 4,
  isPinBoardVisible: false,
};

export const reducer = (state = initialState, action) => {
  const { type, payload, bugId } = action;
  const { pinnedJobBugs } = state;

  switch (type) {
    case SET_PINNED_JOBS:
      return { ...state, ...payload, isPinBoardVisible: true };
    case SET_PINNED_JOB_BUGS:
      return { ...state, ...payload };
    case SET_CLASSIFICATION_ID:
      return { ...state, ...payload };
    case SET_CLASSIFICATION_COMMENT:
      return { ...state, ...payload };
    case SET_PINBOARD_VISIBLE:
      return { ...state, ...payload };
    case UNPIN_ALL_JOBS:
      return { ...state, ...payload };
    case REMOVE_JOB_BUG:
      delete pinnedJobBugs[bugId];
      return { ...state, pinnedJobBugs: { ...pinnedJobBugs } };
    default:
      return state;
  }
};
