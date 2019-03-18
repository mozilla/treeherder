import React from 'react';
import PropTypes from 'prop-types';
import { Col, Row, Container, Button } from 'reactstrap';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { filterText } from '../constants';

import InputFilter from './InputFilter';

export default class CompareTableControls extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hideUncomparable: this.convertParams('showOnlyComparable'),
      showImportant: this.convertParams('showOnlyImportant'),
      hideUncertain: this.convertParams('showOnlyConfident'),
      showNoise: this.convertParams('showOnlyNoise'),
      filterText: '',
    };
  }

  convertParams = value =>
    Boolean(
      this.props.validated[value] !== undefined &&
        parseInt(this.props.validated[value], 10),
    );

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

    const { updateState } = this.props;

    if (
      !filterText &&
      !hideUncomparable &&
      !showImportant &&
      !hideUncertain &&
      !showNoise
    ) {
      return updateState({ filteredResults: new Map(), filterOn: false });
    }

    const filteredResults = new Map(this.props.compareResults);

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

    updateState({ filteredResults, filterOn: true });
  };

  render() {
    const {
      frameworkOptions,
      dateRangeOptions,
      showTestsWithNoise,
    } = this.props;
    const {
      hideUncomparable,
      hideUncertain,
      showImportant,
      showNoise,
    } = this.state;

    return (
      <Container fluid className="my-3 px-0">
        <Row className="p-3 justify-content-left">
          {frameworkOptions}
          {dateRangeOptions}
        </Row>
        <Row className="pb-3 pl-3 justify-content-left">
          <Col className="py-2 pl-0 pr-2 col-3">
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
        {showNoise && showTestsWithNoise}
      </Container>
    );
  }
}

CompareTableControls.propTypes = {
  compareResults: PropTypes.shape({}).isRequired,
  frameworkOptions: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  dateRangeOptions: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
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
  updateState: PropTypes.func.isRequired,
};

CompareTableControls.defaultProps = {
  frameworkOptions: null,
  dateRangeOptions: null,
  validated: {
    showOnlyImportant: undefined,
    showOnlyComparable: undefined,
    showOnlyConfident: undefined,
    showOnlyNoise: undefined,
  },
  showTestsWithNoise: null,
};
