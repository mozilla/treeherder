import React from 'react';
import PropTypes from 'prop-types';
import {
  Col,
  Row,
  Container,
  UncontrolledDropdown,
  DropdownToggle,
} from 'reactstrap';
import difference from 'lodash/difference';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

import ErrorMessages from '../../shared/ErrorMessages';
import {
  genericErrorMessage,
  errorMessageClass,
  compareDefaultTimeRange,
  phTimeRanges,
} from '../../helpers/constants';
import ErrorBoundary from '../../shared/ErrorBoundary';
import { getData } from '../../helpers/http';
import { getCounterMap } from '../helpers';
import { createApiUrl, perfSummaryEndpoint } from '../../helpers/url';
import { noiseMetricTitle } from '../constants';
import DropdownMenuItems from '../../shared/DropdownMenuItems';

import RevisionInformation from './RevisionInformation';
import CompareTableControls from './CompareTableControls';
import CompareTable from './CompareTable';
import NoiseTable from './NoiseTable';
import ResultsAlert from './ResultsAlert';

// TODO remove $stateParams and $state after switching to react router
export default class CompareTableView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      compareResults: new Map(),
      testsNoResults: null,
      testsWithNoise: [],
      failureMessage: '',
      loading: false,
      testList: [],
      platformList: [],
      timeRange: this.setTimeRange(),
      filteredResults: new Map(),
      filterOn: false,
    };
  }

  componentDidMount() {
    this.getPerformanceData();
  }

  // TODO updating seems a bit slow
  componentDidUpdate(prevProps) {
    if (this.props !== prevProps) {
      this.getPerformanceData();
    }
  }

  setTimeRange = () => {
    const { selectedTimeRange, originalRevision } = this.props.validated;

    if (originalRevision) {
      return null;
    }
    const timeRange = phTimeRanges.find(
      timeRange => timeRange.value === parseInt(selectedTimeRange, 10),
    );

    return timeRange || compareDefaultTimeRange;
  };

  createNoiseMetric = (
    compareResults,
    oldStddevVariance,
    newStddevVariance,
  ) => {
    const { platformList } = this.state;

    platformList.forEach(platform => {
      const cmap = getCounterMap(
        noiseMetricTitle,
        oldStddevVariance[platform],
        newStddevVariance[platform],
      );
      if (cmap.isEmpty) {
        return;
      }

      cmap.name = platform;
      cmap.isNoiseMetric = true;

      if (compareResults.has(noiseMetricTitle)) {
        compareResults.get(noiseMetricTitle).push(cmap);
      } else {
        compareResults.set(noiseMetricTitle, [cmap]);
      }
    });
    return compareResults;
  };

  getPerformanceData = async () => {
    this.setState({ loading: true });

    const [originalParams, newParams] = this.props.getQueryParams(
      this.state.timeRange,
    );

    const [originalResults, newResults] = await Promise.all([
      getData(createApiUrl(perfSummaryEndpoint, originalParams)),
      getData(createApiUrl(perfSummaryEndpoint, newParams)),
    ]);

    if (originalResults.failureStatus) {
      return this.setState({
        failureMessage: originalResults.data,
      });
    }

    if (newResults.failureStatus) {
      return this.setState({
        failureMessage: newResults.data,
      });
    }

    const data = [...originalResults.data, ...newResults.data];

    const platformList = [...new Set(data.map(item => item.platform))].sort();
    const testList = [...new Set(data.map(item => item.name))].sort();

    return this.setState({ platformList, testList }, () =>
      this.getDisplayResults(originalResults.data, newResults.data),
    );
  };

  getDisplayResults = (origResultsMap, newResultsMap) => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
    } = this.props.validated;

    const { testList, platformList, timeRange } = this.state;
    const { framework, checkForResults } = this.props;

    let compareResults = new Map();
    const titleText = originalRevision
      ? `${originalRevision} (${originalProject})`
      : originalProject;
    window.document.title = `Comparison between ${titleText} and ${newRevision} (${newProject})`;

    const oldStddevVariance = {};
    const newStddevVariance = {};
    const testsWithNoise = [];

    testList.forEach(testName => {
      platformList.forEach(platform => {
        if (!oldStddevVariance[platform]) {
          oldStddevVariance[platform] = {
            values: [],
            lower_is_better: true,
            frameworkID: framework.id,
          };
        }
        if (!newStddevVariance[platform]) {
          newStddevVariance[platform] = {
            values: [],
            frameworkID: framework.id,
          };
        }

        const oldResults = origResultsMap.find(
          sig => sig.name === testName && sig.platform === platform,
        );
        const newResults = newResultsMap.find(
          sig => sig.name === testName && sig.platform === platform,
        );
        const cmap = getCounterMap(testName, oldResults, newResults);
        if (cmap.isEmpty) {
          return;
        }

        if (
          cmap.originalStddevPct !== undefined &&
          cmap.newStddevPct !== undefined
        ) {
          if (cmap.originalStddevPct < 50.0 && cmap.newStddevPct < 50.0) {
            oldStddevVariance[platform].values.push(
              Math.round(cmap.originalStddevPct * 100) / 100,
            );
            newStddevVariance[platform].values.push(
              Math.round(cmap.newStddevPct * 100) / 100,
            );
          } else {
            testsWithNoise.push({
              platform,
              testname: testName,
              baseStddev: cmap.originalStddevPct,
              newStddev: cmap.newStddevPct,
            });
          }
        }
        cmap.links = this.props.createLinks(oldResults, newResults, timeRange);

        cmap.name = platform;
        if (compareResults.has(testName)) {
          compareResults.get(testName).push(cmap);
        } else {
          compareResults.set(testName, [cmap]);
        }
      });
    });

    compareResults = this.createNoiseMetric(
      compareResults,
      oldStddevVariance,
      newStddevVariance,
    );

    compareResults = new Map([...compareResults.entries()].sort());
    const updates = { compareResults, testsWithNoise, loading: false };

    if (checkForResults) {
      const resultsArr = Array.from(compareResults.keys());
      const testsNoResults = difference(testList, resultsArr)
        .sort()
        .join();

      if (testsNoResults.length) {
        updates.testsNoResults = testsNoResults;
      }
    }

    this.setState(updates);
  };

  updateTimeRange = time => {
    const { updateParams } = this.props.validated;

    const timeRange = phTimeRanges.find(item => item.text === time);

    updateParams({ selectedTimeRange: timeRange.value });
    this.setState({ timeRange }, () => this.getPerformanceData());
  };

  render() {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      originalResultSet,
      newResultSet,
    } = this.props.validated;

    const { filterByFramework, checkForResults } = this.props;
    const {
      compareResults,
      loading,
      failureMessage,
      testsWithNoise,
      timeRange,
      testsNoResults,
      filteredResults,
      filterOn,
    } = this.state;

    const timeRangeOptions = phTimeRanges.map(option => option.text);
    return (
      <Container fluid className="max-width-default">
        {loading && !failureMessage && (
          <div className="loading">
            <FontAwesomeIcon icon={faCog} size="4x" spin />
          </div>
        )}
        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={genericErrorMessage}
        >
          <div className="mx-auto">
            <Row className="justify-content-center">
              <Col sm="8" className="text-center">
                {failureMessage && (
                  <ErrorMessages failureMessage={failureMessage} />
                )}
              </Col>
            </Row>
            {newRevision && newProject && (
              <Row>
                <Col sm="12" className="text-center pb-1">
                  <h1>Perfherder Compare Revisions</h1>
                  <RevisionInformation
                    originalProject={originalProject}
                    originalRevision={originalRevision}
                    originalResultSet={originalResultSet}
                    newProject={newProject}
                    newRevision={newRevision}
                    newResultSet={newResultSet}
                    selectedTimeRange={timeRange}
                  />
                </Col>
              </Row>
            )}

            {checkForResults && testsNoResults && (
              <ResultsAlert testsNoResults={testsNoResults} />
            )}

            <CompareTableControls
              {...this.props}
              filterByFramework={filterByFramework}
              updateState={state => this.setState(state)}
              compareResults={compareResults}
              dateRangeOptions={
                !originalRevision && (
                  <Col sm="auto" className="p-2">
                    <UncontrolledDropdown className="mr-0 text-nowrap">
                      <DropdownToggle caret>{timeRange.text}</DropdownToggle>
                      <DropdownMenuItems
                        options={timeRangeOptions}
                        selectedItem={timeRange.text}
                        updateData={this.updateTimeRange}
                      />
                    </UncontrolledDropdown>
                  </Col>
                )
              }
              showTestsWithNoise={
                testsWithNoise.length > 0 && (
                  <Row>
                    <Col sm="12" className="text-center">
                      <NoiseTable testsWithNoise={testsWithNoise} />
                    </Col>
                  </Row>
                )
              }
            />

            {(filterOn && filteredResults.size > 0) ||
            (!filterOn && compareResults.size > 0) ? (
              Array.from(
                filteredResults.size > 0 ? filteredResults : compareResults,
              ).map(([testName, data]) => (
                <CompareTable key={testName} data={data} testName={testName} />
              ))
            ) : (
              <p className="lead text-center">No results to show</p>
            )}
          </div>
        </ErrorBoundary>
      </Container>
    );
  }
}

CompareTableView.propTypes = {
  validated: PropTypes.shape({
    originalResultSet: PropTypes.shape({}),
    newResultSet: PropTypes.shape({}),
    newRevision: PropTypes.string,
    originalProject: PropTypes.string,
    newProject: PropTypes.string,
    originalRevision: PropTypes.string,
    projects: PropTypes.arrayOf(PropTypes.shape({})),
    frameworks: PropTypes.arrayOf(PropTypes.shape({})),
    selectedTimeRange: PropTypes.string,
    updateParams: PropTypes.func.isRequired,
  }),
  dateRangeOptions: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  filterByFramework: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  createLinks: PropTypes.func.isRequired,
  getQueryParams: PropTypes.func.isRequired,
  framework: PropTypes.shape({}).isRequired,
  checkForResults: PropTypes.bool,
  $stateParams: PropTypes.shape({}).isRequired,
  $state: PropTypes.shape({}).isRequired,
};

CompareTableView.defaultProps = {
  dateRangeOptions: null,
  filterByFramework: null,
  validated: PropTypes.shape({}),
  checkForResults: false,
};
