export const types = {
  SET_COUNTS_EXPANDED: 'SET_COUNTS_EXPANDED',
  SET_SHOW_DUPLICATES: 'SET_SHOW_DUPLICATES',
  SET_SELECTED_JOB: 'SET_SELECTED_JOB',
  SET_SELECTED_RUNNABLE_JOBS: 'SET_SELECTED_RUNNABLE_JOBS',
};

export const actions = {
  setSelectedJobId: jobId => ({
    type: types.SET_SELECTED_JOB,
    payload: {
      jobId,
    }
  }),
  setSelectedRunnableJobs: selectedRunnableJobs => ({
    type: types.SET_SELECTED_RUNNABLE_JOBS,
    payload: {
      selectedRunnableJobs,
    }
  }),
  setCountExpanded: countsExpanded => ({
    type: types.SET_COUNTS_EXPANDED,
    payload: {
      countsExpanded
    }
  }),
  setShowDuplicates: showDuplicates => ({
    type: types.SET_SHOW_DUPLICATES,
    payload: {
      showDuplicates
    }
  }),

};

const initialState = {
  selectedJobId: null,
  selectedRunnableJobs: null,
  countsExpanded: false,
  showDuplicates: false,
};

export const reducer = (state = initialState, action) => {
  switch (action.type) {
    case types.SET_SELECTED_JOB:
      return {
        ...state,
        selectedJobId: action.payload.jobId
      };
    case types.SET_SELECTED_RUNNABLE_JOBS:
    case types.SET_SHOW_DUPLICATES:
    case types.SET_COUNTS_EXPANDED:
      return {
        ...state,
        ...action.payload
      };
    default:
      return state;
  }
};
