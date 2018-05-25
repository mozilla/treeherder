import { formatBugs } from '../helpers';
import { bugzillaBugsApi } from '../../helpers/url';

export const fetchBugDataSuccess = (data, name) => ({
  type: `FETCH_${name}_SUCCESS`,
  data,
});

export const fetchBugDataFailure = name => ({
  type: `FETCH_${name}_FAILURE`,
  message: 'Oops, there was a problem retrieving the data. Please try again later.',
});

export const fetchBugData = (url, name) => dispatch => (
  fetch(url).then(response => response.json())
    .then(json => dispatch(fetchBugDataSuccess(json, name)))
    .catch(() => dispatch(fetchBugDataFailure(name)))
);

export const fetchBugsThenBugzilla = (url, name) => (dispatch, getState) => (
  dispatch(fetchBugData(url, name),
  ).then(() => {
    const { results } = getState().bugsData.data;
    const bugs_list = formatBugs(results);
    return dispatch(fetchBugData(bugzillaBugsApi('rest/bug', {
      include_fields: 'id,status,summary,whiteboard',
      id: bugs_list,
    }), 'BUGZILLA'));
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

export const updateSelectedBugDetails = (bugId, summary, name) => ({
  type: `UPDATE_SELECTED_${name}`,
  bugId,
  summary,
});
