import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import {
  graphsEndpoint,
  parseQueryParams,
  createQueryParams,
  createApiUrl,
  bugzillaBugsApi,
  updateQueryParams,
} from '../helpers/url';
import { getData } from '../helpers/http';

import { validateQueryParams, mergeData, formatBugs } from './helpers';

const useIntermittentFailuresData = (defaultState, mainGraphData = null, mainTableData = null) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize from location.state or defaultState
  const initialState = location.state || defaultState;

  const [errorMessages, setErrorMessages] = useState([]);
  const [initialParamsSet, setInitialParamsSet] = useState(false);
  const [tree, setTree] = useState(initialState.tree || null);
  const [startday, setStartday] = useState(initialState.startday || null);
  const [endday, setEndday] = useState(initialState.endday || null);
  const [bug, setBug] = useState(initialState.id || null);
  const [summary, setSummary] = useState(initialState.summary || null);
  const [tableData, setTableData] = useState([]);
  const [tableFailureStatus, setTableFailureStatus] = useState(null);
  const [isFetchingTable, setIsFetchingTable] = useState(false);
  const [graphData, setGraphData] = useState([]);
  const [graphFailureStatus, setGraphFailureStatus] = useState(null);
  const [isFetchingGraphs, setIsFetchingGraphs] = useState(false);
  const [lastLocation] = useState(initialState.location || null);

  // Track pending state update for the updateState callback pattern
  const pendingUpdateRef = useRef(null);

  const batchBugRequests = useCallback(async (bugIds) => {
    const urlParams = {
      include_fields: 'id,product,component,status,summary,whiteboard',
    };
    // TODO: bump up the max to ~1200 when this bug is fixed:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1497721
    let min = 0;
    let max = 800;
    let bugsList = [];
    const results = [];

    while (bugIds.length >= min) {
      const batch = bugIds.slice(min, max + 1);
      urlParams.id = batch.join();
      results.push(getData(bugzillaBugsApi('bug', urlParams)));

      min = max;
      max += 800;
    }

    for (const result of await Promise.all(results)) {
      bugsList = [...bugsList, ...result.data.bugs];
    }
    return bugsList;
  }, []);

  const getBugDetails = useCallback(async (url) => {
    const { data, failureStatus } = await getData(url);
    if (!failureStatus && data?.bugs?.length === 1) {
      setSummary(data.bugs[0].summary);
    }
  }, []);

  const getTableData = useCallback(
    async (url) => {
      setTableFailureStatus(null);
      setIsFetchingTable(true);
      const { data, failureStatus } = await getData(url);
      let mergedData = null;

      if (defaultState.route === '/main' && !failureStatus && data.length) {
        const bugIds = formatBugs(data);
        const bugzillaData = await batchBugRequests(bugIds);
        mergedData = mergeData(data, bugzillaData);
      }

      setTableData(mergedData || data);
      setTableFailureStatus(failureStatus);
      setIsFetchingTable(false);
    },
    [batchBugRequests, defaultState.route],
  );

  const getGraphData = useCallback(async (url) => {
    setGraphFailureStatus(null);
    setIsFetchingGraphs(true);
    const { data, failureStatus } = await getData(url);
    setGraphData(data);
    setGraphFailureStatus(failureStatus);
    setIsFetchingGraphs(false);
  }, []);

  const updateData = useCallback(
    (params, urlChanged = false) => {
      if (mainGraphData && mainTableData && !urlChanged) {
        setGraphData(mainGraphData);
        setTableData(mainTableData);
      } else {
        getGraphData(createApiUrl(graphsEndpoint, params));
        getTableData(createApiUrl(defaultState.endpoint, params));
      }

      if (params.bug) {
        getBugDetails(
          bugzillaBugsApi('bug', { include_fields: 'summary', id: params.bug }),
        );
      }
    },
    [getGraphData, getTableData, getBugDetails, defaultState.endpoint, mainGraphData, mainTableData],
  );

  const checkQueryValidation = useCallback(
    (params, urlChanged = false) => {
      const messages = validateQueryParams(
        params,
        defaultState.route === '/bugdetails',
      );

      if (messages.length > 0) {
        setErrorMessages(messages);
      } else {
        setErrorMessages([]);
        setInitialParamsSet(true);
        setSummary(null);

        // Update state with params
        if (params.tree !== undefined) setTree(params.tree);
        if (params.startday !== undefined) setStartday(params.startday);
        if (params.endday !== undefined) setEndday(params.endday);
        if (params.bug !== undefined) setBug(params.bug);

        updateData(params, urlChanged);
      }
    },
    [defaultState.route, updateData],
  );

  // updateState is called by child components to update dates/tree
  // It updates state and then triggers data refresh
  const updateState = useCallback(
    (updatedObj) => {
      // Apply updates
      if (updatedObj.tree !== undefined) setTree(updatedObj.tree);
      if (updatedObj.startday !== undefined) setStartday(updatedObj.startday);
      if (updatedObj.endday !== undefined) setEndday(updatedObj.endday);
      if (updatedObj.bug !== undefined) setBug(updatedObj.bug);

      // Store the update so the effect can process it
      pendingUpdateRef.current = updatedObj;
    },
    [],
  );

  // Effect to handle the callback logic from updateState
  useEffect(() => {
    if (pendingUpdateRef.current) {
      const updatedObj = pendingUpdateRef.current;
      pendingUpdateRef.current = null;

      // Build params from current state merged with update
      const params = {
        startday: updatedObj.startday ?? startday,
        endday: updatedObj.endday ?? endday,
        tree: updatedObj.tree ?? tree,
      };

      const currentBug = updatedObj.bug ?? bug;
      if (currentBug) {
        params.bug = currentBug;
      }

      getGraphData(createApiUrl(graphsEndpoint, params));
      getTableData(createApiUrl(defaultState.endpoint, params));

      // update query params if dates or tree are updated
      const queryString = createQueryParams(params);
      updateQueryParams(queryString, navigate, location);
    }
  }, [
    startday,
    endday,
    tree,
    bug,
    getGraphData,
    getTableData,
    navigate,
    location,
    defaultState.endpoint,
  ]);

  // Initial setup - equivalent to componentDidMount
  useEffect(() => {
    const params = { startday, endday, tree };

    if (bug) {
      params.bug = bug;
    }

    if (location.search !== '' && !location.state) {
      // update data based on the params or show error if params are missing
      checkQueryValidation(parseQueryParams(location.search));
    } else {
      // if the query params are not specified for mainview, set params based on default state
      if (location.search === '') {
        const queryString = createQueryParams(params);
        updateQueryParams(queryString, navigate, location);
      }

      setInitialParamsSet(true);
      getGraphData(createApiUrl(graphsEndpoint, params));
      getTableData(createApiUrl(defaultState.endpoint, params));
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    errorMessages,
    initialParamsSet,
    tree,
    startday,
    endday,
    bug,
    summary,
    tableData,
    tableFailureStatus,
    isFetchingTable,
    graphData,
    graphFailureStatus,
    isFetchingGraphs,
    lastLocation,
    // Router
    location,
    navigate,
    // Actions
    updateState,
    checkQueryValidation,
  };
};

export default useIntermittentFailuresData;
