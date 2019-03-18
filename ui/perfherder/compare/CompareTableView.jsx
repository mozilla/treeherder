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
import { getCounterMap, getGraphsLink } from '../helpers';
import {
  createApiUrl,
  perfSummaryEndpoint,
  createQueryParams,
} from '../../helpers/url';
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
      tableNames: [],
      rowNames: [],
      timeRange: this.setTimeRange(),
      framework: this.getFrameworkData(),
      filteredResults: new Map(),
      filterOn: false,
      title: '',
    };
  }

  componentDidMount() {
    this.getPerformanceData();
  }

  componentDidUpdate(prevProps) {
    if (this.props !== prevProps) {
      this.getPerformanceData();
    }
  }

  getFrameworkData = () => {
    const { framework, frameworks } = this.props.validated;

    if (framework) {
      const frameworkObject = frameworks.find(
        item => item.id === parseInt(framework, 10),
      );
      // framework is validated in the withValidation component so
      // we know this object will always exist
      return frameworkObject;
    }
    return { id: 1, name: 'talos' };
  };

  setTimeRange = () => {
    const { selectedTimeRange, originalRevision } = this.props.validated;

    if (originalRevision) {
      return null;
    }

    let timeRange;
    if (selectedTimeRange) {
      timeRange = phTimeRanges.find(
        timeRange => timeRange.value === parseInt(selectedTimeRange, 10),
      );
    }

    return timeRange || compareDefaultTimeRange;
  };

  createNoiseMetric = (
    compareResults,
    oldStddevVariance,
    newStddevVariance,
  ) => {
    const { rowNames } = this.state;

    rowNames.forEach(value => {
      const cmap = getCounterMap(
        noiseMetricTitle,
        oldStddevVariance[value],
        newStddevVariance[value],
      );
      if (cmap.isEmpty) {
        return;
      }

      cmap.name = value;
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
    const { getQueryParams, hasSubtests } = this.props;
    const { framework, timeRange } = this.state;

    this.setState({ loading: true });

    const [originalParams, newParams] = getQueryParams(timeRange, framework);

    const [originalResults, newResults] = await Promise.all([
      getData(createApiUrl(perfSummaryEndpoint, originalParams)),
      getData(createApiUrl(perfSummaryEndpoint, newParams)),
    ]);

    if (originalResults.failureStatus) {
      return this.setState({
        failureMessage: originalResults.data,
        loading: false,
      });
    }

    if (newResults.failureStatus) {
      return this.setState({
        failureMessage: newResults.data,
        loading: false,
      });
    }

    const data = [...originalResults.data, ...newResults.data];
    let rowNames;
    let tableNames;
    let title;

    if (!data.length) {
      return this.setState({ loading: false });
    }

    if (hasSubtests) {
      let subtestName = data[0].name.split(' ');
      subtestName.splice(1, 1);
      subtestName = subtestName.join(' ');

      title = `${data[0].platform}: ${subtestName}`;
      tableNames = [subtestName];
      rowNames = [...new Set(data.map(item => item.test))].sort();
    } else {
      tableNames = [...new Set(data.map(item => item.name))].sort();
      rowNames = [...new Set(data.map(item => item.platform))].sort();
    }

    return this.setState({ tableNames, rowNames, title }, () =>
      this.getDisplayResults(originalResults.data, newResults.data),
    );
  };

  getDisplayResults = (origResultsMap, newResultsMap) => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      originalSignature,
      newSignature,
    } = this.props.validated;

    const { rowNames, tableNames, framework } = this.state;
    const { checkForResults, hasSubtests } = this.props;

    let compareResults = new Map();
    const text = originalRevision
      ? `${originalRevision} (${originalProject})`
      : originalProject;
    window.document.title =
      tableNames[0] ||
      `Comparison between ${text} and ${newRevision} (${newProject})`;

    const oldStddevVariance = {};
    const newStddevVariance = {};
    const testsWithNoise = [];

    tableNames.forEach(testName => {
      rowNames.forEach(value => {
        if (!oldStddevVariance[value]) {
          oldStddevVariance[value] = {
            values: [],
            lower_is_better: true,
            frameworkID: framework.id,
          };
        }
        if (!newStddevVariance[value]) {
          newStddevVariance[value] = {
            values: [],
            frameworkID: framework.id,
          };
        }

        let oldResults;
        let newResults;

        if (hasSubtests) {
          oldResults = origResultsMap.find(sig => sig.test === value);
          newResults = newResultsMap.find(sig => sig.test === value);
        } else {
          oldResults = origResultsMap.find(
            sig => sig.name === testName && sig.platform === value,
          );
          newResults = newResultsMap.find(
            sig => sig.name === testName && sig.platform === value,
          );
        }
        const cmap = getCounterMap(testName, oldResults, newResults);
        if (cmap.isEmpty) {
          return;
        }
        cmap.name = value;

        if (
          (oldResults && oldResults.parent_signature === originalSignature) ||
          (oldResults && oldResults.parent_signature === newSignature) ||
          newResults.parent_signature === originalSignature ||
          newResults.parent_signature === newSignature
        ) {
          cmap.highlightedTest = true;
        }

        if (
          cmap.originalStddevPct !== undefined &&
          cmap.newStddevPct !== undefined
        ) {
          if (cmap.originalStddevPct < 50.0 && cmap.newStddevPct < 50.0) {
            oldStddevVariance[value].values.push(
              Math.round(cmap.originalStddevPct * 100) / 100,
            );
            newStddevVariance[value].values.push(
              Math.round(cmap.newStddevPct * 100) / 100,
            );
          } else {
            const noise = {
              baseStddev: cmap.originalStddevPct,
              newStddev: cmap.newStddevPct,
            };
            if (hasSubtests) {
              noise.testname = value;
            } else {
              noise.platform = value;
              noise.testname = testName;
            }
            testsWithNoise.push(noise);
          }
        }
        cmap.links = this.createLinks(oldResults, newResults);

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
      // subtests
      // const resultsArr = Array.from(compareResults.values())[0].map(value => value.name);
      // const testsNoResults = difference(rowNames, resultsArr)

      const resultsArr = Array.from(compareResults.keys());
      const testsNoResults = difference(tableNames, resultsArr)
        .sort()
        .join();

      if (testsNoResults.length) {
        updates.testsNoResults = testsNoResults;
      }
    }

    this.setState(updates);
  };

  updateFramework = selection => {
    const { frameworks, updateParams } = this.props.validated;
    const framework = frameworks.find(item => item.name === selection);

    updateParams({ framework: framework.id });
    this.setState({ framework }, () => this.getPerformanceData());
  };

  updateTimeRange = selection => {
    const { updateParams } = this.props.validated;
    const timeRange = phTimeRanges.find(item => item.text === selection);

    updateParams({ selectedTimeRange: timeRange.value });
    this.setState({ timeRange }, () => this.getPerformanceData());
  };

  createLinks = (oldResults, newResults) => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newResultSet,
      originalResultSet,
    } = this.props.validated;

    const { framework, timeRange } = this.state;
    const { getCustomLink } = this.props;
    let links = [];

    if (getCustomLink) {
      links = getCustomLink(
        links,
        oldResults,
        newResults,
        timeRange,
        framework,
      );
    }

    const graphsParams = [...new Set([originalProject, newProject])].map(
      projectName => ({
        projectName,
        signature: !oldResults
          ? newResults.signature_hash
          : oldResults.signature_hash,
        frameworkId: framework.id,
      }),
    );

    let graphsLink;
    if (originalRevision) {
      graphsLink = getGraphsLink(graphsParams, [
        originalResultSet,
        newResultSet,
      ]);
    } else {
      graphsLink = getGraphsLink(graphsParams, [newResultSet], timeRange.value);
    }

    links.push({
      title: 'graph',
      href: graphsLink,
    });

    return links;
  };

  render() {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      originalResultSet,
      newResultSet,
      frameworks,
    } = this.props.validated;

    const { filterByFramework, checkForResults, hasSubtests } = this.props;
    const {
      compareResults,
      loading,
      failureMessage,
      testsWithNoise,
      timeRange,
      testsNoResults,
      filteredResults,
      filterOn,
      title,
      framework,
    } = this.state;

    const timeRangeOptions = phTimeRanges.map(option => option.text);
    const frameworkNames =
      frameworks && frameworks.length ? frameworks.map(item => item.name) : [];

    const params = { originalProject, newProject, newRevision };

    if (originalRevision) {
      params.originalRevision = originalRevision;
    } else if (timeRange) {
      params.selectedTimeRange = timeRange.value;
    }

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
          <React.Fragment>
            {hasSubtests && (
              <p>
                <a href={`perf.html#/compare${createQueryParams(params)}`}>
                  Show all tests and platforms
                </a>
              </p>
            )}

            <div className="mx-auto">
              <Row className="justify-content-center">
                <Col sm="8" className="text-center">
                  {failureMessage && (
                    <ErrorMessages failureMessage={failureMessage} />
                  )}
                </Col>
              </Row>
              {newRevision && newProject && (originalRevision || timeRange) && (
                <Row>
                  <Col sm="12" className="text-center pb-1">
                    <h1>
                      {hasSubtests
                        ? `${title} subtest summary`
                        : 'Perfherder Compare Revisions'}
                    </h1>
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
                frameworkOptions={
                  filterByFramework && (
                    <Col sm="auto" className="py-0 pl-0 pr-3">
                      <UncontrolledDropdown className="mr-0 text-nowrap">
                        <DropdownToggle caret>{framework.name}</DropdownToggle>
                        {frameworkNames && (
                          <DropdownMenuItems
                            options={frameworkNames}
                            selectedItem={framework.name}
                            updateData={this.updateFramework}
                          />
                        )}
                      </UncontrolledDropdown>
                    </Col>
                  )
                }
                updateState={state => this.setState(state)}
                compareResults={compareResults}
                dateRangeOptions={
                  !originalRevision && (
                    <Col sm="auto" className="p-0">
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
                        <NoiseTable
                          testsWithNoise={testsWithNoise}
                          hasSubtests={hasSubtests}
                        />
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
                  <CompareTable
                    key={testName}
                    data={data}
                    testName={testName}
                  />
                ))
              ) : (
                <p className="lead text-center">No results to show</p>
              )}
            </div>
          </React.Fragment>
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
    originalSignature: PropTypes.string,
    newSignature: PropTypes.string,
    framework: PropTypes.string,
  }),
  dateRangeOptions: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  filterByFramework: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]),
  getCustomLink: PropTypes.func,
  getQueryParams: PropTypes.func.isRequired,
  checkForResults: PropTypes.bool,
  hasSubtests: PropTypes.bool,
  $stateParams: PropTypes.shape({}).isRequired,
  $state: PropTypes.shape({}).isRequired,
};

CompareTableView.defaultProps = {
  dateRangeOptions: null,
  filterByFramework: null,
  validated: PropTypes.shape({}),
  checkForResults: false,
  hasSubtests: false,
  getCustomLink: null,
};
