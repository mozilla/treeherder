import React from 'react';
import PropTypes from 'prop-types';
import { Container, Form } from 'react-bootstrap';

import FilterControls from '../shared/FilterControls';

import { filterText } from './constants';
import { convertParams, containsText } from './helpers';
import InfraCompareTable from './InfraCompareTable';

export default class CompareTableControls extends React.Component {
  constructor(props) {
    super(props);
    const {
      validated = { showOnlyImportant: undefined, hideUncertain: undefined },
    } = props;
    this.validated = validated;
    this.state = {
      showImportant: convertParams(this.validated, 'showOnlyImportant'),
      hideUncertain: convertParams(this.validated, 'showOnlyImportant'),
      results: new Map(),
      filterPercent: 5,
      filterText: '',
    };
  }

  componentDidMount() {
    this.updateFilteredResults();
  }

  componentDidUpdate(prevProps) {
    const { compareResults } = this.props;
    if (prevProps.compareResults !== compareResults) {
      this.updateFilteredResults();
    }
  }

  updateFilterText = (filterText) => {
    this.setState({ filterText }, () => this.updateFilteredResults());
  };

  updateFilter = (filter) => {
    this.setState(
      (prevState) => ({ [filter]: !prevState[filter] }),
      () => this.updateFilteredResults(),
    );
  };

  filterResult = (platformName, result, filterPercent) => {
    const { filterText, showImportant, hideUncertain } = this.state;
    const matchesFilters =
      (!showImportant || result.deltaPercentage > filterPercent) &&
      (!hideUncertain || result.isCertain);

    if (!filterText) return matchesFilters;

    const textToSearch = `${platformName} ${result.suite}`;

    // searching with filter input and one or more metricFilter buttons on
    // will produce different results compared to when all filters are off
    return containsText(textToSearch, filterText) && matchesFilters;
  };

  updateFilteredResults = (filterPercent = this.state.filterPercent) => {
    const { filterText, showImportant, hideUncertain } = this.state;
    const { compareResults } = this.props;
    if (
      filterPercent === 0 &&
      !filterText &&
      !showImportant &&
      !hideUncertain
    ) {
      return this.setState({ results: compareResults });
    }
    const filteredResults = new Map(compareResults);

    for (const [platformName, values] of filteredResults) {
      const filteredValues = values.filter((result) =>
        this.filterResult(platformName, result, filterPercent),
      );

      if (filteredValues.length) {
        filteredResults.set(platformName, filteredValues);
      } else {
        filteredResults.delete(platformName);
      }
    }
    this.setState({ results: filteredResults });
  };

  render() {
    const { hideUncertain, showImportant, results, filterPercent } = this.state;
    const compareFilters = [
      {
        tooltipText: `Non-trivial changes (${filterPercent}%+)`,
        text: filterText.showImportant,
        state: showImportant,
        stateName: 'showImportant',
      },
      {
        tooltipText: 'Less than 4 datapoints',
        text: filterText.hideUncertain,
        state: hideUncertain,
        stateName: 'hideUncertain',
      },
    ];

    return (
      <Container fluid className="my-3 px-0">
        <FilterControls
          dropdownOptions={[]}
          filterOptions={compareFilters}
          updateFilter={this.updateFilter}
          updateFilterText={this.updateFilterText}
        />
        <Form.Label htmlFor="filterPercent">
          Filter percentage: {filterPercent}%
        </Form.Label>
        <Form.Range
          id="filterPercent"
          min={0}
          max={20}
          value={filterPercent}
          onChange={(e) => {
            this.setState({
              filterPercent: e.target.value,
            });
            this.updateFilteredResults(e.target.value);
          }}
        />

        {results.size > 0 ? (
          Array.from(results).map(([platform, data]) => (
            <InfraCompareTable
              key={platform}
              platform={platform}
              data={data}
              {...this.props}
            />
          ))
        ) : (
          <p className="lead text-center">No results to show</p>
        )}
      </Container>
    );
  }
}

CompareTableControls.propTypes = {
  compareResults: PropTypes.shape({}).isRequired,
  validated: PropTypes.shape({
    showOnlyImportant: PropTypes.string,
    hideUncertain: PropTypes.string,
  }),
};
