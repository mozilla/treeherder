import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import { Container, Col, Row } from 'reactstrap';
import unionBy from 'lodash/unionBy';

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
import { processSelectedParam } from '../helpers';
import { endpoints, graphColors } from '../constants';
import ErrorMessages from '../../shared/ErrorMessages';
import ErrorBoundary from '../../shared/ErrorBoundary';
import LoadingSpinner from '../../shared/LoadingSpinner';

import GraphsContainer from './GraphsContainer';
import LegendCard from './LegendCard';
import GraphsViewControls from './GraphsViewControls';

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
      testData: [],
      errorMessages: [],
      options: {},
      loading: false,
      colors: [...graphColors],
      showModal: false,
    };
  }

  async componentDidMount() {
    this.getData();
    this.checkQueryParams();
  }

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
      this.getTestData(seriesParams, true);
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
        x: zoomArray.map(x => new Date(parseInt(x, 10))).slice(0, 2),
        y: zoomArray.slice(2, 4),
      };
      updates.zoom = zoomObject;
    }

    if (selected) {
      const tooltipArray = selected.replace(/[[]"]/g, '').split(',');
      const tooltipValues = processSelectedParam(tooltipArray);
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

  getTestData = async (newDisplayedTests = [], init = false) => {
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

      this.setState({ testData: newTestData, loading: false }, () => {
        if (!init) {
          // we don't need to change params when getData is called on initial page load
          this.changeParams();
        }
      });
    }
  };

  createGraphObject = async seriesData => {
    const { colors } = this.state;
    let alertSummaries = await Promise.all(
      seriesData.map(series =>
        this.getAlertSummaries(series.signature_id, series.repository_id),
      ),
    );
    alertSummaries = alertSummaries.flat();

    let relatedAlertSummaries;
    let color;
    const newColors = [...colors];

    const graphData = seriesData.map(series => {
      relatedAlertSummaries = alertSummaries.find(
        item => item.id === series.id,
      );
      color = newColors.pop();
      // signature_id, framework_id and repository_name are
      // not renamed in camel case in order to match the fields
      // returned by the performance/summary API (since we only fetch
      // new data if a user adds additional tests to the graph)
      return {
        color: color || ['border-secondary', ''],
        relatedAlertSummaries,
        visible: Boolean(color),
        name: series.name,
        signature_id: series.signature_id,
        signatureHash: series.signature_hash,
        framework_id: series.framework_id,
        platform: series.platform,
        repository_name: series.repository_name,
        projectId: series.repository_id,
        id: `${series.repository_name} ${series.name}`,
        data: series.data.map(dataPoint => ({
          x: new Date(dataPoint.push_timestamp),
          y: dataPoint.value,
          z: color ? color[1] : '',
          revision: dataPoint.revision,
          alertSummary: alertSummaries.find(
            item => item.revision === dataPoint.revision,
          ),
          signature_id: series.signature_id,
          pushId: dataPoint.push_id,
          jobId: dataPoint.job_id,
        })),
        lowerIsBetter: series.lower_is_better,
        resultSetData: series.data.map(dataPoint => dataPoint.push_id),
      };
    });
    this.setState({ colors: newColors });
    return graphData;
  };

  getAlertSummaries = async (signature_id, repository) => {
    const { errorMessages } = this.state;

    const url = getApiUrl(
      `${endpoints.alertSummary}${createQueryParams({
        alerts__series_signature: signature_id,
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

  updateData = async (
    signature_id,
    repository_name,
    alertSummaryId,
    dataPointIndex,
  ) => {
    const { testData } = this.state;

    const updatedData = testData.find(
      test => test.signature_id === signature_id,
    );
    const alertSummaries = await this.getAlertSummaries(
      signature_id,
      repository_name,
    );
    const alertSummary = alertSummaries.find(
      result => result.id === alertSummaryId,
    );
    updatedData.data[dataPointIndex].alertSummary = alertSummary;
    const newTestData = unionBy([updatedData], testData, 'signature_id');

    this.setState({ testData: newTestData });
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
          partialSeriesArray[1] && partialSeriesArray[1].length === 40
            ? partialSeriesArray[1]
            : parseInt(partialSeriesArray[1], 10),
        // TODO partialSeriesArray[2] is for the 1 that's inserted in the url
        // for visibility of test legend cards but isn't actually being used
        // to control visibility so it should be removed at some point
        framework_id: parseInt(partialSeriesArray[3], 10),
      };

      return partialSeriesObject;
    });

  toggle = state => {
    this.setState(prevState => ({
      [state]: !prevState[state],
    }));
  };

  updateParams = params => {
    const { transitionTo, current } = this.props.$state;

    transitionTo('graphs', params, {
      location: true,
      inherit: true,
      relative: current,
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

    const newSeries = testData.map(
      series =>
        `${series.repository_name},${series.signature_id},1,${series.framework_id}`,
    );
    const params = {
      series: newSeries,
      highlightedRevisions: highlightedRevisions.filter(rev => rev.length),
      highlightAlerts: +highlightAlerts,
      timerange: timeRange.value,
      zoom,
    };

    if (!selectedDataPoint) {
      params.selected = null;
    } else {
      const { signature_id, pushId, x, y } = selectedDataPoint;
      params.selected = [signature_id, pushId, x, y].join(',');
    }

    if (Object.keys(zoom).length === 0) {
      params.zoom = null;
    } else {
      params.zoom = [...zoom.x.map(z => z.getTime()), ...zoom.y].toString();
    }

    this.updateParams(params);
  };

  render() {
    const {
      timeRange,
      projects,
      frameworks,
      testData,
      highlightAlerts,
      highlightedRevisions,
      selectedDataPoint,
      loading,
      errorMessages,
      zoom,
      options,
      colors,
      showModal,
    } = this.state;

    return (
      <ErrorBoundary
        errorClasses={errorMessageClass}
        message={genericErrorMessage}
      >
        <Container fluid className="pt-5">
          {loading && <LoadingSpinner />}

          {errorMessages.length > 0 && (
            <Container className="pb-4 px-0 max-width-default">
              <ErrorMessages errorMessages={errorMessages} />
            </Container>
          )}

          <Row>
            <Col className="graph-chooser">
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
                frameworks={frameworks}
                projects={projects}
                options={options}
                getTestData={this.getTestData}
                testData={testData}
                showModal={showModal}
                toggle={() => this.setState({ showModal: !showModal })}
                graphs={
                  testData.length > 0 && (
                    <GraphsContainer
                      timeRange={timeRange}
                      highlightAlerts={highlightAlerts}
                      highlightedRevisions={highlightedRevisions}
                      zoom={zoom}
                      selectedDataPoint={selectedDataPoint}
                      testData={testData}
                      updateStateParams={state =>
                        this.setState(state, this.changeParams)
                      }
                      user={this.props.user}
                      updateData={this.updateData}
                      projects={projects}
                    />
                  )
                }
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
                      colors: [...graphColors],
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
  user: PropTypes.shape({}).isRequired,
};

GraphsView.defaultProps = {
  $stateParams: undefined,
  $state: undefined,
};

perf.component(
  'graphsView',
  react2angular(GraphsView, ['user'], ['$stateParams', '$state']),
);

export default GraphsView;
