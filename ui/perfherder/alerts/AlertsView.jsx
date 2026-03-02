import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router';
import { Alert, Container } from 'react-bootstrap';
import cloneDeep from 'lodash/cloneDeep';

import withValidation from '../Validation';
import {
  convertParams,
  getFrameworkData,
  getStatus,
} from '../perf-helpers/helpers';
import {
  summaryStatusMap,
  endpoints,
  notSupportedAlertFiltersMessage,
} from '../perf-helpers/constants';
import {
  createQueryParams,
  getApiUrl,
  parseQueryParams,
} from '../../helpers/url';
import { getData, processResponse } from '../../helpers/http';
import ErrorMessages from '../../shared/ErrorMessages';
import OptionCollectionModel from '../../models/optionCollection';
import {
  genericErrorMessage,
  errorMessageClass,
} from '../../helpers/constants';
import ErrorBoundary from '../../shared/ErrorBoundary';
import LoadingSpinner from '../../shared/LoadingSpinner';

import AlertsViewControls from './AlertsViewControls';

function AlertsView({
  validated,
  frameworks,
  user,
  projects,
  performanceTags,
  ...otherProps
}) {
  const location = useLocation();
  const prevLocationSearch = useRef(location.search);

  const extendedOptions = useMemo(() => {
    const frameworkOptions = cloneDeep(frameworks);
    const ignoreFrameworks = { id: -1, name: 'all frameworks' };
    frameworkOptions.unshift(ignoreFrameworks);
    const allSheriffedFrameworks = {
      id: -2,
      name: 'all sheriffed frameworks',
    };
    frameworkOptions.unshift(allSheriffedFrameworks);
    return frameworkOptions;
  }, [frameworks]);

  const getDefaultStatus = (params) => {
    const statusParam = convertParams(params, 'status');
    if (!statusParam) {
      return Object.keys(summaryStatusMap)[1];
    }
    return getStatus(parseInt(params.status, 10));
  };

  const getDefaultFilterText = (params) => {
    const { filterText } = params;
    return filterText === undefined || filterText === null ? '' : filterText;
  };

  const getFiltersFromParams = useCallback(
    (params, frameworkOptions = extendedOptions) => {
      return {
        status: getDefaultStatus(params),
        framework: getFrameworkData({
          validated: params,
          frameworks: frameworkOptions,
        }),
        filterText: getDefaultFilterText(params),
        hideDownstream: convertParams(params, 'hideDwnToInv'),
        hideAssignedToOthers: convertParams(params, 'hideAssignedToOthers'),
        monitoredAlerts: convertParams(params, 'monitoredAlerts'),
      };
    },
    [extendedOptions],
  );

  const [filters, setFilters] = useState(() =>
    getFiltersFromParams(validated),
  );
  const [page, setPage] = useState(
    validated.page ? parseInt(validated.page, 10) : 1,
  );
  const [errorMessages, setErrorMessages] = useState([]);
  const [alertSummaries, setAlertSummaries] = useState([]);
  const [issueTrackers, setIssueTrackers] = useState([]);
  const [notSupportedAlertFilters, setNotSupportedAlertFilters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [optionCollectionMap, setOptionCollectionMap] = useState(null);
  const [count, setCount] = useState(0);
  const [id, setId] = useState(validated.id);
  const [totalPages, setTotalPages] = useState(0);

  // Refs to hold latest state for use in callbacks
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const idRef = useRef(id);
  idRef.current = id;
  const pageRef = useRef(page);
  pageRef.current = page;
  const issueTrackersRef = useRef(issueTrackers);
  issueTrackersRef.current = issueTrackers;
  const optionCollectionMapRef = useRef(optionCollectionMap);
  optionCollectionMapRef.current = optionCollectionMap;
  const alertSummariesRef = useRef(alertSummaries);
  alertSummariesRef.current = alertSummaries;
  const countRef = useRef(count);
  countRef.current = count;
  const errorMessagesRef = useRef(errorMessages);
  errorMessagesRef.current = errorMessages;

  const isListMode = useCallback(() => {
    return Boolean(!idRef.current);
  }, []);

  const generatePages = (cnt) => {
    const pages = [];
    for (let num = 1; num <= cnt; num++) {
      pages.push(num);
    }
    return pages;
  };

  const composeParams = useCallback(
    (alertId, pg, framework, status) => {
      const params = alertId
        ? { id: alertId }
        : {
            framework: framework.id,
            page: pg,
            status: summaryStatusMap[status],
          };

      const doNotFilter = -1;
      const allSheriffedFrameworksID = -2;
      const listMode = !alertId;

      if (listMode && params.status === doNotFilter) {
        delete params.status;
      }

      if (listMode) {
        if (params.framework === allSheriffedFrameworksID) {
          params.show_sheriffed_frameworks = true;
        }
        if (
          [doNotFilter, allSheriffedFrameworksID].includes(params.framework)
        ) {
          delete params.framework;
        }
      }

      return params;
    },
    [],
  );

  const fetchAlertSummaries = useCallback(
    async (alertId = idRef.current, update = false, pg = pageRef.current) => {
      setLoading(!update);
      setErrorMessages([]);

      const currentFilters = filtersRef.current;
      const currentErrorMessages = errorMessagesRef.current;
      const currentIssueTrackers = issueTrackersRef.current;
      const currentOptionCollectionMap = optionCollectionMapRef.current;
      const currentAlertSummaries = alertSummariesRef.current;
      const currentCount = countRef.current;

      const {
        status,
        framework,
        filterText,
        hideDownstream,
        hideAssignedToOthers,
        monitoredAlerts,
      } = currentFilters;

      setPage(pg);
      const updates = {};
      const params = composeParams(alertId, pg, framework, status);

      const listMode = !alertId;

      if (listMode) {
        if (filterText) {
          params.filter_text = filterText;
        }
        if (status === 'all regressions') {
          delete params.status;
          params.hide_improvements = true;
        }
        if (hideDownstream) {
          params.hide_related_and_invalid = hideDownstream;
        }
        if (hideAssignedToOthers) {
          params.with_assignee = user.username;
        }
        if (monitoredAlerts) {
          params.monitored_alerts = monitoredAlerts;
        }
      }

      const url = getApiUrl(
        `${endpoints.alertSummary}${createQueryParams(params)}`,
      );

      if (!currentIssueTrackers.length && !currentOptionCollectionMap) {
        const [newOptionCollectionMap, newIssueTrackers] = await Promise.all([
          OptionCollectionModel.getMap(),
          getData(getApiUrl(endpoints.issueTrackers)),
        ]);

        setOptionCollectionMap(newOptionCollectionMap);
        const trackerResponse = processResponse(
          newIssueTrackers,
          'issueTrackers',
          currentErrorMessages,
        );
        if (trackerResponse.issueTrackers) {
          setIssueTrackers(trackerResponse.issueTrackers);
        }
        if (trackerResponse.errorMessages) {
          updates.errorMessages = trackerResponse.errorMessages;
        }
      }

      const data = await getData(url);
      const response = processResponse(
        data,
        'alertSummaries',
        currentErrorMessages,
      );

      if (response.alertSummaries) {
        const summary = response.alertSummaries;

        if (update && summary.results.length !== 0) {
          const newSummaries = [...currentAlertSummaries];
          const index = newSummaries.findIndex(
            (item) => item.id === summary.results[0].id,
          );
          newSummaries.splice(index, 1, summary.results[0]);
          setAlertSummaries(newSummaries);
        } else {
          setAlertSummaries(update ? currentAlertSummaries : summary.results);
        }
        setCount(update ? currentCount : Math.ceil(summary.count / 10));
      } else if (response.errorMessages) {
        setErrorMessages(response.errorMessages);
      }

      if (updates.errorMessages) {
        setErrorMessages(updates.errorMessages);
      }
      setLoading(false);
    },
    [composeParams, user],
  );

  const selectNotSupportedFilters = useCallback(
    (userInput) => {
      const userInputArray = userInput.split(' ');
      const repositories = projects.map(({ name }) => name);
      const optionsCollection = Object.values(
        optionCollectionMapRef.current || {},
      );
      const allNotSupportedFilters = [...repositories, ...optionsCollection];
      return allNotSupportedFilters.filter((elem) =>
        userInputArray.includes(elem),
      );
    },
    [projects],
  );

  const getParamsFromFilters = (updatedFilters) => {
    return {
      page: 1,
      ...Object.fromEntries(
        Object.entries(updatedFilters).map(([filterName, filterValue]) => {
          switch (filterName) {
            case 'framework':
              return [filterName, filterValue.id];
            case 'status':
              return [filterName, summaryStatusMap[filterValue]];
            case 'hideDownstream':
              return ['hideDwnToInv', +filterValue];
            case 'hideAssignedToOthers':
              return [filterName, +filterValue];
            default:
              return [filterName, filterValue];
          }
        }),
      ),
    };
  };

  const setFiltersState = useCallback(
    async (updatedFilters, doUpdateParams = true) => {
      const currentFilters = cloneDeep(filtersRef.current);
      Object.assign(currentFilters, updatedFilters);

      if (isListMode()) {
        if (doUpdateParams) {
          validated.updateParams(getParamsFromFilters(updatedFilters));
        }
        setFilters(currentFilters);
        // fetchAlertSummaries will be triggered by the filters change
      } else {
        setFilters(currentFilters);
      }
      setNotSupportedAlertFilters(
        selectNotSupportedFilters(currentFilters.filterText),
      );
    },
    [isListMode, validated, selectNotSupportedFilters],
  );

  // Update totalPages when count changes
  useEffect(() => {
    setTotalPages(generatePages(count));
  }, [count]);

  // componentDidMount
  useEffect(() => {
    fetchAlertSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // componentDidUpdate - detect location.search changes
  useEffect(() => {
    if (location.search === prevLocationSearch.current) {
      prevLocationSearch.current = location.search;
      return;
    }

    const params = parseQueryParams(location.search);
    const prevParams = parseQueryParams(prevLocationSearch.current);
    prevLocationSearch.current = location.search;

    if (
      params.id !== prevParams.id ||
      params.status !== prevParams.status ||
      params.framework !== prevParams.framework ||
      params.filterText !== prevParams.filterText ||
      params.hideDwnToInv !== prevParams.hideDwnToInv ||
      params.hideAssignedToOthers !== prevParams.hideAssignedToOthers ||
      params.monitoredAlerts !== prevParams.monitoredAlerts
    ) {
      const newId = params.id || null;
      const newFilters = getFiltersFromParams(params);
      setId(newId);
      setFilters(newFilters);
      // Need to fetch with the new values
      idRef.current = newId;
      filtersRef.current = newFilters;
      fetchAlertSummaries(newId);
    } else if (params.page && params.page !== prevParams.page) {
      fetchAlertSummaries(undefined, false, parseInt(params.page, 10));
    }
  }, [location.search, getFiltersFromParams, fetchAlertSummaries]);

  const getCurrentPages = () => {
    if (totalPages.length === 5 || !totalPages.length) {
      return totalPages;
    }
    if (page + 4 > totalPages.length) {
      return totalPages.slice(-5);
    }
    return totalPages.slice(page - 1, page + 4);
  };

  const pageNums = getCurrentPages();

  return (
    <ErrorBoundary
      errorClasses={errorMessageClass}
      message={genericErrorMessage}
    >
      <Container fluid className="pt-5 max-width-default">
        {loading && <LoadingSpinner />}

        {errorMessages.length > 0 && (
          <Container className="pt-5 px-0 max-width-default">
            <ErrorMessages errorMessages={errorMessages} />
          </Container>
        )}

        {!user.isStaff && (
          <Alert variant="info">
            You must be logged into perfherder/treeherder and be a sheriff to
            make changes
          </Alert>
        )}

        {notSupportedAlertFilters.length > 0 && (
          <Alert variant="warning">
            {notSupportedAlertFiltersMessage(notSupportedAlertFilters)}
          </Alert>
        )}

        <AlertsViewControls
          isListMode={isListMode()}
          filters={filters}
          pageNums={pageNums}
          alertSummaries={alertSummaries}
          frameworkOptions={extendedOptions}
          issueTrackers={issueTrackers}
          optionCollectionMap={optionCollectionMap}
          fetchAlertSummaries={(alertId, update = true, pg) =>
            fetchAlertSummaries(alertId, update, pg)
          }
          updateViewState={(state) => {
            if (state.alertSummaries !== undefined)
              setAlertSummaries(state.alertSummaries);
            if (state.errorMessages !== undefined)
              setErrorMessages(state.errorMessages);
            if (state.count !== undefined) setCount(state.count);
          }}
          setFiltersState={setFiltersState}
          user={user}
          page={page}
          count={count}
          validated={validated}
          projects={projects}
          frameworks={frameworks}
          performanceTags={performanceTags}
          {...otherProps}
        />
        {!loading && alertSummaries.length === 0 && (
          <p className="lead text-center">No alerts to show</p>
        )}
      </Container>
    </ErrorBoundary>
  );
}

AlertsView.propTypes = {
  user: PropTypes.shape({}).isRequired,
  validated: PropTypes.shape({
    updateParams: PropTypes.func.isRequired,
    framework: PropTypes.string,
  }).isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  performanceTags: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default withValidation(
  { requiredParams: new Set([]) },
  false,
)(AlertsView);
