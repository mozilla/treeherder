import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Container, Col, Row } from 'react-bootstrap';
import unionBy from 'lodash/unionBy';
import queryString from 'query-string';

import { getData, processResponse, processErrors } from '../../helpers/http';
import {
  createApiUrl,
  createQueryParams,
  getApiUrl,
  parseQueryParams,
  updateQueryParams,
} from '../../helpers/url';
import {
  genericErrorMessage,
  errorMessageClass,
} from '../../helpers/constants';
import { processSelectedParam, createGraphData } from '../perf-helpers/helpers';
import {
  alertSummaryLimit,
  endpoints,
  graphColors,
  graphSymbols,
  phTimeRanges,
  phDefaultTimeRangeValue,
} from '../perf-helpers/constants';
import ErrorMessages from '../../shared/ErrorMessages';
import ErrorBoundary from '../../shared/ErrorBoundary';
import LoadingSpinner from '../../shared/LoadingSpinner';

import LegendCard from './LegendCard';
import GraphsViewControls from './GraphsViewControls';

function GraphsView({ projects, frameworks, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const prevLocationSearch = useRef(location.search);

  const getDefaultTimeRange = () => {
    const { timerange } = parseQueryParams(location.search);
    const defaultValue = timerange
      ? parseInt(timerange, 10)
      : phDefaultTimeRangeValue;
    return phTimeRanges.find((time) => time.value === defaultValue);
  };

  const [timeRange, setTimeRange] = useState(getDefaultTimeRange);
  const [zoom, setZoom] = useState({});
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);
  const [highlightAlerts, setHighlightAlerts] = useState(true);
  const [highlightCommonAlerts, setHighlightCommonAlerts] = useState(false);
  const [highlightChangelogData, setHighlightChangelogData] = useState(false);
  const [highlightedRevisions, setHighlightedRevisions] = useState(['', '']);
  const [testData, setTestData] = useState([]);
  const [errorMessages, setErrorMessages] = useState([]);
  const [options] = useState({});
  const [loading, setLoading] = useState(false);
  const [colors, setColors] = useState([...graphColors]);
  const [symbols, setSymbols] = useState([...graphSymbols]);
  const [showModal, setShowModal] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [visibilityChanged, setVisibilityChanged] = useState(false);
  const [replicates, setReplicates] = useState(false);

  // Refs for latest state in async callbacks
  const timeRangeRef = useRef(timeRange);
  timeRangeRef.current = timeRange;
  const testDataRef = useRef(testData);
  testDataRef.current = testData;
  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;
  const errorMessagesRef = useRef(errorMessages);
  errorMessagesRef.current = errorMessages;
  const replicatesRef = useRef(replicates);
  replicatesRef.current = replicates;

  // Track whether changeParams should run after state updates
  const pendingChangeParams = useRef(false);

  const parseSeriesParam = (series, replicatesVal) =>
    series.map((encodedSeries) => {
      const partialSeriesArray = encodedSeries.split(',');
      return {
        repository_name: partialSeriesArray[0],
        signature_id:
          partialSeriesArray[1] && partialSeriesArray[1].length === 40
            ? partialSeriesArray[1]
            : parseInt(partialSeriesArray[1], 10),
        framework_id: parseInt(partialSeriesArray[3], 10),
        replicates: replicatesVal,
      };
    });

  const createSeriesParams = useCallback((series) => {
    const {
      repository_name: repositoryName,
      signature_id: signatureId,
      framework_id: frameworkId,
      replicates: seriesReplicates,
    } = series;

    return {
      repository: repositoryName,
      signature: signatureId,
      framework: frameworkId,
      interval: timeRangeRef.current.value,
      all_data: true,
      replicates: seriesReplicates,
    };
  }, []);

  const getAlertSummaries = useCallback(
    async (signatureId, repository) => {
      const data = await getData(
        createApiUrl(endpoints.alertSummary, {
          alerts__series_signature: signatureId,
          repository,
          limit: alertSummaryLimit,
          timerange: timeRangeRef.current.value,
        }),
      );
      const response = processResponse(
        data,
        'alertSummaries',
        errorMessagesRef.current,
      );

      if (response.alertSummaries) {
        return response.alertSummaries.results;
      }
      setErrorMessages(response.errorMessages);
      return [];
    },
    [],
  );

  const getCommonAlerts = useCallback(async (frameworkId, timeRangeValue) => {
    const params = {
      framework: frameworkId,
      limit: alertSummaryLimit,
      timerange: timeRangeValue,
    };
    const url = getApiUrl(
      `${endpoints.alertSummary}${createQueryParams(params)}`,
    );
    const response = await getData(url);
    return [...response.data.results];
  }, []);

  const createGraphObject = useCallback(
    async (seriesData) => {
      const alertSummariesData = await Promise.all(
        seriesData.map((series) =>
          getAlertSummaries(series.signature_id, series.repository_id),
        ),
      );
      const uniqueFrameworkIds = [
        ...new Set(seriesData.map((series) => series.framework_id)),
      ];
      const commonAlertsFlat = (await Promise.all(
        uniqueFrameworkIds.map(id => getCommonAlerts(id, timeRangeRef.current.value))
      )).flat();
      const commonAlerts = [commonAlertsFlat];
      const newColors = [...colorsRef.current];
      const newSymbols = [...symbolsRef.current];

      const graphData = createGraphData(
        seriesData,
        alertSummariesData.flat(),
        newColors,
        newSymbols,
        commonAlerts,
        replicatesRef.current,
      );

      setColors(newColors);
      setSymbols(newSymbols);
      return graphData;
    },
    [getAlertSummaries, getCommonAlerts],
  );

  const updateUrlParams = useCallback(
    (params) => {
      let newQueryString = queryString.stringify(params);
      newQueryString = newQueryString.replace(/%2C/g, ',');
      updateQueryParams(newQueryString, navigate, location);
    },
    [navigate, location],
  );

  const changeParams = useCallback(() => {
    const currentTestData = testDataRef.current;
    const newSeries = currentTestData.map(
      (series) =>
        `${series.repository_name},${series.signature_id},1,${series.framework_id}`,
    );
    const params = {
      series: newSeries,
      highlightAlerts: +highlightAlerts,
      highlightCommonAlerts: +highlightCommonAlerts,
      highlightChangelogData: +highlightChangelogData,
      timerange: timeRangeRef.current.value,
      replicates: +replicatesRef.current,
      zoom,
    };

    const newHighlightedRevisions = highlightedRevisions.filter(
      (rev) => rev.length,
    );

    if (newHighlightedRevisions.length) {
      params.highlightedRevisions = newHighlightedRevisions;
    }

    if (!selectedDataPoint) {
      delete params.selected;
    } else {
      const { signature_id: signatureId, dataPointId } = selectedDataPoint;
      params.selected = [signatureId, dataPointId].join(',');
    }

    if (Object.keys(zoom).length === 0) {
      delete params.zoom;
    } else {
      params.zoom = [...zoom.x.map((z) => z.getTime()), ...zoom.y].toString();
    }

    updateUrlParams(params);
  }, [
    highlightAlerts,
    highlightCommonAlerts,
    highlightChangelogData,
    highlightedRevisions,
    selectedDataPoint,
    zoom,
    updateUrlParams,
  ]);

  // Run changeParams when pendingChangeParams is set
  useEffect(() => {
    if (pendingChangeParams.current) {
      pendingChangeParams.current = false;
      changeParams();
    }
  });

  const getTestData = useCallback(
    async (newDisplayedTests = [], init = false) => {
      const currentTestData = testDataRef.current;
      const tests = newDisplayedTests.length
        ? newDisplayedTests
        : currentTestData;
      setLoading(true);

      const responses = await Promise.all(
        tests.map((series) =>
          getData(createApiUrl(endpoints.summary, createSeriesParams(series))),
        ),
      );
      const errors = processErrors(responses);

      if (errors.length) {
        setErrorMessages(errors);
        setLoading(false);
      } else {
        const data = responses
          .filter((response) => response.data.length)
          .map((reponse) => reponse.data[0]);
        let newTestData = await createGraphObject(data);

        if (newDisplayedTests.length) {
          newTestData = [...currentTestData, ...newTestData];
        }
        setTestData(newTestData);
        setLoading(false);
        setVisibilityChanged(false);

        if (!init) {
          pendingChangeParams.current = true;
        }
      }
    },
    [createSeriesParams, createGraphObject],
  );

  const updateData = useCallback(
    async (signatureId, repositoryName, alertSummaryId, dataPointIndex) => {
      const currentTestData = testDataRef.current;

      const updatedData = currentTestData.find(
        (test) => test.signature_id === signatureId,
      );
      const alertSummariesData = await getAlertSummaries(
        signatureId,
        repositoryName,
      );
      const alertSummary = alertSummariesData.find(
        (result) => result.id === alertSummaryId,
      );
      updatedData.data[dataPointIndex].alertSummary = alertSummary;
      const newTestData = unionBy(
        [updatedData],
        currentTestData,
        'signature_id',
      );

      setTestData(newTestData);
    },
    [getAlertSummaries],
  );

  const updateStateParams = useCallback((state) => {
    if (state.testData !== undefined) setTestData(state.testData);
    if (state.selectedDataPoint !== undefined)
      setSelectedDataPoint(state.selectedDataPoint);
    if (state.zoom !== undefined) setZoom(state.zoom);
    if (state.highlightAlerts !== undefined)
      setHighlightAlerts(state.highlightAlerts);
    if (state.highlightCommonAlerts !== undefined)
      setHighlightCommonAlerts(state.highlightCommonAlerts);
    if (state.highlightChangelogData !== undefined)
      setHighlightChangelogData(state.highlightChangelogData);
    if (state.highlightedRevisions !== undefined)
      setHighlightedRevisions(state.highlightedRevisions);
    if (state.visibilityChanged !== undefined)
      setVisibilityChanged(state.visibilityChanged);
    if (state.replicates !== undefined) setReplicates(state.replicates);
    if (state.colors !== undefined) setColors(state.colors);
    if (state.symbols !== undefined) setSymbols(state.symbols);
    pendingChangeParams.current = true;
  }, []);

  // componentDidMount - check query params
  useEffect(() => {
    const {
      series,
      zoom: zoomParam,
      selected,
      highlightAlerts: hlAlerts,
      highlightCommonAlerts: hlCommonAlerts,
      highlightChangelogData: hlChangelogData,
      highlightedRevisions: hlRevisions,
      replicates: replicatesParam,
    } = queryString.parse(location.search);

    const updates = {};

    if (series) {
      const _series = typeof series === 'string' ? [series] : series;
      const seriesParams = parseSeriesParam(
        _series,
        Boolean(parseInt(replicatesParam, 10)),
      );
      getTestData(seriesParams, true);
    }

    if (hlAlerts) {
      updates.highlightAlerts = Boolean(parseInt(hlAlerts, 10));
    }
    if (hlCommonAlerts) {
      updates.highlightCommonAlerts = Boolean(parseInt(hlCommonAlerts, 10));
    }
    if (hlChangelogData) {
      updates.highlightChangelogData = Boolean(parseInt(hlChangelogData, 10));
    }
    if (replicatesParam) {
      updates.replicates = Boolean(parseInt(replicatesParam, 10));
    }
    if (hlRevisions) {
      updates.highlightedRevisions =
        typeof hlRevisions === 'string' ? [hlRevisions] : hlRevisions;
    }
    if (zoomParam) {
      const zoomArray = zoomParam.replace(/[[{}\]"]+/g, '').split(',');
      updates.zoom = {
        x: zoomArray.map((x) => new Date(parseInt(x, 10))).slice(0, 2),
        y: zoomArray.slice(2, 4),
      };
    }
    if (selected) {
      const tooltipArray = selected.replace(/[[]"]/g, '').split(',');
      updates.selectedDataPoint = processSelectedParam(tooltipArray);
    }

    if (updates.highlightAlerts !== undefined)
      setHighlightAlerts(updates.highlightAlerts);
    if (updates.highlightCommonAlerts !== undefined)
      setHighlightCommonAlerts(updates.highlightCommonAlerts);
    if (updates.highlightChangelogData !== undefined)
      setHighlightChangelogData(updates.highlightChangelogData);
    if (updates.replicates !== undefined) setReplicates(updates.replicates);
    if (updates.highlightedRevisions !== undefined)
      setHighlightedRevisions(updates.highlightedRevisions);
    if (updates.zoom !== undefined) setZoom(updates.zoom);
    if (updates.selectedDataPoint !== undefined)
      setSelectedDataPoint(updates.selectedDataPoint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // componentDidUpdate - detect location.search changes
  useEffect(() => {
    const prevSearch = prevLocationSearch.current;
    prevLocationSearch.current = location.search;

    if (prevSearch === location.search) return;

    const { replicates: currentReplicates } = queryString.parse(
      location.search,
    );
    const { replicates: prevReplicates } = queryString.parse(prevSearch);

    if (
      location.search === '' &&
      testDataRef.current.length !== 0 &&
      !loading
    ) {
      setTestData([]);
    }

    if (prevReplicates !== undefined) {
      if (currentReplicates !== prevReplicates) {
        window.location.reload(false);
      }
    }
  }, [location.search, loading]);

  const handleUpdateTimeRange = useCallback(
    (newTimeRange) => {
      setTimeRange(newTimeRange);
      setZoom({});
      setSelectedDataPoint(null);
      setColors([...graphColors]);
      setSymbols([...graphSymbols]);
      // Need to update ref before getTestData uses it
      timeRangeRef.current = newTimeRange;
      getTestData();
    },
    [getTestData],
  );

  const handleUpdateTestsAndTimeRange = useCallback(
    (newDisplayedTests, newTimeRange) => {
      setTimeRange(newTimeRange);
      setZoom({});
      setSelectedDataPoint(null);
      setColors([...graphColors]);
      setSymbols([...graphSymbols]);
      timeRangeRef.current = newTimeRange;
      getTestData(newDisplayedTests);
    },
    [getTestData],
  );

  return (
    <ErrorBoundary
      errorClasses={errorMessageClass}
      message={genericErrorMessage}
    >
      <Container fluid className="pt-5 pe-5 ps-5">
        {loading && <LoadingSpinner />}

        {errorMessages.length > 0 && (
          <Container className="pb-4 px-0 max-width-default">
            <ErrorMessages errorMessages={errorMessages} />
          </Container>
        )}

        <Row className="justify-content-center">
          {!showTable && (
            <Col
              className={`${testData.length ? 'graph-chooser' : 'col-12'}`}
            >
              <Button
                className="sr-only"
                onClick={() => setShowTable(!showTable)}
              >
                Table View
              </Button>
              <Container
                role="region"
                aria-label="Graph Legend"
                className="graph-legend ps-0 pb-4"
              >
                {testData.length > 0 &&
                  testData.map((series) => (
                    <div
                      key={`${series.name} ${series.repository_name} ${series.platform}`}
                    >
                      <LegendCard
                        series={series}
                        testData={testData}
                        projects={projects}
                        frameworks={frameworks}
                        user={user}
                        updateState={(state) => {
                          if (state.testData !== undefined)
                            setTestData(state.testData);
                          if (state.selectedDataPoint !== undefined)
                            setSelectedDataPoint(state.selectedDataPoint);
                          if (state.visibilityChanged !== undefined)
                            setVisibilityChanged(state.visibilityChanged);
                          if (state.colors !== undefined)
                            setColors(state.colors);
                          if (state.symbols !== undefined)
                            setSymbols(state.symbols);
                        }}
                        updateStateParams={updateStateParams}
                        colors={colors}
                        symbols={symbols}
                        selectedDataPoint={selectedDataPoint}
                      />
                    </div>
                  ))}
              </Container>
            </Col>
          )}
          <Col
            className={`ps-0 ${
              testData.length ? 'custom-col-xxl-auto' : 'col-auto'
            } ${showTable && 'w-100'}`}
          >
            <GraphsViewControls
              colors={colors}
              symbols={symbols}
              timeRange={timeRange}
              frameworks={frameworks}
              user={user}
              projects={projects}
              options={options}
              getTestData={getTestData}
              testData={testData}
              showModal={showModal}
              showTable={showTable}
              highlightAlerts={highlightAlerts}
              highlightChangelogData={highlightChangelogData}
              highlightedRevisions={highlightedRevisions}
              highlightCommonAlerts={highlightCommonAlerts}
              zoom={zoom}
              selectedDataPoint={selectedDataPoint}
              updateStateParams={updateStateParams}
              visibilityChanged={visibilityChanged}
              updateData={updateData}
              toggle={() => setShowModal(!showModal)}
              toggleTableView={() => setShowTable(!showTable)}
              replicates={replicates}
              updateTimeRange={handleUpdateTimeRange}
              updateTestsAndTimeRange={handleUpdateTestsAndTimeRange}
              hasNoData={!testData.length && !loading}
            />
          </Col>
        </Row>
      </Container>
    </ErrorBoundary>
  );
}

GraphsView.propTypes = {
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  frameworks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  user: PropTypes.shape({}).isRequired,
};

export default GraphsView;
