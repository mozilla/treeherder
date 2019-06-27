import React from 'react';
import PropTypes from 'prop-types';
import { Container } from 'reactstrap';

import { filterText } from '../constants';
import { convertParams, containsText } from '../helpers';
import FilterControls from '../FilterControls';

import CompareTable from './CompareTable';

export default class CompareTableControls extends React.Component {
  constructor(props) {
    super(props);
    const { validated } = this.props;
    this.validated = validated;
    this.state = {
      hideUncomparable: convertParams(this.validated, 'showOnlyComparable'),
      showImportant: convertParams(this.validated, 'showOnlyImportant'),
      hideUncertain: convertParams(this.validated, 'showOnlyConfident'),
      showNoise: convertParams(this.validated, 'showOnlyNoise'),
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

  updateFilterText = filterText => {
    this.setState({ filterText }, () => this.updateFilteredResults());
  };

  updateFilter = filter => {
    this.setState(
      prevState => ({ [filter]: !prevState[filter] }),
      () => this.updateFilteredResults(),
    );
  };

  filterResult = (testName, result) => {
    const {
      filterText,
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

    if (!filterText) return matchesFilters;

    const textToSearch = `${testName} ${result.name}`;

    // searching with filter input and one or more metricFilter buttons on
    // will produce different results compared to when all filters are off
    return containsText(textToSearch, filterText) && matchesFilters;
  };

  updateFilteredResults = () => {
    const {
      filterText,
      hideUncomparable,
      showImportant,
      hideUncertain,
      showNoise,
    } = this.state;

    const { compareResults } = this.props;

    if (
      !filterText &&
      !hideUncomparable &&
      !showImportant &&
      !hideUncertain &&
      !showNoise
    ) {
      return this.setState({ results: compareResults });
    }

    const filteredResults = new Map(compareResults);

    for (const [testName, values] of filteredResults) {
      const filteredValues = values.filter(result =>
        this.filterResult(testName, result),
      );

      if (filteredValues.length) {
        filteredResults.set(testName, filteredValues);
      } else {
        filteredResults.delete(testName);
      }
    }
    this.setState({ results: filteredResults });
  };

  render() {
    const { showTestsWithNoise, dropdownOptions } = this.props;
    const {
      hideUncomparable,
      hideUncertain,
      showImportant,
      showNoise,
      results,
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
    return (
      <Container fluid className="my-3 px-0">
        <FilterControls
          filterOptions={compareFilters}
          updateFilter={this.updateFilter}
          updateFilterText={this.updateFilterText}
          dropdownOptions={dropdownOptions}
        />

        {showNoise && showTestsWithNoise}

        {results.size > 0 ? (
          Array.from(results).map(([testName, data]) => (
            <CompareTable key={testName} data={data} testName={testName} />
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
  dropdownOptions: PropTypes.arrayOf(PropTypes.shape({})),
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
};

CompareTableControls.defaultProps = {
  dropdownOptions: [],
  validated: {
    showOnlyImportant: undefined,
    showOnlyComparable: undefined,
    showOnlyConfident: undefined,
    showOnlyNoise: undefined,
  },
  showTestsWithNoise: null,
};
