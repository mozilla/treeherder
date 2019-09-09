import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import {
  Alert,
  Container,
  Row,
  Pagination,
  PaginationItem,
  PaginationLink,
} from 'reactstrap';

import perf from '../../js/perf';
import withValidation from '../Validation';
import { convertParams, getFrameworkData, getStatus } from '../helpers';
import { summaryStatusMap, endpoints } from '../constants';
import { createQueryParams, getApiUrl } from '../../helpers/url';
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

// TODO remove $stateParams and $state after switching to react router
export class AlertsView extends React.Component {
  constructor(props) {
    super(props);
    this.validated = this.props.validated;
    this.state = {
      status: this.getDefaultStatus(),
      framework: getFrameworkData(this.validated),
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
    if (prevState.count !== count) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ totalPages: this.generatePages(count) });
    }
  }

  getDefaultStatus = () => {
    const { validated } = this.props;
    const statusParam = convertParams(validated, 'status');
    if (!statusParam) {
      return Object.keys(summaryStatusMap)[1];
    }
    return getStatus(parseInt(validated.status, 10));
  };

  updateFramework = selection => {
    const { frameworks, updateParams } = this.props.validated;
    const framework = frameworks.find(item => item.name === selection);

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

  navigatePage = page => {
    this.setState({ page }, this.fetchAlertSummaries);
    this.props.validated.updateParams({ page });
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

  // TODO potentially pass as a prop for testing purposes
  async fetchAlertSummaries(id = this.state.id, update = false) {
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
      page,
    } = this.state;

    let updates = { loading: false };
    let params;

    if (id) {
      params = { id };
    } else {
      params = {
        framework: framework.id,
        page,
      };
    }

    if (!id && summaryStatusMap[status] !== -1) {
      // -1 ('all') is created for UI purposes but is not a valid API parameter
      params.status = summaryStatusMap[status];
    }

    const url = getApiUrl(
      `${endpoints.alertSummary}${createQueryParams(params)}`,
    );

    // TODO OptionCollectionModel to use getData wrapper
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
    const { user, validated } = this.props;
    const {
      framework,
      status,
      errorMessages,
      loading,
      alertSummaries,
      issueTrackers,
      optionCollectionMap,
      page,
      count,
      bugTemplate,
      id,
    } = this.state;
    const { frameworks } = validated;

    const frameworkNames =
      frameworks && frameworks.length ? frameworks.map(item => item.name) : [];

    const alertDropdowns = [
      {
        options: Object.keys(summaryStatusMap),
        selectedItem: status,
        updateData: this.updateStatus,
      },
      {
        options: frameworkNames,
        selectedItem: framework.name,
        updateData: this.updateFramework,
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
            validated={validated}
            dropdownOptions={id ? [] : alertDropdowns}
            alertSummaries={alertSummaries}
            issueTrackers={issueTrackers}
            optionCollectionMap={optionCollectionMap}
            fetchAlertSummaries={id => this.fetchAlertSummaries(id, true)}
            updateViewState={state => this.setState(state)}
            bugTemplate={bugTemplate}
            user={user}
          />
          {pageNums.length > 0 && (
            <Row className="justify-content-center pb-5">
              {/* The first and last pagination navigation links
              aren't working correctly (icons aren't visible)
              so they haven't been added */}
              <Pagination aria-label={`Page ${page}`}>
                {page > 1 && (
                  <PaginationItem>
                    <PaginationLink
                      className="text-info"
                      previous
                      onClick={() => this.navigatePage(page - 1)}
                    />
                  </PaginationItem>
                )}
                {pageNums.map(num => (
                  <PaginationItem
                    key={num}
                    active={num === page}
                    className="text-info pagination-active"
                  >
                    <PaginationLink
                      className="text-info"
                      onClick={() => this.navigatePage(num)}
                    >
                      {num}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                {page < count && (
                  <PaginationItem>
                    <PaginationLink
                      className="text-info"
                      next
                      onClick={() => this.navigatePage(page + 1)}
                    />
                  </PaginationItem>
                )}
              </Pagination>
            </Row>
          )}
          {!loading && alertSummaries.length === 0 && (
            <p className="lead text-center">No alerts to show</p>
          )}
        </Container>
      </ErrorBoundary>
    );
  }
}

AlertsView.propTypes = {
  $stateParams: PropTypes.shape({}),
  $state: PropTypes.shape({
    go: PropTypes.func,
  }),
  user: PropTypes.shape({}).isRequired,
  validated: PropTypes.shape({
    projects: PropTypes.arrayOf(PropTypes.shape({})),
    frameworks: PropTypes.arrayOf(PropTypes.shape({})),
    updateParams: PropTypes.func.isRequired,
    framework: PropTypes.string,
  }).isRequired,
};

AlertsView.defaultProps = {
  $stateParams: null,
  $state: null,
};

const alertsView = withValidation(new Set([]), false)(AlertsView);

perf.component(
  'alertsView',
  react2angular(alertsView, ['user'], ['$stateParams', '$state']),
);

export default alertsView;
