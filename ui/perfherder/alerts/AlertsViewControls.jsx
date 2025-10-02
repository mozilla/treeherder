import React from 'react';
import PropTypes from 'prop-types';
import { Button, Container } from 'react-bootstrap';

import FilterControls from '../../shared/FilterControls';
import { summaryStatusMap, scrollTypes } from '../perf-helpers/constants';
import PaginationGroup from '../shared/Pagination';
import { sortData } from '../perf-helpers/sort';

import AlertTable from './AlertTable';

export default class AlertsViewControls extends React.Component {
  constructor(props) {
    super(props);
    this.alertsRef = new Array(this.props.alertSummaries.length)
      .fill(null)
      .map(() => React.createRef());
    this.state = {
      disableHideDownstream: ['invalid', 'reassigned', 'downstream'].includes(
        props.filters.status,
      ),
      currentAlert: -1,
      alertsLength: this.props.alertSummaries.length,
      disableButtons: {
        prev: true,
        next: false,
      },
    };
  }

  componentDidUpdate(prevProps) {
    const { alertSummaries } = this.props;
    const alertsLength = alertSummaries.length;

    if (alertSummaries !== prevProps.alertSummaries) {
      this.alertsRef = new Array(alertsLength)
        .fill(null)
        .map(() => React.createRef());

      this.setState({
        currentAlert: -1,
        alertsLength,
        disableButtons: {
          prev: true,
          next: false,
        },
      });
    }
  }

  updateFilterText = (filterText) => {
    this.props.setFiltersState({ filterText });
  };

  updateFilter = (filter) => {
    const { setFiltersState, filters, updateViewState } = this.props;
    const prevValue = filters[filter];
    setFiltersState({ [filter]: !prevValue });
    updateViewState({ page: 1 });
  };

  updateStatus = (status) => {
    const { setFiltersState, updateViewState } = this.props;

    const isInvalidStatus = [
      'invalid',
      'reassigned',
      'downstream',
      'all statuses',
    ].includes(status);

    this.setState({
      disableHideDownstream:
        status === 'all statuses' ? false : isInvalidStatus,
    });
    setFiltersState({ status, hideDownstream: !isInvalidStatus });
    updateViewState({ page: 1 });
  };

  updateFramework = (selectedFramework) => {
    const { frameworkOptions, updateViewState, setFiltersState } = this.props;
    const framework = frameworkOptions.find(
      (item) => item.name === selectedFramework,
    );
    updateViewState({ page: 1 });
    setFiltersState({ framework }, this.fetchAlertSummaries);
  };

  updateCurrentAlert = async (currentAlert) => {
    const { disableButtons, alertsLength } = this.state;
    disableButtons.next = currentAlert === alertsLength - 1;
    disableButtons.prev = currentAlert === 0;

    this.setState({ currentAlert, disableButtons }, () => {
      this.alertsRef[currentAlert].current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  onScrollAlert = (type) => {
    const { alertsLength } = this.state;
    let { currentAlert } = this.state;

    if (type === scrollTypes.next && currentAlert !== alertsLength - 1) {
      currentAlert += 1;
    }

    if (type === scrollTypes.prev && currentAlert !== 0) {
      currentAlert -= 1;
    }

    this.updateCurrentAlert(currentAlert);
  };

  render() {
    const { disableButtons } = this.state;
    const {
      alertSummaries,
      fetchAlertSummaries,
      pageNums,
      validated,
      page,
      count,
      isListMode,
      user,
      frameworkOptions,
      filters,
    } = this.props;
    const {
      filterText,
      hideDownstream,
      hideAssignedToOthers,
      framework,
      status,
    } = filters;

    let sortedFrameworks = sortData(frameworkOptions, 'name', false);
    const allFrameworks = 'all frameworks';
    const allSheriffedFrameworks = 'all sheriffed frameworks';
    const platformMicrobench = 'platform_microbench';
    const telemetry = 'telemetry';

    sortedFrameworks = sortedFrameworks.filter(
      (framework) =>
        framework.name !== platformMicrobench &&
        framework.name !== telemetry &&
        framework.name !== allFrameworks &&
        framework.name !== allSheriffedFrameworks,
    );

    const frameworkNames =
      sortedFrameworks && sortedFrameworks.length
        ? sortedFrameworks.map((item) => item.name)
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
        pinned: [allFrameworks, allSheriffedFrameworks],
        otherPinned: [platformMicrobench, telemetry],
      },
    ];

    const alertCheckboxes = [
      {
        text: 'Hide downstream / reassigned to / invalid',
        state: hideDownstream,
        stateName: 'hideDownstream',
        disable: this.state.disableHideDownstream,
      },
    ];

    if (user.isLoggedIn && isListMode) {
      alertCheckboxes.push({
        text: 'My alerts',
        state: hideAssignedToOthers,
        stateName: 'hideAssignedToOthers',
        disable: false,
      });
    }

    const hasMorePages = () => pageNums.length > 0 && count !== 1;

    return (
      <React.Fragment>
        {alertSummaries.length > 1 && (
          <Container className="sticky-scroll-nav-top max-width-default position-fixed mb-4 p-0 pr-4">
            <Container className="bg-white max-width-default p-0 pt-5 pb-1">
              <div className="d-flex justify-content-end mb-1 mr-2">
                <Button
                  className="mr-2"
                  variant="info"
                  onClick={() => this.onScrollAlert(scrollTypes.prev)}
                  disabled={disableButtons.prev}
                  data-testid="scroll-prev-alert"
                >
                  Previous alert
                </Button>
                <Button
                  variant="info"
                  onClick={() => this.onScrollAlert(scrollTypes.next)}
                  disabled={disableButtons.next}
                  data-testid="scroll-next-alert"
                >
                  Next alert
                </Button>
              </div>
            </Container>
          </Container>
        )}
        <FilterControls
          filteredTextValue={filterText}
          dropdownOptions={isListMode ? alertDropdowns : []}
          filterOptions={alertCheckboxes}
          updateFilter={this.updateFilter}
          updateFilterText={this.updateFilterText}
          updateOnEnter={isListMode}
          dropdownCol
        />
        {pageNums
          ? hasMorePages() && (
              <div className="d-flex justify-content-center">
                <PaginationGroup
                  viewablePageNums={pageNums}
                  updateParams={validated.updateParams}
                  currentPage={page}
                  count={count}
                />
              </div>
            )
          : null}
        {alertSummaries.length > 0 &&
          alertSummaries.map((alertSummary, index) => (
            <div key={alertSummary.id} ref={this.alertsRef[index]}>
              <AlertTable
                filters={{
                  filterText,
                  hideDownstream,
                  hideAssignedToOthers,
                }}
                alertSummary={alertSummary}
                fetchAlertSummaries={fetchAlertSummaries}
                user={user}
                {...this.props}
              />
            </div>
          ))}
        {pageNums
          ? hasMorePages() && (
              <div className="d-flex justify-content-center">
                <PaginationGroup
                  viewablePageNums={pageNums}
                  updateParams={validated.updateParams}
                  currentPage={page}
                  count={count}
                />
              </div>
            )
          : null}
      </React.Fragment>
    );
  }
}

AlertsViewControls.propTypes = {
  validated: PropTypes.shape({
    updateParams: PropTypes.func,
  }).isRequired,
  isListMode: PropTypes.bool.isRequired,
  filters: PropTypes.shape({
    filterText: PropTypes.string.isRequired,
    hideDownstream: PropTypes.bool.isRequired,
    hideAssignedToOthers: PropTypes.bool.isRequired,
    framework: PropTypes.shape({}).isRequired,
    status: PropTypes.string.isRequired,
  }).isRequired,
  setFiltersState: PropTypes.func.isRequired,
  fetchAlertSummaries: PropTypes.func.isRequired,
  page: PropTypes.number,
  count: PropTypes.number,
  alertSummaries: PropTypes.arrayOf(PropTypes.shape({})),
  frameworkOptions: PropTypes.arrayOf(PropTypes.shape({})),
  user: PropTypes.shape({}).isRequired,
  performanceTags: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

AlertsViewControls.defaultProps = {
  alertSummaries: [],
  frameworkOptions: [],
  page: 1,
  count: 1,
};
