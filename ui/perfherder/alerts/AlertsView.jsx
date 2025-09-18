import React from 'react';
import PropTypes from 'prop-types';
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

class AlertsView extends React.Component {
  constructor(props) {
    super(props);
    const { frameworks, validated } = this.props;
    this.extendedOptions = this.extendDropdownOptions(frameworks);
    this.state = {
      filters: this.getFiltersFromParams(validated),
      frameworkOptions: this.extendedOptions,
      page: validated.page ? parseInt(validated.page, 10) : 1,
      errorMessages: [],
      alertSummaries: [],
      issueTrackers: [],
      notSupportedAlertFilters: [],
      loading: false,
      optionCollectionMap: null,
      count: 0,
      id: validated.id,
      bugTemplate: null,
      totalPages: 0,
    };
  }

  componentDidMount() {
    this.fetchAlertSummaries();
  }

  componentDidUpdate(prevProps, prevState) {
    const { count } = this.state;

    if (prevState.count !== count) {
      this.setState({ totalPages: this.generatePages(count) });
    }

    const params = parseQueryParams(this.props.location.search);
    const prevParams = parseQueryParams(prevProps.location.search);
    // we're using local state for id instead of validated.id because once
    // the user navigates from the id=<alert> view back to the main alerts view
    // the Validation component won't reset the id (since the query param doesn't exist
    // unless there is a value)
    if (
      params.id !== prevParams.id ||
      params.status !== prevParams.status ||
      params.framework !== prevParams.framework ||
      params.filterText !== prevParams.filterText ||
      params.hideDwnToInv !== prevParams.hideDwnToInv ||
      params.hideAssignedToOthers !== prevParams.hideAssignedToOthers ||
      params.monitoredAlerts !== prevParams.monitoredAlerts
    ) {
      this.setState(
        { id: params.id || null, filters: this.getFiltersFromParams(params) },
        this.fetchAlertSummaries,
      );
      // all data updates due to page changes happens here so as
      // to support back button navigation
    } else if (params.page && params.page !== prevParams.page) {
      this.fetchAlertSummaries(undefined, false, parseInt(params.page, 10));
    }
  }

  getFiltersFromParams = (
    validated,
    frameworkOptions = this.extendedOptions,
  ) => {
    return {
      status: this.getDefaultStatus(validated),
      framework: getFrameworkData({
        validated,
        frameworks: frameworkOptions,
      }),
      filterText: this.getDefaultFilterText(validated),
      hideDownstream: convertParams(validated, 'hideDwnToInv'),
      hideAssignedToOthers: convertParams(validated, 'hideAssignedToOthers'),
      monitoredAlerts: convertParams(validated, 'monitoredAlerts'),
    };
  };

  getDefaultStatus = (validated) => {
    const statusParam = convertParams(validated, 'status');
    if (!statusParam) {
      return Object.keys(summaryStatusMap)[1];
    }
    return getStatus(parseInt(validated.status, 10));
  };

  getDefaultFilterText = (validated) => {
    const { filterText } = validated;
    return filterText === undefined || filterText === null ? '' : filterText;
  };

  setFiltersState = async (updatedFilters, doUpdateParams = true) => {
    const { filters } = this.state;
    const currentFilters = cloneDeep(filters);
    Object.assign(currentFilters, updatedFilters);

    if (this.isListMode()) {
      if (doUpdateParams) {
        this.props.validated.updateParams(
          this.getParamsFromFilters(updatedFilters),
        );
      }
      this.setState({ filters: currentFilters }, this.fetchAlertSummaries);
    } else {
      this.setState({ filters: currentFilters });
    }
    this.setState({
      notSupportedAlertFilters: this.selectNotSupportedFilters(
        currentFilters.filterText,
      ),
    });
  };

  isListMode = () => {
    return Boolean(!this.state.id);
  };

  extendDropdownOptions = (frameworks) => {
    const frameworkOptions = cloneDeep(frameworks);
    const ignoreFrameworks = { id: -1, name: 'all frameworks' };
    frameworkOptions.unshift(ignoreFrameworks);
    const allSheriffedFrameworks = {
      id: -2,
      name: 'all sheriffed frameworks',
    };
    frameworkOptions.unshift(allSheriffedFrameworks);
    return frameworkOptions;
  };

  getParamsFromFilters = (filters) => {
    return {
      page: 1, // default value
      ...Object.fromEntries(
        Object.entries(filters).map(([filterName, filterValue]) => {
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

  getCurrentPages = () => {
    const { page, totalPages } = this.state;
    if (totalPages.length === 5 || !totalPages.length) {
      return totalPages;
    }
    if (page + 4 > totalPages.length) {
      return totalPages.slice(-5);
    }
    return totalPages.slice(page - 1, page + 4);
  };

  generatePages = (count) => {
    const pages = [];
    for (let num = 1; num <= count; num++) {
      pages.push(num);
    }
    return pages;
  };

  composeParams = (id, page, framework, status) => {
    const params = id
      ? { id }
      : { framework: framework.id, page, status: summaryStatusMap[status] };

    // -1 ('all') is created for UI purposes but is not a valid API parameter
    const doNotFilter = -1;
    // -2 ('all sheriffed') Constant created for UI purposes but is not a valid API parameter
    const allSheriffedFrameworksID = -2;
    const listMode = !id;

    if (listMode && params.status === doNotFilter) {
      delete params.status;
    }

    if (listMode) {
      if (params.framework === allSheriffedFrameworksID) {
        params.show_sheriffed_frameworks = true;
      }
      if ([doNotFilter, allSheriffedFrameworksID].includes(params.framework)) {
        delete params.framework;
      }
    }

    return params;
  };

  selectNotSupportedFilters = (userInput) => {
    /* Following filters are not supported (see bug 1616215 for more details):
     * - `option`, because of technical dept, as described in bug 1616212
     * - `repository`, because it has never been enabled & the new dropdown items could falsely hint it is.
     */
    const { projects } = this.props;
    const { optionCollectionMap } = this.state;
    const userInputArray = userInput.split(' ');

    const repositories = projects.map(({ name }) => name);
    const optionsCollection = Object.values(optionCollectionMap || {});

    const allNotSupportedFilters = [...repositories, ...optionsCollection];
    return allNotSupportedFilters.filter((elem) =>
      userInputArray.includes(elem),
    );
  };

  async fetchAlertSummaries(
    id = this.state.id,
    update = false,
    page = this.state.page,
  ) {
    // turn off loading when update is true (used to update alert statuses)
    this.setState({ loading: !update, errorMessages: [] });
    const { user } = this.props;
    const {
      filters,
      errorMessages,
      issueTrackers,
      optionCollectionMap,
      alertSummaries,
      count,
    } = this.state;
    const {
      status,
      framework,
      filterText,
      hideDownstream,
      hideAssignedToOthers,
      monitoredAlerts,
    } = filters;

    this.setState({ page });
    let updates = { loading: false };
    const params = this.composeParams(id, page, framework, status);

    if (this.isListMode()) {
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
    if (!issueTrackers.length && !optionCollectionMap) {
      const [optionCollectionMap, issueTrackers] = await Promise.all([
        OptionCollectionModel.getMap(),
        getData(getApiUrl(endpoints.issueTrackers)),
      ]);

      updates = {
        ...updates,
        ...{ optionCollectionMap },
        ...processResponse(issueTrackers, 'issueTrackers', errorMessages),
      };
    }
    const data = await getData(url);
    const response = processResponse(data, 'alertSummaries', errorMessages);

    if (response.alertSummaries) {
      const summary = response.alertSummaries;

      // used with the id argument to update one specific alert summary in the array of
      // alert summaries that's been updated based on an action taken in the AlertActionPanel
      if (update && summary.results.length !== 0) {
        const index = alertSummaries.findIndex(
          (item) => item.id === summary.results[0].id,
        );

        alertSummaries.splice(index, 1, summary.results[0]);
      }
      updates = {
        ...updates,
        ...{
          alertSummaries: update ? alertSummaries : summary.results,
          count: update ? count : Math.ceil(summary.count / 10),
        },
      };
    } else {
      updates = { ...updates, ...response };
    }

    this.setState(updates);
  }

  render() {
    const { user } = this.props;
    const {
      filters,
      errorMessages,
      loading,
      alertSummaries,
      frameworkOptions,
      issueTrackers,
      notSupportedAlertFilters,
      optionCollectionMap,
      bugTemplate,
      page,
      count,
    } = this.state;

    // this is not strictly accurate since we have no way of knowing the final count
    // until the results are filtered (and we're only retrieving 10 results at a time)
    const pageNums = this.getCurrentPages();

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
            isListMode={this.isListMode()}
            filters={filters}
            pageNums={pageNums}
            alertSummaries={alertSummaries}
            frameworkOptions={frameworkOptions}
            issueTrackers={issueTrackers}
            optionCollectionMap={optionCollectionMap}
            fetchAlertSummaries={(id, update = true, page) =>
              this.fetchAlertSummaries(id, update, page)
            }
            updateViewState={(state) => this.setState(state)}
            setFiltersState={this.setFiltersState}
            bugTemplate={bugTemplate}
            user={user}
            page={page}
            count={count}
            {...this.props}
          />
          {!loading && alertSummaries.length === 0 && (
            <p className="lead text-center">No alerts to show</p>
          )}
        </Container>
      </ErrorBoundary>
    );
  }
}

AlertsView.propTypes = {
  location: PropTypes.shape({}),
  user: PropTypes.shape({}).isRequired,
  validated: PropTypes.shape({
    updateParams: PropTypes.func.isRequired,
    framework: PropTypes.string,
  }).isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  performanceTags: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

AlertsView.defaultProps = {
  location: null,
};

export default withValidation(
  { requiredParams: new Set([]) },
  false,
)(AlertsView);
