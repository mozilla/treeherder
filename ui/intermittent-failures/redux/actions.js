import { formatBugs } from '../helpers';
import { bugzillaBugsApi } from '../../helpers/url';

const fetchBugDataFailure = (name, error, status) => ({
  type: `FETCH_${name}_FAILURE`,
  message: error,
  status,
});

export const updateSelectedBugDetails = (bugId, summary, name) => ({
  type: `UPDATE_SELECTED_${name}`,
  bugId,
  summary,
});

export const fetchBugData = (url, name) => (dispatch) => {
  // reset when fetching data after a previous failure
  let status = null;
  dispatch(fetchBugDataFailure(name, {}, null));
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
  dispatch(fetchBugData(url, name),
  ).then(() => {
    if (!getState().bugsData.status) {
      const { results } = getState().bugsData.data;
      const bugs_list = formatBugs(results);
      return dispatch(fetchBugData(bugzillaBugsApi('rest/bug', {
        include_fields: 'id,status,summary,whiteboard',
        id: bugs_list,
      }), `BUGZILLA_${name}`));
    }
  })
);

export const fetchBugsThenBugDetails = (url, name, bug) => (dispatch, getState) => (
  dispatch(fetchBugData(url, name),
  ).then(() => {
    if (!getState().bugDetailsData.status) {
      return dispatch(fetchBugData(bugzillaBugsApi('rest/bug', {
        include_fields: 'summary',
        id: bug,
      }), `BUGZILLA_${name}`))
      .then((response) => {
        const summary = response.data.bugs.length < 1 ? '' : response.data.bugs[0].summary;
        dispatch(
          updateSelectedBugDetails(bug, summary, name));
      });
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

