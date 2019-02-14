import React from 'react';
import { react2angular } from 'react2angular/index.es2015';
import PropTypes from 'prop-types';
import { Col, Row, Container, Button } from 'reactstrap';

import perf from '../js/perf';
import SimpleTooltip from '../shared/SimpleTooltip';

import DropdownButton from './DropdownButton';
import InputFilter from './InputFilter';
import CompareTable from './CompareTable';
import { filterText } from './constants';

export default class CompareTableControls extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hideUncomparable: this.convertParams('showOnlyComparable'),
      showImportant: this.convertParams('showOnlyImportant'),
      hideUncertain: this.convertParams('showOnlyConfident'),
      showNoise: this.convertParams('showOnlyNoise'),
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
      // TODO fetching new data based on a framework change is remounting
      // the component and removing any previously set state; might be a side effect
      // of using it with angular
      this.updateFilteredResults();
    }
  }

  // TODO update usage of $stateParams when switched to react-router
  convertParams = value =>
    Boolean(
      this.props.$stateParams[value] !== undefined &&
        parseInt(this.props.$stateParams[value], 10),
    );

  updateFramework = selectedFramework => {
    const { frameworks, updateData } = this.props;
    // TODO this updates the entire framework object in the compare controller;
    // look into removing it
    const framework = frameworks.find(
      framework => framework.name === selectedFramework,
    );
    updateData(framework);
  };

  updateFilterText = filterText => {
    this.setState({ filterText }, () => this.updateFilteredResults());
  };

  updateFilter = filter => {
    // TODO create callback to update queryParams with filter change if not undefined
    this.setState({ [filter]: !this.state[filter] }, () => {
      // TODO noise panel might be best moved into this table (displayed beneath controls)
      if (filter === 'showNoise') {
        this.props.updateNoiseAlert();
      }
      this.updateFilteredResults();
    });
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

    const words = filterText
      .split(' ')
      .map(word => `(?=.*${word})`)
      .join('');
    const regex = RegExp(words, 'gi');
    const text = `${testName} ${result.name}`;

    // searching with filter input and one or more metricFilter buttons on
    // will produce different results compared to when all filters are off
    return regex.test(text) && matchesFilters;
  };

  updateFilteredResults = () => {
    const {
      filterText,
      hideUncomparable,
      showImportant,
      hideUncertain,
      showNoise,
    } = this.state;

    if (
      !filterText &&
      !hideUncomparable &&
      !showImportant &&
      !hideUncertain &&
      !showNoise
    ) {
      return this.setState({ results: this.props.compareResults });
    }

    const newResults = new Map(this.props.compareResults);

    for (const [testName, values] of newResults) {
      const filteredValues = values.filter(result =>
        this.filterResult(testName, result),
      );

      if (filteredValues.length) {
        newResults.set(testName, filteredValues);
      } else {
        newResults.delete(testName);
      }
    }

    this.setState({ results: newResults });
  };

  render() {
    const { filterByFramework, frameworks, titles, filterOptions } = this.props;
    const {
      hideUncomparable,
      hideUncertain,
      showImportant,
      showNoise,
      results,
    } = this.state;

    const frameworkNames =
      frameworks && frameworks.length
        ? frameworks.map(framework => framework.name)
        : null;

    return (
      <Container fluid>
        <Row className="p-3 justify-content-left">
          {filterByFramework && frameworkNames && (
            <Col sm="auto" className="p-2">
              <DropdownButton
                data={frameworkNames}
                defaultText={filterOptions.framework.name}
                updateData={this.updateFramework}
                defaultTextClass="mr-0 text-nowrap"
              />
            </Col>
          )}
          <Col sm="2" className="p-2">
            <InputFilter updateFilterText={this.updateFilterText} />
          </Col>
          <Col sm="auto" className="p-2">
            <SimpleTooltip
              text={
                <Button
                  color="info"
                  outline
                  onClick={() => this.updateFilter('hideUncomparable')}
                  active={hideUncomparable}
                >
                  {filterText.hideUncomparable}
                </Button>
              }
              tooltipText="At least 1 result for old and new revision"
            />
          </Col>
          <Col sm="auto" className="p-2">
            <SimpleTooltip
              text={
                <Button
                  color="info"
                  outline
                  onClick={() => this.updateFilter('showImportant')}
                  active={showImportant}
                >
                  {filterText.showImportant}
                </Button>
              }
              tooltipText="Non-trivial changes (2%+)"
            />
          </Col>
          <Col sm="auto" className="p-2">
            <SimpleTooltip
              text={
                <Button
                  color="info"
                  outline
                  onClick={() => this.updateFilter('hideUncertain')}
                  active={hideUncertain}
                >
                  {filterText.hideUncertain}
                </Button>
              }
              tooltipText="At least 6 datapoints OR 2+ datapoints and a large difference"
            />
          </Col>
          <Col sm="auto" className="p-2">
            <SimpleTooltip
              text={
                <Button
                  color="info"
                  outline
                  onClick={() => this.updateFilter('showNoise')}
                  active={showNoise}
                >
                  {filterText.showNoise}
                </Button>
              }
              tooltipText="Display Noise Metric to compare noisy tests at a platform level"
            />
          </Col>
        </Row>

        {results.size > 0 ? (
          Array.from(results).map(([testName, data]) => (
            <CompareTable
              key={testName}
              data={data}
              testName={testName}
              title={titles}
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
  titles: PropTypes.shape({}),
  compareResults: PropTypes.shape({}).isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})),
  filterOptions: PropTypes.shape({
    framework: PropTypes.oneOfType([
      PropTypes.shape({
        name: PropTypes.string,
      }),
      PropTypes.string,
    ]),
  }).isRequired,
  filterByFramework: PropTypes.number,
  updateData: PropTypes.func,
  updateNoiseAlert: PropTypes.func,
  $stateParams: PropTypes.shape({
    showOnlyImportant: PropTypes.string,
    showOnlyComparable: PropTypes.string,
    showOnlyConfident: PropTypes.string,
    showOnlyNoise: PropTypes.string,
  }),
};

CompareTableControls.defaultProps = {
  filterByFramework: null,
  frameworks: null,
  updateData: null,
  titles: null,
  updateNoiseAlert: null,
  $stateParams: {
    showOnlyImportant: undefined,
    showOnlyComparable: undefined,
    showOnlyConfident: undefined,
    showOnlyNoise: undefined,
  },
};

perf.component(
  'compareTableControls',
  react2angular(
    CompareTableControls,
    [
      'compareResults',
      'titles',
      'frameworks',
      'filterOptions',
      'filterByFramework',
      'updateData',
      'updateNoiseAlert',
    ],
    ['$stateParams'],
  ),
);
