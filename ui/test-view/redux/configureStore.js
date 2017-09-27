import {
  createStore,
  bindActionCreators,
  combineReducers,
  applyMiddleware,
} from 'redux';
import * as groupsStore from './modules/groups';
import { platformMap } from './store'
import createHistory from 'history/createBrowserHistory';
import createDebounce from 'redux-debounce'

// // TODO: When this app is part of Treeherder, we can get this from the router / URL
export const treeherder_host = process.env.TREEHERDER_HOST ? process.env.TREEHERDER_HOST : 'treeherder.mozilla.org';
export const fetch_protocol = process.env.FETCH_PROTOCOL ? process.env.FETCH_PROTOCOL : 'https';
export const treeherder = `${fetch_protocol}://${treeherder_host}`;
const request = (url, options) => fetch(url.replace('http:', `${fetch_protocol}:`), options);

function getGroupText(group) {
  const symbol = group.symbol.startsWith('tc-') ?
      group.symbol.substring(3) : group.symbol;
  const name = group.name.replace(' executed by TaskCluster', '');
  return symbol === '?' ? 'Ungrouped' : `${symbol} - ${name}`;
}

function getId(hash) {
  return atob(hash).split(':')[1]
}

async function fetchTests(store, fetchOptions) {
  let fetchStatus = 'No failed tests to show';
  const { url, filter, options, hideClassified, bugSuggestions } = fetchOptions;
  const response = await request(url, fetchOptions);
  const pushResp = await response.json();
  // Here the json is the job_detail result.
  // We need to take each entry and query for the errorsummary.log
  // then take those and make an object out of it.
  const pushData = pushResp.data.allPushes.edges[0].node;
  const push = {
    revision: pushData.revision,
    author: pushData.author,
    id: getId(pushData.id),
    repository: pushData.repository,
  };
  let payload = {groups: {}, rowData: {}, fetchStatus, push, treeherder, filter };
  const jobs = pushData.jobs.edges;
  // It's possible there are no failed jobs, so return early.

  if (!jobs.length) {
    store.dispatch({
      type: groupsStore.types.RENDER_TESTS,
      payload,
    });
    return;
  }

  // ``payload.groups`` will look like:
  // { jobGroupName1: { testName1: { group: foo, jobs: [ job1: [FailureLine1, ... ], ... ] } }, ... }
  payload.groups = jobs.reduce((acc, {node: job}) => {
    const jobGroupName = getGroupText(job.jobGroup);
    const logSet = job.jobLog;

    // At this point, we want the job to have ONLY the job data, not its errorlines anymore.
    delete job.jobLog;
    acc[jobGroupName] = acc[jobGroupName] ? { ...acc[jobGroupName] } : {};
    job.jobId = getId(job.id);

    // Split this job's failureLines into each test they belong to.
    const testFailureLines = logSet.reduce((lsAcc, joblog) => (
      joblog.failureLine.reduce((flAcc, failureLine) => (
        failureLine ? buildFailureLines(lsAcc, failureLine) : lsAcc
      ), {})
    ), {});

    // ``testFailureLines`` looks like:
    //   { testName: [FailureLine, FailureLine] }
    // We need to create ``payload.groups`` by injecting the job in there:
    //   { testName: jobs: [ job1: { failureLines: [ FailureLine, ...] } ], group: testGroupName }
    Object.entries(testFailureLines).forEach(([testName, test]) => {
      // Make a copy of the job that is just for this single testName because each test
      // needs its own job copy that contains the failureLines for only that test.
      const flJob = Object.assign({}, job);
      test.jobs = [flJob];
      test.name = testName;
      // set the failureLines of this test to this test's job
      flJob.failureLines = test.failureLines;
      delete test.failureLines;

      acc[jobGroupName][testName] = acc[jobGroupName][testName]
          ? acc[jobGroupName][testName]
          : { group: test.group, jobs: [] };
      acc[jobGroupName][testName].jobs = [ ...acc[jobGroupName][testName].jobs, flJob];
      acc[jobGroupName][testName].bugs = bugSuggestions[`${jobGroupName}-${testName}`];
    });
    return acc;
  }, {});

  fetchStatus = Object.values(payload.groups).length ? 'HasData' : fetchStatus;

  // Dispatch an action that causes the UI to re-render with the new state.
  payload = {
    ...payload,
    rowData: filterGroups(filter, payload.groups, options, hideClassified),
    fetchStatus,
  };
  store.dispatch({
    type: groupsStore.types.RENDER_TESTS,
    payload,
  });
  store.dispatch(groupsStore.actions.fetchBugs(payload.rowData));
  // We use most of the counts from the push status, but ``failed`` will be a count of
  // the "test failures" rather than jobs.  So we walk each group(manifest) and count
  // the failed tests.
  // Note: this is in contrast to the "testfailed" entry coming from pushStatus; those are jobs.
  store.dispatch(groupsStore.actions.fetchCounts(pushData.repository.name, getId(pushData.id)));
  const failedJobs = Object
    .values(payload.groups)
    .reduce((gacc, tests) => gacc.concat(Object
        .values(tests)
        .reduce((jacc, test) => jacc.concat(test.jobs), []))
      , []);
  store.dispatch({
    type: groupsStore.types.RENDER_COUNTS,
    payload: {
      counts: {
        failed: failedJobs.filter(job => !(['infra', 'intermittent'].includes(job.failureClassification.name))).length,
        infra: failedJobs.filter(job => job.failureClassification.name === 'infra').length,
        intermittent: failedJobs.filter(job => job.failureClassification.name === 'intermittent').length
      },
    }
  });
}

function buildFailureLines(lsAcc, failureLine) {
  if (failureLine.test) {
    lsAcc[failureLine.test] = lsAcc[failureLine.test]
      ? lsAcc[failureLine.test]
      : {group: failureLine.group.length ? failureLine.group[0].name : "Unavailable", failureLines: []};
    lsAcc[failureLine.test].failureLines = [...lsAcc[failureLine.test].failureLines, failureLine];
  }
  return lsAcc;
}

async function fetchOptions(store, fetchOptions) {
  const { url } = fetchOptions;
  const resp = await request(url, fetchOptions);
  const options = await resp.json();
  store.dispatch({
    type: groupsStore.types.STORE_OPTIONS,
    payload: {
      options: options.data.allOptionCollections.reduce((acc, opt) => ({
        ...acc,
        [opt.optionCollectionHash]: opt.option.name
      }), {}),
    }
  })
}

async function fetchCounts(store, fetchOptions) {
  const { url } = fetchOptions;
  const resp = await request(url, fetchOptions);
  const pushStatus = await resp.json();
  const counts = {
    success: 0,
    pending: 0,
    running: 0,
    ...pushStatus,
  };
  store.dispatch({
    type: groupsStore.types.RENDER_COUNTS,
    payload: {
      counts,
    }
  })
}

/**
 * Add jobs that pass the filter to the accumulator.
 *
 * @param acc - The accumulator.  Add/update group and test here if there
 *              are jobs that pass the filter
 * @param test - The test to traverse to determine what to add
 * @param groupName - Name of the current group
 * @param testName - Name of the test for which we're filtering jobs
 * @param options - The map of optionCollectionHash to option strings
 * @param regexes - Array of Regexes that ``filterStr`` must pass
 */
function addFilteredJobs(acc, test, groupName, testName, options, regexes, hideClassified) {
  test.jobs.forEach(job => {
    // Reconstruct this each time because the same ``job`` can exist on
    // different test paths (more than one test can happen as a result of
    // one job).  So we can't just store this ``filterStr`` in the job
    // on data load.
    if (hideClassified[job.failureClassification.name]) {
      return;
    }
    const filterStr = [groupName, testName, test.group,
      platformMap[job.buildPlatform.platform], options[job.optionCollectionHash]].join(' ');

    if (regexes.every(regex => regex.test(filterStr))) {
      // create the groupName if we haven't done so yet.
      const newGroup = acc[groupName] = { ...acc[groupName] };
      // create the testName if we haven't done so yet.
      const newTest = newGroup[testName] = { ...acc[groupName][testName] };
      newTest.group = test.group;
      newTest.jobGroup = groupName;
      newTest.name = testName;
      newTest.bugs = test.bugs;
      newTest.jobs = newTest.jobs ? [ ...newTest.jobs, job ] : [job];
    }
  });
}

/**
 * Return a new filtered ``groups`` object.
 *
 * @param filter - Value from the UI filter field
 * @param groups - The current UI display-able object that has all loaded test data
 * @param options - Map of optionCollectionHash to option strings
 * @returns Filtered UI display-able groups object
 */
function filterGroups(filter, groups, options, hideClassified) {
  const filterRegexes = filter ? filter.split(' ').map(regexStr => new RegExp(regexStr, 'i')) : [new RegExp('', 'i')];

  return Object.entries(groups).reduce((gacc, [groupName, tests]) => {
    Object.entries(tests).forEach(([testName, test]) => {
      addFilteredJobs(gacc, test, groupName, testName, options, filterRegexes, hideClassified);
    });
    return gacc;
  }, {});
}

// Called when typing values into the filter
function filterTests(store, { filter, groups, options, hideClassified }) {
  const rowData = filterGroups(filter, groups, options, hideClassified);
  const history = createHistory();
  const location = history.location;
  const params = new URLSearchParams(location.search.slice(1));

  if (filter) {
    params.set("filter", filter);
  } else {
    params.delete("filter");
  }
  history.push(location.pathname + '?' + params.toString());
  store.dispatch({
    type: groupsStore.types.RENDER_TESTS,
    payload: { filter, rowData },
  });
}

function toggleHideClassified(store, fetchOptions) {
  const { filter, groups, options, hideClassified } = fetchOptions;
  const rowData = filterGroups(filter, groups, options, hideClassified);

  store.dispatch({
    type: groupsStore.types.RENDER_TESTS,
    payload: { hideClassified, options, filter, groups, rowData },
  });
}

async function fetchBugs(store, { rowData, url }) {
  // map of tests to urls
  const testMap = Object.entries(rowData).reduce((gacc, [groupName, tests]) => {
    Object.entries(tests).forEach(([testName, test]) => {
      test.jobs.forEach(job => {
        const bsUrl = url + groupsStore.getBugSuggestionQuery(job.guid);
        gacc = { ...gacc, [bsUrl]: gacc[bsUrl] ? [ ...gacc[bsUrl], test] : [test] };
      })
    });
    return gacc;
  }, {});
  // Do a request for each url in the keys of the testMap.  Using them as keys eliminates
  // duplicate requests since multiple tests can be in the same job.
  const responses = await Promise.all(Object.keys(testMap).map(url => request(url)));
  const respData = await Promise.all(responses.map(promise => promise.json()));
  const bugSuggestions = respData.reduce((bsAcc, data, idx) => {
    testMap[responses[idx].url].forEach(test => {
      test.bugs = { ...test.bugs, ...extractBugSuggestions(data, test.name) };
      bsAcc = { ...bugSuggestions, [`${test.jobGroup}-${test.name}`]: test.bugs};
    });
    return bsAcc;
  }, {});

  store.dispatch({
    type: groupsStore.types.RENDER_BUGS,
    payload: {
      bugSuggestions,
    }
  });
}

async function toggleExpanded(store, { toggled, testName, expanded }) {
  store.dispatch({
    type: groupsStore.types.RENDER_EXPANDED,
    payload: {
      expanded: { ...expanded, [testName]: toggled },
    }
  });
}

/**
 *  Split up the test name, in case this is a reftest that won't match with a
 *  bug summary very well.
 * @param testName The testName that's shown in the UI
 * @returns {Array}
 */
function splitTestName(testName) {
  return testName.split(" == ").map(testSub => testSub.substring(testSub.lastIndexOf('/')));
}

function getMatchingTestBugs(bs, testName) {
  return splitTestName(testName).some(sub => bs.search.includes(sub)) ?
    bs.bugs.open_recent.reduce((bsAcc, bug) => (
      // Since one test can have multiple jobs which could have multiples of the same bug,
      // key this object off the bug id so we automatically eliminate duplicates.
      { ...bsAcc, [bug.id]: bug }
    ), {}) : {};
}

function extractBugSuggestions(bugSuggestions, testName) {
  return bugSuggestions.data.allJobs.edges.reduce((jacc, { node: job }) => (
      { ...jacc, ...job.textLogStep.reduce((tlsAcc, step) => (
        // Only add the bug suggestions that match the testName for this job
        { ...tlsAcc, ...step.errors.reduce((sAcc, error) => (
          { ...sAcc, ...getMatchingTestBugs(error.bugSuggestions, testName) }
        ), {}) }
      ), {}) }
    ), {});
}

const testDataMiddleware = store => next => action => {
  if (!action.meta) {
    return next(action);
  }

  const consumed = { ...action };
  delete consumed.meta;

  switch (action.type) {
    case groupsStore.types.FETCH_TESTS:
      fetchTests(store, { ...action.meta });
      return next(consumed);
    case groupsStore.types.FETCH_OPTIONS:
      fetchOptions(store, { ...action.meta });
      return next(consumed);
    case groupsStore.types.FETCH_COUNTS:
      fetchCounts(store, { ...action.meta });
      return next(consumed);
    case groupsStore.types.FETCH_BUGS:
      fetchBugs(store, { ...action.meta });
      return next(consumed);
    case groupsStore.types.TOGGLE_EXPANDED:
      toggleExpanded(store, { ...action.meta });
      return next(consumed);
    case groupsStore.types.TOGGLE_HIDE_CLASSIFIED:
      toggleHideClassified(store, { ...action.meta });
      return next(consumed);
    case groupsStore.types.FILTER_TESTS:
      filterTests(store, { ...action.meta });
      return next(consumed);
    default:
      break;
  }

  return next(action);
};

export const configureStore = () => {
  const debounceConfig = { filter: 300 };
  const debouncer = createDebounce(debounceConfig);
  const reducer = combineReducers({
    groups: groupsStore.reducer,
  });
  const store = createStore(reducer, applyMiddleware(debouncer, testDataMiddleware));
  const actions = {
    groups: bindActionCreators(groupsStore.actions, store.dispatch),
  };

  return { store, actions };
};

export default configureStore;
