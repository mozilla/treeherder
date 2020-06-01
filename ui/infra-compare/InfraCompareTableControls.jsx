import React from 'react';
import PropTypes from 'prop-types';
import { Container } from 'reactstrap';

import FilterControls from '../shared/FilterControls';

import { filterText } from './constants';
import { convertParams, containsText } from './helpers';
import InfraCompareTable from './InfraCompareTable';

export default class CompareTableControls extends React.Component {
  constructor(props) {
    super(props);
    this.validated = this.props.validated;
    this.state = {
      showImportant: convertParams(this.validated, 'showOnlyImportant'),
      hideUncertain: convertParams(this.validated, 'showOnlyImportant'),
      results: new Map(),
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

  filterResult = (platformName, result) => {
    const { filterText, showImportant, hideUncertain } = this.state;
    const matchesFilters =
      (!showImportant || result.isImporatant) &&
      (!hideUncertain || result.isCertain);

    if (!filterText) return matchesFilters;

    const textToSearch = `${platformName} ${result.suite}`;

    // searching with filter input and one or more metricFilter buttons on
    // will produce different results compared to when all filters are off
    return containsText(textToSearch, filterText) && matchesFilters;
  };

  updateFilteredResults = () => {
    const { filterText, showImportant, hideUncertain } = this.state;
    const { compareResults } = this.props;

    if (!filterText && !showImportant && !hideUncertain) {
      return this.setState({ results: compareResults });
    }

    const filteredResults = new Map(compareResults);

    for (const [platformName, values] of filteredResults) {
      const filteredValues = values.filter((result) =>
        this.filterResult(platformName, result),
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
    const { hideUncertain, showImportant, results } = this.state;
    const compareFilters = [
      {
        tooltipText: 'Non-trivial changes (3%+)',
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

        {results.size > 0 ? (
          Array.from(results).map(([platform, data]) => (
            <InfraCompareTable key={platform} data={data} />
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

CompareTableControls.defaultProps = {
  validated: {
    showOnlyImportant: undefined,
    hideUncertain: undefined,
  },
};
