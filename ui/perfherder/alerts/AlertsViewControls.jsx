import React from 'react';
import PropTypes from 'prop-types';
import { Row } from 'reactstrap';

import FilterControls from '../FilterControls';
import { summaryStatusMap } from '../constants';

import AlertTable from './AlertTable';
import PaginationGroup from './Pagination';

export default class AlertsViewControls extends React.Component {
  updateFilterText = filterText => {
    this.props.setFiltersState({ filterText });
  };

  updateFilter = filter => {
    const { setFiltersState, filters } = this.props;
    const prevValue = filters[filter];
    setFiltersState({ [filter]: !prevValue });
  };

  updateStatus = status => {
    const { setFiltersState } = this.props;
    setFiltersState({ status });
  };

  updateFramework = selectedFramework => {
    const { frameworkOptions, updateViewState, setFiltersState } = this.props;
    const framework = frameworkOptions.find(
      item => item.name === selectedFramework,
    );
    updateViewState({ bugTemplate: null });
    setFiltersState({ framework }, this.fetchAlertSummaries);
  };

  render() {
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
      hideImprovements,
      hideDownstream,
      hideAssignedToOthers,
      framework,
      status,
    } = filters;

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

    const alertCheckboxes = [
      {
        text: 'Hide improvements',
        state: hideImprovements,
        stateName: 'hideImprovements',
      },
      {
        text: 'Hide downstream / reassigned to / invalid',
        state: hideDownstream,
        stateName: 'hideDownstream',
      },
    ];

    if (user.isLoggedIn && isListMode) {
      alertCheckboxes.push({
        text: 'My alerts',
        state: hideAssignedToOthers,
        stateName: 'hideAssignedToOthers',
      });
    }

    const hasMorePages = pageNums.length > 0 && count !== 1;

    return (
      <React.Fragment>
        <FilterControls
          dropdownOptions={isListMode ? alertDropdowns : []}
          filterOptions={alertCheckboxes}
          updateFilter={this.updateFilter}
          updateFilterText={this.updateFilterText}
          updateOnEnter={isListMode}
          dropdownCol
        />
        {pageNums
          ? hasMorePages && (
              <Row className="justify-content-center">
                <PaginationGroup
                  pageNums={pageNums}
                  updateParams={validated.updateParams}
                  page={page}
                  count={count}
                  fetchData={fetchAlertSummaries}
                />
              </Row>
            )
          : null}
        {alertSummaries.length > 0 &&
          alertSummaries.map(alertSummary => (
            <AlertTable
              filters={{
                filterText,
                hideImprovements,
                hideDownstream,
                hideAssignedToOthers,
              }}
              key={alertSummary.id}
              alertSummary={alertSummary}
              fetchAlertSummaries={fetchAlertSummaries}
              user={user}
              {...this.props}
            />
          ))}
        {pageNums
          ? hasMorePages && (
              <Row className="justify-content-center">
                <PaginationGroup
                  pageNums={pageNums}
                  updateParams={validated.updateParams}
                  page={page}
                  count={count}
                  fetchData={fetchAlertSummaries}
                />
              </Row>
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
    hideImprovements: PropTypes.bool.isRequired,
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
};

AlertsViewControls.defaultProps = {
  alertSummaries: [],
  frameworkOptions: [],
  page: 1,
  count: 1,
};
