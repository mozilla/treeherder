import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import { Container, Col, Row } from 'reactstrap';

import { getData, processResponse, processErrors } from '../../helpers/http';
import {
  getApiUrl,
  repoEndpoint,
  createApiUrl,
  perfSummaryEndpoint,
  createQueryParams,
} from '../../helpers/url';
import {
  phTimeRanges,
  phDefaultTimeRangeValue,
  genericErrorMessage,
  errorMessageClass,
} from '../../helpers/constants';
import perf from '../../js/perf';
import { endpoints } from '../constants';
import ErrorMessages from '../../shared/ErrorMessages';
import ErrorBoundary from '../../shared/ErrorBoundary';
import LoadingSpinner from '../../shared/LoadingSpinner';

import GraphsContainer from './GraphsContainer';
import TestDataModal from './TestDataModal';
import LegendCard from './LegendCard';
import GraphsViewControls from './GraphsViewControls';

const dataColors = [
  ['magenta', '#e252cf'],
  ['blue', '#1752b8'],
  ['darkorchid', '#9932cc'],
  ['brown', '#b87e17'],
  ['green', '#19a572'],
  ['turquoise', '#17a2b8'],
  ['scarlet', '#b81752'],
];

class GraphsView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      timeRange: this.getDefaultTimeRange(),
      frameworks: [],
      projects: [],
      zoom: {},
      selectedDataPoint: null,
      highlightAlerts: true,
      highlightedRevisions: ['', ''],
      showModal: false,
      testData: [],
      errorMessages: [],
      options: {},
      colors: [...dataColors],
      loading: false,
    };
  }

  // TODO
  // selecting highlight alerts button resets zoom due to how that functionality
  // is updating params itself and $stateParams props won't pick up on the change

  async componentDidMount() {
    this.getData();
    this.checkQueryParams();
  }

  // TODO should add a custom time range option based on query param
  getDefaultTimeRange = () => {
    const { $stateParams } = this.props;

    const defaultValue = $stateParams.timerange
      ? parseInt($stateParams.timerange, 10)
      : phDefaultTimeRangeValue;
    return phTimeRanges.find(time => time.value === defaultValue);
  };

  async getData() {
    const [projects, frameworks] = await Promise.all([
      getData(getApiUrl(repoEndpoint)),
      getData(getApiUrl(endpoints.frameworks)),
    ]);

    const updates = {
      ...processResponse(projects, 'projects'),
      ...processResponse(frameworks, 'frameworks'),
    };
    this.setState(updates);
  }

  checkQueryParams = () => {
    const {
      series,
      zoom,
      selected,
      highlightAlerts,
      highlightedRevisions,
    } = this.props.$stateParams;

    const updates = {};

    if (series) {
      const _series = typeof series === 'string' ? [series] : series;
      const seriesParams = this.parseSeriesParam(_series);
      this.getTestData(seriesParams);
    }

    if (highlightAlerts) {
      updates.highlightAlerts = Boolean(parseInt(highlightAlerts, 10));
    }

    if (highlightedRevisions) {
      updates.highlightedRevisions =
        typeof highlightedRevisions === 'string'
          ? [highlightedRevisions]
          : highlightedRevisions;
    }

    if (zoom) {
      const zoomArray = zoom.replace(/[[{}\]"]+/g, '').split(',');
      const zoomObject = {
        x: zoomArray.slice(0, 2),
        y: zoomArray.slice(2, 4),
      };
      updates.zoom = zoomObject;
    }

    if (selected) {
      const tooltipArray = selected.replace(/[[]"]/g, '').split(',');
      // TODO keys should reflect perf/sumary/ data
      const tooltipValues = {
        projectName: tooltipArray[0],
        signatureId: parseInt(tooltipArray[1], 10),
        resultSetId: parseInt(tooltipArray[2], 10),
        id: parseInt(tooltipArray[3], 10),
        frameworkId: parseInt(tooltipArray[4], 10) || 1,
      };
      updates.selectedDataPoint = tooltipValues;
    }

    this.setState(updates);
  };

  createSeriesParams = series => {
    const { repository_name, signature_id, framework_id } = series;
    const { timeRange } = this.state;

    return {
      repository: repository_name,
      signature: signature_id,
      framework: framework_id,
      interval: timeRange.value,
      all_data: true,
    };
  };

  getTestData = async (newDisplayedTests = []) => {
    const { testData } = this.state;
    const tests = newDisplayedTests.length ? newDisplayedTests : testData;
    this.setState({ loading: true });

    const responses = await Promise.all(
      tests.map(series =>
        getData(
          createApiUrl(perfSummaryEndpoint, this.createSeriesParams(series)),
        ),
      ),
    );
    const errorMessages = processErrors(responses);

    if (errorMessages.length) {
      this.setState({ errorMessages, loading: false });
    } else {
      // If the server returns an empty array instead of signature data with data: [],
      // that test won't be shown in the graph or legend; this will prevent the UI from breaking
      const data = responses
        .filter(response => response.data.length)
        .map(reponse => reponse.data[0]);
      let newTestData = await this.createGraphObject(data);

      if (newDisplayedTests.length) {
        newTestData = [...testData, ...newTestData];
      }

      this.setState(
        { testData: newTestData, loading: false },
        this.changeParams,
      );
    }
  };

  createGraphObject = async seriesData => {
    const { colors } = this.state;

    const newColors = [...colors];
    const alertSummaries = await Promise.all(
      seriesData.map(series =>
        this.getAlertSummaries(series.signature_id, series.repository_id),
      ),
    );

    for (const series of seriesData) {
      series.relatedAlertSummaries = alertSummaries.find(
        item => item.id === series.id,
      );
      series.color = newColors.pop();
      series.visible = true;
      series.flotSeries = {
        lines: { show: false },
        points: { show: true },
        color: series.color[1],
        label: `${series.repository_name} ${series.name}`,
        data: series.data.map(dataPoint => [
          new Date(dataPoint.push_timestamp),
          dataPoint.value,
        ]),
        resultSetData: series.data.map(dataPoint => dataPoint.push_id),
        thSeries: { ...series },
        jobIdData: series.data.map(dataPoint => dataPoint.job_id),
        idData: series.data.map(dataPoint => dataPoint.id),
      };
    }
    this.setState({ colors: newColors });
    return seriesData;
  };

  // TODO possibly move to helpers file
  getAlertSummaries = async (signatureId, repository) => {
    const { errorMessages } = this.state;

    const url = getApiUrl(
      `${endpoints.alertSummary}${createQueryParams({
        alerts__series_signature: signatureId,
        repository,
      })}`,
    );

    const data = await getData(url);
    const response = processResponse(data, 'alertSummaries', errorMessages);

    if (response.alertSummaries) {
      return response.alertSummaries.results;
    }
    this.setState({ errorMessages: response.errorMessages });
    return [];
  };

  parseSeriesParam = series =>
    series.map(encodedSeries => {
      const partialSeriesString = decodeURIComponent(encodedSeries).replace(
        /[[\]"]/g,
        '',
      );
      const partialSeriesArray = partialSeriesString.split(',');
      const partialSeriesObject = {
        repository_name: partialSeriesArray[0],
        // TODO deprecate signature_hash
        signature_id:
          partialSeriesArray[1].length === 40
            ? partialSeriesArray[1]
            : parseInt(partialSeriesArray[1], 10),
        framework_id: parseInt(partialSeriesArray[2], 10),
      };
      return partialSeriesObject;
    });

  toggle = state => {
    this.setState(prevState => ({
      [state]: !prevState[state],
    }));
  };

  updateParams = param => {
    const { transitionTo, current } = this.props.$state;

    transitionTo(current.name, param, {
      inherit: true,
      notify: false,
    });
  };

  changeParams = () => {
    const {
      testData,
      selectedDataPoint,
      zoom,
      highlightAlerts,
      highlightedRevisions,
      timeRange,
    } = this.state;
    const { updateGraphs } = this.props;

    // TODO rename certain fields that are returned in PerfSeriesModel so they are consistent with performance/summary fields?
    const newSeries = testData.map(
      series =>
        `${series.repository_name},${series.signature_id},${series.framework_id}`,
    );
    const params = {
      series: newSeries,
      highlightedRevisions: highlightedRevisions.filter(rev => rev.length),
      highlightAlerts: +highlightAlerts,
      timerange: timeRange.value,
    };

    if (!selectedDataPoint) {
      params.selected = null;
    }

    if (Object.keys(zoom).length === 0) {
      params.zoom = null;
    }

    this.updateParams(params);
    updateGraphs(this.state);
  };

  render() {
    const {
      timeRange,
      projects,
      frameworks,
      showModal,
      testData,
      options,
      highlightAlerts,
      highlightedRevisions,
      selectedDataPoint,
      colors,
      loading,
      errorMessages,
    } = this.state;

    return (
      <ErrorBoundary
        errorClasses={errorMessageClass}
        message={genericErrorMessage}
      >
        <Container fluid className="pt-5 max-width-default">
          {loading && <LoadingSpinner />}

          {errorMessages.length > 0 && (
            <Container className="pb-4 px-0 max-width-default">
              <ErrorMessages errorMessages={errorMessages} />
            </Container>
          )}

          {projects.length > 0 && frameworks.length > 0 && (
            <TestDataModal
              showModal={showModal}
              frameworks={frameworks}
              projects={projects}
              timeRange={timeRange.value}
              options={options}
              getTestData={this.getTestData}
              toggle={() => this.toggle('showModal')}
              testData={testData}
            />
          )}
          <Row>
            <Col id="graph-chooser">
              <Container className="graph-legend pl-0 pb-4">
                {testData.length > 0 &&
                  testData.map(series => (
                    <div
                      key={`${series.name} ${series.repository_name} ${series.platform}`}
                    >
                      <LegendCard
                        series={series}
                        testData={testData}
                        {...this.props}
                        updateState={state => this.setState(state)}
                        updateStateParams={state =>
                          this.setState(state, this.changeParams)
                        }
                        colors={colors}
                        selectedDataPoint={selectedDataPoint}
                      />
                    </div>
                  ))}
              </Container>
            </Col>
            <Col className="pl-0">
              <GraphsViewControls
                timeRange={timeRange}
                graphs={
                  <GraphsContainer timeRange={timeRange} {...this.props} />
                }
                updateState={state => this.setState(state)}
                updateStateParams={state =>
                  this.setState(state, this.changeParams)
                }
                highlightAlerts={highlightAlerts}
                highlightedRevisions={highlightedRevisions}
                updateTimeRange={timeRange =>
                  this.setState(
                    {
                      timeRange,
                      zoom: {},
                      selectedDataPoint: null,
                      colors: [...dataColors],
                    },
                    this.getTestData,
                  )
                }
                hasNoData={!testData.length && !loading}
              />
            </Col>
          </Row>
        </Container>
      </ErrorBoundary>
    );
  }
}

GraphsView.propTypes = {
  $stateParams: PropTypes.shape({
    zoom: PropTypes.string,
    selected: PropTypes.string,
    highlightAlerts: PropTypes.string,
    highlightedRevisions: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]),
    series: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]),
  }),
  $state: PropTypes.shape({
    current: PropTypes.shape({}),
    transitionTo: PropTypes.func,
  }),
  updateGraphs: PropTypes.func.isRequired,
};

GraphsView.defaultProps = {
  $stateParams: undefined,
  $state: undefined,
};

perf.component(
  'graphsView',
  react2angular(GraphsView, ['updateGraphs'], ['$stateParams', '$state']),
);

export default GraphsView;
