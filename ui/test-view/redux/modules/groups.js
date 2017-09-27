import { treeherder } from '../configureStore';

export const types = {
  FETCH_TESTS: 'FETCH_TESTS',
  RENDER_TESTS: 'RENDER_TESTS',
  FILTER_TESTS: 'FILTER_TESTS',
  FETCH_OPTIONS: 'FETCH_OPTIONS',
  STORE_OPTIONS: 'STORE_OPTIONS',
  FETCH_COUNTS: 'FETCH_COUNTS',
  FETCH_BUGS: 'FETCH_BUGS',
  RENDER_COUNTS: 'RENDER_COUNTS',
  TOGGLE_EXPANDED: 'TOGGLE_EXPANDED',
  RENDER_EXPANDED: 'RENDER_EXPANDED',
  TOGGLE_HIDE_CLASSIFIED: 'TOGGLE_HIDE_CLASSIFIED',
  RENDER_BUGS: 'RENDER_BUGS',
};

export const getTestDataQuery = revision => encodeURIComponent(`
  query pushesQuery {
    allPushes(revision: "${revision}") {
        edges {
          node {
            id
            revision
            author
            repository {
              name
            }
            jobs (result: "testfailed", tier_Lt: 3) {
              edges {
                node {
                  id
                  result
                  guid
                  tier
                  failureClassification {
                    name
                  }
                  jobLog {
                    failureLine {
                      test
                      subtest
                      message
                      action
                      expected
                      signature
                      group {
                        name
                      }
                    }
                  }
                  jobType {
                    symbol
                    name
                  }  
                  jobGroup {
                    symbol
                    name
                  }
                  optionCollectionHash
                  buildPlatform {
                    platform
                    osName
                    architecture
                  }
                }
              }
            }
          }
        }
    }
  }
`);
export const getBugSuggestionQuery = guid => encodeURIComponent(`
  query textLogQuery {
    allJobs(guid:"${guid}") {
      edges {
        node {
          textLogStep {
            errors {
              bugSuggestions
            }
          }
        }
      }
    }
  }`);
const optionsQuery = encodeURIComponent(`
  query {
    allOptionCollections {
      optionCollectionHash
      option {
        name
      }
    }
  }
`);
export const actions = {
  updateTests: (revision, filter, options, hideClassified, bugSuggestions) => ({
    type: types.FETCH_TESTS,
    meta: {
      type: 'api',
      url: `${treeherder}/graphql?query=${getTestDataQuery(revision)}`,
      method: 'GET',
      filter,
      options,
      hideClassified,
      bugSuggestions,
    },
  }),
  fetchOptions: () => ({
    type: types.FETCH_OPTIONS,
    meta: {
      type: 'api',
      url: `${treeherder}/graphql?query=${optionsQuery}`,
      method: 'GET',
    },
  }),
  fetchCounts: (repoName, pushId) => ({
    type: types.FETCH_COUNTS,
    meta: {
      type: 'api',
      url: `${treeherder}/api/project/${repoName}/resultset/${pushId}/status/`,
      method: 'GET',
    },
  }),
  fetchBugs: (rowData) => ({
    type: types.FETCH_BUGS,
    meta: {
      type: 'api',
      url: `${treeherder}/graphql?query=`,
      method: 'GET',
      rowData,
    },
  }),
  filterTests: (filter, groups, options, hideClassified) => ({
    type: types.FILTER_TESTS,
    meta: {
      filter,
      groups,
      options,
      hideClassified,
      debounce: 'filter'
    },
  }),
  toggleHideClassified: (filter, groups, options, hideClassified) => ({
    type: types.TOGGLE_HIDE_CLASSIFIED,
    meta: {
      hideClassified,
      groups,
      options,
      filter,
    },
  }),
  toggleExpanded: (toggled, testName, expanded) => ({
    type: types.TOGGLE_EXPANDED,
    meta: {
      toggled,
      testName,
      expanded,
    },
  }),
};
const initialState = {
  groups: {},
  rowData: {},
  counts: { failed: 0, intermittent: 0, infra: 0, success: 0, running: 0, pending: 0 },
  hideClassified: { infra: true, intermittent: true },
  push: { revision: '', author: '', id: '', repository: {}},
  expanded: {},
  options: {},
  filter: '',
  bugSuggestions: {},
};
export const reducer = (state = initialState, action) => {
  switch (action.type) {
    case types.RENDER_TESTS:
      return {
        ...state,
        ...action.payload,
      };
    case types.RENDER_COUNTS:
      return {
        ...state,
        counts: { ...state.counts, ...action.payload.counts },
      };
    case types.STORE_OPTIONS:
      return {
        ...state,
        ...action.payload,
      };
    case types.RENDER_EXPANDED:
      return {
        ...state,
        ...action.payload,
      };
    case types.RENDER_BUGS:
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
};
