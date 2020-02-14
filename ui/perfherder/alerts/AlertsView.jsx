/* eslint-disable react/no-did-update-set-state */
import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Container } from 'reactstrap';
import cloneDeep from 'lodash/cloneDeep';

import withValidation from '../Validation';
import { convertParams, getFrameworkData, getStatus } from '../helpers';
import { summaryStatusMap, endpoints } from '../constants';
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
    const { frameworks } = this.props;
    this.validated = this.props.validated;

    const extendedOptions = this.extendDropdownOptions(frameworks);
    this.state = {
      status: this.getDefaultStatus(),
      framework: getFrameworkData({
        validated: this.props.validated,
        frameworks: extendedOptions,
      }),
      frameworkOptions: extendedOptions,
      page: this.validated.page ? parseInt(this.validated.page, 10) : 1,
      errorMessages: [],
      alertSummaries: [],
      issueTrackers: [],
      loading: false,
      optionCollectionMap: null,
      count: 0,
      id: this.validated.id,
      bugTemplate: null,
      totalPages: 0,
    };
  }

  componentDidMount() {
    this.fetchAlertSummaries();
  }

  componentDidUpdate(prevProps, prevState) {
    const { count } = this.state;
    const { validated } = this.props;

    if (prevState.count !== count) {
      this.setState({ totalPages: this.generatePages(count) });
    }

    const params = parseQueryParams(this.props.location.search);
    // we're using local state for id instead of validated.id because once
    // the user navigates from the id=<alert> view back to the main alerts view
    // the Validation component won't reset the id (since the query param doesn't exist
    // unless there is a value)
    if (this.props.location.search !== prevProps.location.search) {
      this.setState({ id: params.id || null }, this.fetchAlertSummaries);
      validated.updateParams({ hideDwnToInv: 0 });
    }
  }

  extendDropdownOptions = frameworks => {
    const frameworkOptions = cloneDeep(frameworks);
    const ignoreFrameworks = { id: -1, name: 'all' };
    frameworkOptions.unshift(ignoreFrameworks);
    return frameworkOptions;
  };

  getDefaultStatus = () => {
    const { validated } = this.props;

    const statusParam = convertParams(validated, 'status');
    if (!statusParam) {
      return Object.keys(summaryStatusMap)[1];
    }
    return getStatus(parseInt(validated.status, 10));
  };

  updateFramework = selection => {
    const { updateParams } = this.props.validated;
    const { frameworkOptions } = this.state;
    const framework = frameworkOptions.find(item => item.name === selection);
    updateParams({ framework: framework.id });
    this.setState({ framework, bugTemplate: null }, () =>
      this.fetchAlertSummaries(),
    );
  };

  updateStatus = status => {
    const statusId = summaryStatusMap[status];
    this.props.validated.updateParams({ status: statusId });
    this.setState({ status }, () => this.fetchAlertSummaries());
  };

  getCurrentPages = () => {
    const { page, totalPages } = this.state;
    if (totalPages.length === 5 || !totalPages.length) {
      return totalPages;
    }
    return totalPages.slice(page - 1, page + 4);
  };

  generatePages = count => {
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
    const listMode = !id;

    if (listMode && params.status === doNotFilter) {
      delete params.status;
    }
    if (listMode && params.framework === doNotFilter) {
      delete params.framework;
    }

    return params;
  };

  async fetchAlertSummaries(id = this.state.id, update = false, page = 1) {
    // turn off loading when update is true (used to update alert statuses)
    this.setState({ loading: !update, errorMessages: [] });

    const {
      framework,
      status,
      errorMessages,
      issueTrackers,
      optionCollectionMap,
      alertSummaries,
      count,
    } = this.state;
    this.setState({ page });
    let updates = { loading: false };
    const params = this.composeParams(id, page, framework, status);

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
      if (update) {
        const index = alertSummaries.findIndex(
          item => item.id === summary.results[0].id,
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
      framework,
      frameworkOptions,
      status,
      errorMessages,
      loading,
      alertSummaries,
      issueTrackers,
      optionCollectionMap,
      bugTemplate,
      id,
      page,
      count,
    } = this.state;

    const frameworkNames =
      frameworkOptions && frameworkOptions.length
        ? frameworkOptions.map(item => item.name)
        : [];

    const alertDropdowns = [
      {
        options: Object.keys(summaryStatusMap),
        selectedItem: status,
        updateData: this.updateStatus,
        namespace: 'status',
      },
      {
        options: frameworkNames,
        selectedItem: framework.name,
        updateData: this.updateFramework,
        namespace: 'framework',
      },
    ];
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
            <Alert color="info">
              You must be logged into perfherder/treeherder and be a sheriff to
              make changes
            </Alert>
          )}
          <AlertsViewControls
            dropdownOptions={id ? [] : alertDropdowns}
            pageNums={pageNums}
            alertSummaries={alertSummaries}
            issueTrackers={issueTrackers}
            optionCollectionMap={optionCollectionMap}
            fetchAlertSummaries={(id, update, page) =>
              this.fetchAlertSummaries(id, update, page)
            }
            updateViewState={state => this.setState(state)}
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
};

AlertsView.defaultProps = {
  location: null,
};

export default withValidation(
  { requiredParams: new Set([]) },
  false,
)(AlertsView);
