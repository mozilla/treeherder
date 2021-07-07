import React from 'react';
import PropTypes from 'prop-types';
import { Container, Row } from 'reactstrap';

import { filterText } from '../perf-helpers/constants';
import {
  convertParams,
  containsText,
  onPermalinkClick,
  retriggerMultipleJobs,
} from '../perf-helpers/helpers';
import { parseQueryParams } from '../../helpers/url';
import PaginationGroup from '../shared/Pagination';
import FilterControls from '../../shared/FilterControls';

import CompareTable from './CompareTable';
import RetriggerModal from './RetriggerModal';

export default class CompareTableControls extends React.Component {
  constructor(props) {
    super(props);
    this.validated = this.props.validated;
    this.state = {
      hideUncomparable: convertParams(this.validated, 'showOnlyComparable'),
      showImportant: convertParams(this.validated, 'showOnlyImportant'),
      hideUncertain: convertParams(this.validated, 'showOnlyConfident'),
      showNoise: convertParams(this.validated, 'showOnlyNoise'),
      results: new Map(),
      filteredText: this.getDefaultFilterText(this.validated),
      showRetriggerModal: false,
      currentRetriggerRow: {},
      totalPagesList: 0,
      page: this.validated.page ? parseInt(this.validated.page, 10) : 1,
      countPages: 0,
    };
  }

  componentDidMount() {
    this.updateFilteredResults();
  }

  componentDidUpdate(prevProps, prevState) {
    const { compareResults } = this.props;
    const { countPages } = this.state;
    const params = parseQueryParams(this.props.location.search);
    const prevParams = parseQueryParams(prevProps.location.search);

    if (prevState.countPages !== countPages) {
      /* eslint-disable react/no-did-update-set-state */
      this.setState({ totalPagesList: this.generatePages(countPages) });
    }
    if (prevProps.compareResults !== compareResults) {
      this.updateFilteredResults();
    }
    if (params.page && params.page !== prevParams.page) {
      /* eslint-disable react/no-did-update-set-state */
      this.setState({ page: parseInt(params.page, 10) }, () => {
        this.updateFilteredResults();
      });
    }
  }

  getDefaultFilterText = (validated) => {
    const { filter } = validated;
    return filter === undefined || filter === null ? '' : filter;
  };

  getDefaultFilterText = (validated) => {
    const { filter } = validated;
    return filter === undefined || filter === null ? '' : filter;
  };

  updateFilterText = (filterText) => {
    this.setState({ filteredText: filterText, page: 1 }, () =>
      this.updateFilteredResults(),
    );
  };

  updateFilter = (filter) => {
    this.setState(
      (prevState) => ({ [filter]: !prevState[filter], page: 1 }),
      () => this.updateFilteredResults(),
    );
  };

  filterResult = (testName, result) => {
    const {
      filteredText,
      showImportant,
      hideUncertain,
      showNoise,
      hideUncomparable,
    } = this.state;

    const matchesFilters =
      (!showImportant || result.isMeaningful) &&
      (!hideUncomparable || 'newIsBetter' in result) &&
      (!hideUncertain || result.isConfident) &&
      (!showNoise || result.isNoiseMetric);

    if (!filteredText) return matchesFilters;

    const textToSearch = `${testName} ${result.name}`;

    // searching with filter input and one or more metricFilter buttons on
    // will produce different results compared to when all filters are off
    return containsText(textToSearch, filteredText) && matchesFilters;
  };

  updateFilteredResults = () => {
    const {
      filteredText,
      hideUncomparable,
      showImportant,
      hideUncertain,
      showNoise,
      page,
    } = this.state;

    const { compareResults } = this.props;
    let results;
    const toEnd = page * 10;
    const fromStart = toEnd - 10;
    let countPages = Math.ceil(compareResults.size / 10);
    let totalPagesList = this.generatePages(countPages);

    this.updateUrlParams();
    if (
      !filteredText &&
      !hideUncomparable &&
      !showImportant &&
      !hideUncertain &&
      !showNoise
    ) {
      results = Array.from(compareResults).slice(fromStart, toEnd);
      results = new Map(results);
      return this.setState({ results, countPages, totalPagesList });
    }

    const filteredResults = new Map(compareResults);

    for (const [testName, values] of filteredResults) {
      const filteredValues = values.filter((result) =>
        this.filterResult(testName, result),
      );

      if (filteredValues.length) {
        filteredResults.set(testName, filteredValues);
      } else {
        filteredResults.delete(testName);
      }
    }

    countPages = Math.ceil(filteredResults.size / 10);
    totalPagesList = this.generatePages(countPages);
    results = Array.from(filteredResults).slice(fromStart, toEnd);
    results = new Map(results);
    this.setState({ results, countPages, totalPagesList });
  };

  toggleRetriggerModal = () => {
    this.setState((prevState) => ({
      showRetriggerModal: !prevState.showRetriggerModal,
    }));
  };

  updateAndClose = async (event, params) => {
    const { currentRetriggerRow } = this.state;
    const { baseRetriggerTimes, newRetriggerTimes } = params;
    event.preventDefault();

    await retriggerMultipleJobs(
      currentRetriggerRow,
      baseRetriggerTimes,
      newRetriggerTimes,
      this.props,
    );
    this.toggleRetriggerModal();
  };

  updateUrlParams = () => {
    const { updateParams } = this.props.validated;
    const {
      filteredText,
      hideUncomparable,
      showImportant,
      hideUncertain,
      showNoise,
      page,
    } = this.state;
    const compareURLParams = {};
    const paramsToRemove = [];

    if (filteredText !== '') compareURLParams.filter = filteredText;
    else paramsToRemove.push('filter');

    if (hideUncomparable) compareURLParams.showOnlyComparable = 1;
    else paramsToRemove.push('showOnlyComparable');

    if (showImportant) compareURLParams.showOnlyImportant = 1;
    else paramsToRemove.push('showOnlyImportant');

    if (hideUncertain) compareURLParams.showOnlyConfident = 1;
    else paramsToRemove.push('showOnlyConfident');

    if (showNoise) compareURLParams.showOnlyNoise = 1;
    else paramsToRemove.push('showOnlyNoise');

    compareURLParams.page = page;
    updateParams(compareURLParams, paramsToRemove);
  };

  onModalOpen = (rowResults) => {
    this.setState({ currentRetriggerRow: rowResults });
    this.toggleRetriggerModal();
  };

  getCurrentPages = () => {
    const { page, totalPagesList } = this.state;
    if (totalPagesList.length === 5 || !totalPagesList.length) {
      return totalPagesList;
    }
    return totalPagesList.slice(page - 1, page + 4);
  };

  generatePages = (countPages) => {
    const pages = [];
    for (let num = 1; num <= countPages; num++) {
      pages.push(num);
    }
    return pages;
  };

  render() {
    const {
      frameworkName,
      showTestsWithNoise,
      dropdownOptions,
      user,
      isBaseAggregate,
      notify,
      hasSubtests,
      onPermalinkClick,
      projects,
      history,
      validated,
    } = this.props;
    const {
      hideUncomparable,
      hideUncertain,
      showImportant,
      showNoise,
      results,
      showRetriggerModal,
      currentRetriggerRow,
      filteredText,
      countPages,
      page,
    } = this.state;

    const compareFilters = [
      {
        tooltipText: 'At least 1 result for old and new revision',
        text: filterText.hideUncomparable,
        state: hideUncomparable,
        stateName: 'hideUncomparable',
      },
      {
        tooltipText: 'Non-trivial changes (2%+)',
        text: filterText.showImportant,
        state: showImportant,
        stateName: 'showImportant',
      },
      {
        tooltipText:
          'At least 6 datapoints OR 2+ datapoints and a large difference',
        text: filterText.hideUncertain,
        state: hideUncertain,
        stateName: 'hideUncertain',
      },
      {
        tooltipText:
          'Display Noise Metric to compare noisy tests at a platform level',
        text: filterText.showNoise,
        state: showNoise,
        stateName: 'showNoise',
      },
    ];

    const viewablePagesList = this.getCurrentPages();
    const hasMorePages = () => viewablePagesList.length > 0 && countPages !== 1;

    return (
      <Container fluid className="my-3 px-0">
        <RetriggerModal
          showModal={showRetriggerModal}
          toggle={this.toggleRetriggerModal}
          updateAndClose={this.updateAndClose}
          currentRetriggerRow={currentRetriggerRow}
          isBaseAggregate={isBaseAggregate}
        />
        <FilterControls
          filteredTextValue={filteredText}
          filterOptions={compareFilters}
          updateFilter={this.updateFilter}
          updateFilterText={this.updateFilterText}
          dropdownOptions={dropdownOptions}
        />

        {viewablePagesList
          ? hasMorePages() && (
              <Row className="justify-content-center">
                <PaginationGroup
                  viewablePageNums={viewablePagesList}
                  updateParams={validated.updateParams}
                  currentPage={page}
                  count={countPages}
                />
              </Row>
            )
          : null}

        {showNoise && showTestsWithNoise}

        {results.size > 0 ? (
          Array.from(results).map(([testName, data]) => (
            <CompareTable
              key={testName}
              data={data}
              testName={testName}
              frameworkName={frameworkName}
              onPermalinkClick={onPermalinkClick}
              user={user}
              isBaseAggregate={isBaseAggregate}
              notify={notify}
              hasSubtests={hasSubtests}
              projects={projects}
              history={history}
              onModalOpen={this.onModalOpen}
            />
          ))
        ) : (
          <p className="lead text-center">No results to show</p>
        )}

        {viewablePagesList
          ? hasMorePages() && (
              <Row className="justify-content-center">
                <PaginationGroup
                  viewablePageNums={viewablePagesList}
                  updateParams={validated.updateParams}
                  currentPage={page}
                  count={countPages}
                />
              </Row>
            )
          : null}
      </Container>
    );
  }
}

CompareTableControls.propTypes = {
  compareResults: PropTypes.shape({}).isRequired,
  dropdownOptions: PropTypes.arrayOf(PropTypes.shape({})),
  user: PropTypes.shape({}).isRequired,
  isBaseAggregate: PropTypes.bool.isRequired,
  notify: PropTypes.func.isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  hasSubtests: PropTypes.bool,
  validated: PropTypes.shape({
    showOnlyImportant: PropTypes.string,
    showOnlyComparable: PropTypes.string,
    showOnlyConfident: PropTypes.string,
    showOnlyNoise: PropTypes.string,
  }),
  showTestsWithNoise: PropTypes.oneOfType([
    PropTypes.shape({}),
    PropTypes.bool,
  ]),
  onPermalinkClick: PropTypes.func,
};

CompareTableControls.defaultProps = {
  dropdownOptions: [],
  hasSubtests: false,
  validated: {
    showOnlyImportant: undefined,
    showOnlyComparable: undefined,
    showOnlyConfident: undefined,
    showOnlyNoise: undefined,
  },
  showTestsWithNoise: null,
  onPermalinkClick,
};
