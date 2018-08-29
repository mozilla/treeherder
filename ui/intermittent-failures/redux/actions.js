import { formatBugs } from '../helpers';
import { bugzillaBugsApi } from '../../helpers/url';

const fetchBugDataFailure = (name, error, failureStatus) => ({
  type: `FETCH_${name}_FAILURE`,
  message: error,
  failureStatus,
});

export const updateSelectedBugDetails = (bugId, summary, name) => ({
  type: `UPDATE_SELECTED_${name}`,
  bugId,
  summary,
});

export const processingRequest = name => ({
  type: `REQUESTING_${name}_DATA`,
});

export const hasError = name => ({
  type: `${name}_ERROR`,
});

export const fetchBugData = (url, name) => (dispatch) => {
  // reset when fetching data after a previous failure
  let status = null;
  dispatch(fetchBugDataFailure(name, {}, null));
  dispatch(processingRequest(name));
  return fetch(url)
    .then((response) => {
      status = response.status;
      return response.json();
    })
    .then((data) => {
      if (status === 200) {
        return dispatch({
          type: `FETCH_${name}_SUCCESS`,
          data,
        });
      }
      return dispatch(fetchBugDataFailure(name, data, status));
    });
};

export const fetchBugsThenBugzilla = (url, name) => (dispatch, getState) => (
  dispatch(fetchBugData(url, name))
  .then(() => {
    if (!getState().bugsData.failureStatus) {
      const { results } = getState().bugsData.data;
      const bugs_list = formatBugs(results);
      return dispatch(fetchBugData(bugzillaBugsApi('bug', {
        include_fields: 'id,status,summary,whiteboard',
        id: bugs_list,
      }), `BUGZILLA_${name}`));
    }
  })
);

export const updateDateRange = (from, to, name) => ({
  type: `UPDATE_${name}_DATE_RANGE`,
  from,
  to,
});

export const updateTreeName = (tree, name) => ({
  type: `UPDATE_${name}_VIEW_TREE`,
  tree,
});

