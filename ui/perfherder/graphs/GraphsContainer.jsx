// disabling due to a new bug with this rule: https://github.com/eslint/eslint/issues/12117
/* eslint-disable no-unused-vars */
import React from 'react';
import { Row, Col } from 'reactstrap';
import PropTypes from 'prop-types';
import {
  VictoryBar,
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryBrushContainer,
  VictoryLabel,
  VictoryScatter,
  createContainer,
  VictoryTooltip,
  VictoryPortal,
} from 'victory';
import moment from 'moment';
import numeral from 'numeral';
import debounce from 'lodash/debounce';
import last from 'lodash/last';
import flatMap from 'lodash/flatMap';

import { abbreviatedNumber } from '../perf-helpers/helpers';

import TableView from './TableView';
import GraphTooltip from './GraphTooltip';

const DOT_SIZE = 5;
const CHART_WIDTH = 1350;

const VictoryZoomSelectionContainer = createContainer('zoom', 'selection');

class GraphsContainer extends React.Component {
  infraChangeColor = '#d19900';

  constructor(props) {
    super(props);
    this.tooltip = React.createRef();
    this.leftChartPadding = 25;
    this.rightChartPadding = 10;
    const scatterPlotData = flatMap(this.props.testData, (item) =>
      item.visible ? item.data : [],
    );
    const zoomDomain = this.initZoomDomain(scatterPlotData);
    this.state = {
      highlights: [],
      highlightCommonAlertsData: [],
      scatterPlotData,
      zoomDomain,
      lockTooltip: false,
      externalMutation: undefined,
      width: window.innerWidth,
    };
  }

  componentDidMount() {
    const { zoom, selectedDataPoint } = this.props;
    const { scatterPlotData } = this.state;
    const zoomDomain = this.initZoomDomain(scatterPlotData);
    this.addHighlights();
    if (selectedDataPoint) this.verifySelectedDataPoint();
    window.addEventListener('resize', () =>
      this.setState({
        width: window.innerWidth,
        zoomDomain,
      }),
    );
  }

  componentDidUpdate(prevProps) {
    const {
      highlightAlerts,
      highlightCommonAlerts,
      highlightChangelogData,
      highlightedRevisions,
      testData,
      timeRange,
    } = this.props;
    const scatterPlotData = flatMap(testData, (item) =>
      item.visible ? item.data : [],
    );

    if (
      prevProps.highlightAlerts !== highlightAlerts ||
      prevProps.highlightCommonAlerts !== highlightCommonAlerts ||
      prevProps.highlightChangelogData !== highlightChangelogData ||
      prevProps.highlightedRevisions !== highlightedRevisions
    ) {
      this.addHighlights();
    }

    if (prevProps.testData !== testData) {
      this.updateGraphs();
    }

    if (prevProps.timeRange !== timeRange) {
      this.closeTooltip();
    }
  }

  // limits for the zoomDomain of VictoryChart
  initZoomDomain = (plotData) => {
    const minDomainY = this.getMinY(plotData);
    const maxDomainY = this.getMaxY(plotData);
    // zoom domain padding is the space between the lowest/highest datapoint
    // and the top/bottom limits of the zoom domain. The minimum value is 100
    // as this is the top victory graph behavior
    let zoomDomPadd;
    if (minDomainY !== maxDomainY) {
      zoomDomPadd = (maxDomainY - minDomainY) / 1.8;
    } else {
      zoomDomPadd = 100;
    }
    const minY = minDomainY - zoomDomPadd < 0 ? 0 : minDomainY - zoomDomPadd;
    const maxY = maxDomainY + zoomDomPadd;

    // By default, Victory chart will place dots at the very ends of the graphs, which
    // cuts them off. This code takes into account the data and dot size to compute
    // a domain that will ensure the dots are all charted within view.
    //
    // Note that the domainPadding provided by Victory pads the data incorrectly, and
    // skews the positioning of the graph.
    const unpaddedMinX = this.getMinX(plotData);
    const unpaddedMaxX = this.getMaxX(plotData);

    const paddingInMilliseconds =
      // Figure out the length of the graph in Milliseconds.
      (Number(unpaddedMaxX) - Number(unpaddedMinX)) *
      // Multiply by the ratio of 1 dot in terms of the width of the chart. The 1.4
      // factor is used here since this is done once for each dot, and the factor
      // needs to be increased to fully show the dot on the screen. This number
      // was determined visually.
      ((DOT_SIZE * 1.4) / CHART_WIDTH);

    // Adjust the date by performing arithmetic on the milliseconds.
    const minX = new Date(Number(unpaddedMinX) - paddingInMilliseconds);
    const maxX = new Date(Number(unpaddedMaxX) + paddingInMilliseconds);

    return { minX, maxX, minY, maxY };
  };

  updateZoomDomain = (plotData) => {
    return this.initZoomDomain(plotData);
  };

  verifySelectedDataPoint = () => {
    const { selectedDataPoint, testData, updateStateParams } = this.props;

    const dataPointFound = testData.find((item) => {
      if (item.signature_id === selectedDataPoint.signature_id) {
        return item.data.find(
          (datum) => datum.dataPointId === selectedDataPoint.dataPointId,
        );
      }
      return false;
    });

    if (dataPointFound) {
      this.showTooltip(selectedDataPoint);
    } else {
      updateStateParams({
        errorMessages: [
          "This datapoint can't be found for the specified date range.",
        ],
      });
    }
  };

  updateGraphs = () => {
    const { testData, updateStateParams, visibilityChanged } = this.props;
    let { zoomDomain } = this.state;
    const scatterPlotData = testData.flatMap((item) =>
      item.visible ? item.data : [],
    );
    this.addHighlights();
    if (scatterPlotData.length) {
      zoomDomain = this.updateZoomDomain(scatterPlotData);
    }
    this.setState({
      scatterPlotData,
      zoomDomain,
    });

    if (!visibilityChanged) {
      updateStateParams({ zoom: {} });
    }
  };

  addHighlights = () => {
    const {
      testData,
      highlightAlerts,
      highlightCommonAlerts,
      highlightedRevisions,
    } = this.props;
    let highlights = [];
    let highlightCommonAlertsData = [];

    for (const series of testData) {
      if (!series.visible) {
        continue;
      }

      if (highlightAlerts) {
        const dataPoints = series.data.filter((item) => item.alertSummary);
        highlights = [...highlights, ...dataPoints];
      }

      if (highlightCommonAlerts) {
        const dataPoints = series.data.filter(
          (item) => item.commonAlert && !item.alertSummary,
        );
        highlightCommonAlertsData = [
          ...highlightCommonAlertsData,
          ...dataPoints,
        ];
      }

      for (const rev of highlightedRevisions) {
        if (!rev) {
          continue;
        }
        // in case people are still using 12 character sha
        const dataPoint = series.data.find(
          (item) => item.revision.indexOf(rev) !== -1,
        );

        if (dataPoint) {
          highlights.push(dataPoint);
        }
      }
    }
    this.setState({ highlights, highlightCommonAlertsData });
  };

  getTooltipPosition = (point, yOffset = 15) => ({
    left: point.x - 280 / 2,
    top: point.y - yOffset,
  });

  setTooltip = (dataPoint, lock = false) => {
    const { lockTooltip } = this.state;
    const { updateStateParams } = this.props;

    if (lock) {
      updateStateParams({
        selectedDataPoint: {
          signature_id: dataPoint.datum.signature_id,
          dataPointId: dataPoint.datum.dataPointId,
        },
      });
    }
    this.setState({
      lockTooltip: lock,
    });
    return { active: true };
  };

  // The Victory library doesn't provide a way of dynamically setting the left
  // padding for the y axis tick labels, so this is a workaround (setting state
  // doesn't work with this callback, which is why a class property is used instead)
  setLeftPadding = (tick, index, ticks) => {
    const formattedNumber = abbreviatedNumber(tick).toString();
    const highestTick = abbreviatedNumber(ticks[ticks.length - 1]).toString();
    const newLeftPadding = highestTick.length * 8 + 16;
    this.leftChartPadding =
      this.leftChartPadding > newLeftPadding
        ? this.leftChartPadding
        : newLeftPadding;

    return formattedNumber.toUpperCase();
  };

  setRightPadding = (tick, index, ticks) => {
    const highestTick = ticks[ticks.length - 1].toString();
    const newRightPadding = highestTick.length / 2;
    this.rightChartPadding =
      this.rightChartPadding > newRightPadding
        ? this.rightChartPadding
        : newRightPadding;
    return this.checkDate(tick);
  };

  checkDate = (x) => {
    const graphData = this.props.testData.filter(
      (item) => item.visible === true && item.data.length > 0,
    );

    return graphData.length > 0
      ? moment.utc(x).format('MMM DD')
      : moment.utc().format('MMM DD');
  };

  computeYAxisLabel = () => {
    const { measurementUnits } = this.props;

    if (measurementUnits && measurementUnits.size === 1) {
      return [...measurementUnits][0];
    }
    return null;
  };

  hideTooltip = () =>
    this.state.lockTooltip ? { active: true } : { active: undefined };

  showTooltip = (selectedDataPoint) => {
    this.setState({
      externalMutation: [
        {
          childName: 'scatter-plot',
          target: 'labels',
          eventKey: 'all',
          mutation: (props) => {
            if (props.datum.dataPointId === selectedDataPoint.dataPointId) {
              return { active: true };
            }
            return {};
          },
          callback: this.removeMutation,
        },
      ],
      lockTooltip: true,
    });
  };

  closeTooltip = () => {
    this.setState({
      externalMutation: [
        {
          childName: 'scatter-plot',
          target: 'labels',
          eventKey: 'all',
          mutation: () => ({ active: false }),
          callback: this.removeMutation,
        },
      ],
      lockTooltip: false,
    });
    this.props.updateStateParams({ selectedDataPoint: null });
  };

  removeMutation = () => {
    this.setState({
      externalMutation: undefined,
    });
  };

  updateZoom = (zoom) => {
    const { lockTooltip } = this.state;
    const { updateStateParams } = this.props;

    if (lockTooltip) {
      this.closeTooltip();
    }
    updateStateParams({ zoom });
  };

  // helper functions that allow the zoom domain to be tuned correctly
  getMinX = (data) => {
    return data.reduce((min, p) => (p.x < min ? p.x : min), data[0].x);
  };

  getMaxX = (data) => {
    // Due to Bug 1676498 some data points can appear in the future. Guard against
    // this by accepting dates in the future.
    return data.reduce((max, p) => (p.x > max ? p.x : max), new Date());
  };

  getMinY = (data) => {
    return data.reduce((min, p) => (p.y < min ? p.y : min), data[0].y);
  };

  getMaxY = (data) => {
    return data.reduce((max, p) => (p.y > max ? p.y : max), data[0].y);
  };

  render() {
    const {
      testData,
      changelogData,
      showTable,
      zoom,
      highlightedRevisions,
      highlightChangelogData,
      highlightCommonAlerts,
    } = this.props;
    const {
      highlights,
      highlightCommonAlertsData,
      scatterPlotData,
      zoomDomain,
      lockTooltip,
      externalMutation,
      width,
    } = this.state;

    let infraAffectedData = [];
    const markDataPoints = 5;

    changelogData.forEach((data) =>
      scatterPlotData.some((dataPoint, index) => {
        const affectedData = dataPoint.x > data.date;
        if (affectedData) {
          infraAffectedData.push(
            scatterPlotData.slice(index, index + markDataPoints),
          );
        }
        return affectedData;
      }),
    );

    infraAffectedData = new Set(
      flatMap(infraAffectedData).map((item) => item.revision),
    );

    const yAxisLabel = this.computeYAxisLabel();
    const positionedTick = <VictoryLabel dx={-2} />;
    const positionedLabel = <VictoryLabel dy={24} />;

    const highlightPoints = !!highlights.length;

    const hasHighlightedRevision = (point) =>
      highlightedRevisions.find((rev) => point.revision.indexOf(rev) !== -1);

    const axisStyle = {
      grid: { stroke: 'lightgray', strokeWidth: 0.5 },
      tickLabels: { fontSize: 13 },
    };

    const chartPadding = {
      top: 10,
      left: this.leftChartPadding,
      right: this.rightChartPadding,
      bottom: 50,
    };

    return (
      <span data-testid="graphContainer">
        {!showTable && (
          <React.Fragment>
            <Row>
              <Col className="p-0 col-md-auto">
                <VictoryChart
                  padding={chartPadding}
                  width={CHART_WIDTH}
                  height={150}
                  style={{ parent: { maxHeight: '150px', maxWidth: '1350px' } }}
                  scale={{ x: 'time', y: 'linear' }}
                  domainPadding={{ y: 30 }}
                  minDomain={{ x: zoomDomain.minX, y: zoomDomain.minY }}
                  maxDomain={{ x: zoomDomain.maxX, y: zoomDomain.maxY }}
                  containerComponent={
                    <VictoryBrushContainer
                      brushDomain={zoom}
                      onBrushDomainChange={this.updateZoom}
                    />
                  }
                >
                  <VictoryAxis
                    dependentAxis
                    tickCount={4}
                    style={axisStyle}
                    tickFormat={this.setLeftPadding}
                    tickLabelComponent={positionedTick}
                    axisLabelComponent={positionedLabel}
                    label={yAxisLabel}
                  />
                  <VictoryAxis
                    tickCount={10}
                    tickFormat={(x) => this.checkDate(x)}
                    style={axisStyle}
                  />
                  {testData.map((item) => (
                    <VictoryLine
                      key={item.name}
                      data={item.visible ? item.data : []}
                      style={{
                        data: { stroke: item.color[1] },
                      }}
                    />
                  ))}
                </VictoryChart>
              </Col>
            </Row>

            <Row>
              <Col className="p-0 col-md-auto">
                <VictoryChart
                  padding={chartPadding}
                  width={1350}
                  height={400}
                  style={{ parent: { maxHeight: '400px', maxWidth: '1350px' } }}
                  scale={{ x: 'time', y: 'linear' }}
                  domainPadding={{ y: 40 }}
                  minDomain={{ x: zoomDomain.minX, y: zoomDomain.minY }}
                  maxDomain={{ x: zoomDomain.maxX, y: zoomDomain.maxY }}
                  externalEventMutations={externalMutation}
                  containerComponent={
                    <VictoryZoomSelectionContainer
                      zoomDomain={zoom}
                      onSelection={(points, bounds) => this.updateZoom(bounds)}
                      allowPan={false}
                      allowZoom={false}
                    />
                  }
                  events={[
                    {
                      childName: 'scatter-plot',
                      target: 'data',
                      eventHandlers: {
                        onClick: () => {
                          return [
                            {
                              target: 'data',
                              mutation: (props) => {
                                const { style } = props;
                                const fill = style && style.fill;
                                const stroke = style && style.stroke;
                                return fill === stroke
                                  ? null
                                  : {
                                      style: {
                                        fill: stroke,
                                        stroke,
                                        strokeOpacity: 0.3,
                                        strokeWidth: 12,
                                      },
                                    };
                              },
                            },
                            {
                              target: 'labels',
                              eventKey: 'all',
                              mutation: () => {},
                            },
                            {
                              target: 'labels',
                              mutation: (props) => this.setTooltip(props, true),
                            },
                          ];
                        },
                        onMouseOver: () => {
                          return [
                            {
                              target: 'labels',
                              mutation: () => {},
                            },
                            {
                              target: 'labels',
                              mutation: (props) => this.setTooltip(props),
                            },
                          ];
                        },
                        onMouseOut: () => {
                          return [
                            {
                              target: 'labels',
                              mutation: this.hideTooltip,
                            },
                          ];
                        },
                        // work-around to allow onClick events with VictorySelection container
                        onMouseDown: (evt) => evt.stopPropagation(),
                      },
                    },
                  ]}
                >
                  {highlights.length > 0 &&
                    highlights.map((item) => (
                      <VictoryLine
                        key={item}
                        style={{
                          data: { stroke: 'gray', strokeWidth: 1 },
                        }}
                        x={() => item.x}
                      />
                    ))}

                  {highlightCommonAlerts &&
                    highlightCommonAlertsData.length > 0 &&
                    highlightCommonAlertsData.map((item) => (
                      <VictoryLine
                        key={item}
                        style={{
                          data: {
                            stroke: 'gray',
                            strokeWidth: 1,
                            strokeDasharray: '5',
                          },
                        }}
                        x={() => item.x}
                      />
                    ))}

                  {highlightChangelogData && changelogData.length > 0 && (
                    <VictoryBar
                      key="changelog"
                      data={changelogData.map((i) => ({
                        x: i.date,
                        y: zoomDomain.maxY,
                        label: i.description,
                      }))}
                      style={{
                        data: { fill: this.infraChangeColor, width: 1 },
                      }}
                      events={[
                        {
                          target: 'data',
                          eventHandlers: {
                            onMouseOver: () => {
                              return [
                                {
                                  target: 'data',
                                  mutation: () => ({
                                    style: {
                                      fill: this.infraChangeColor,
                                      width: 3,
                                    },
                                  }),
                                },
                                {
                                  target: 'labels',
                                  mutation: () => ({
                                    active: true,
                                    y: 150,
                                  }),
                                },
                              ];
                            },
                            onMouseOut: () => {
                              return [
                                {
                                  target: 'data',
                                  mutation: () => ({
                                    style: {
                                      fill: this.infraChangeColor,
                                      width: 2,
                                    },
                                  }),
                                },
                                {
                                  target: 'labels',
                                  mutation: () => ({ active: false }),
                                },
                              ];
                            },
                          },
                        },
                      ]}
                    />
                  )}

                  <VictoryScatter
                    name="scatter-plot"
                    symbol={({ datum }) => (datum._z ? datum._z[0] : 'circle')}
                    style={{
                      data: {
                        fill: ({ datum }) => {
                          const symbolType = datum._z || '';
                          return ((datum.alertSummary ||
                            hasHighlightedRevision(datum)) &&
                            highlightPoints) ||
                            symbolType[1] === 'fill'
                            ? datum.z
                            : '#fff';
                        },
                        strokeOpacity: ({ datum }) =>
                          (datum.alertSummary ||
                            hasHighlightedRevision(datum)) &&
                          highlightPoints
                            ? 0.3
                            : 100,
                        stroke: ({ datum }) => {
                          return datum.z;
                        },
                        strokeWidth: ({ datum }) =>
                          (datum.alertSummary ||
                            hasHighlightedRevision(datum)) &&
                          highlightPoints
                            ? 12
                            : 2,
                      },
                    }}
                    size={() => DOT_SIZE}
                    data={scatterPlotData}
                    labels={() => ''}
                    labelComponent={
                      <VictoryTooltip
                        renderInPortal={false}
                        flyoutComponent={
                          <VictoryPortal>
                            <GraphTooltip
                              infraAffectedData={infraAffectedData}
                              lockTooltip={lockTooltip}
                              closeTooltip={this.closeTooltip}
                              windowWidth={width}
                              {...this.props}
                            />
                          </VictoryPortal>
                        }
                      />
                    }
                  />
                  <VictoryAxis
                    dependentAxis
                    tickCount={9}
                    style={axisStyle}
                    tickFormat={this.setLeftPadding}
                    tickLabelComponent={positionedTick}
                    axisLabelComponent={positionedLabel}
                    label={yAxisLabel}
                  />
                  <VictoryAxis
                    tickCount={6}
                    tickFormat={this.setRightPadding}
                    style={axisStyle}
                    fixLabelOverlap
                  />
                </VictoryChart>
              </Col>
            </Row>
          </React.Fragment>
        )}

        {showTable && (
          <Row>
            <TableView testData={testData} {...this.props} />
          </Row>
        )}
      </span>
    );
  }
}

GraphsContainer.propTypes = {
  testData: PropTypes.arrayOf(PropTypes.shape({})),
  changelogData: PropTypes.arrayOf(PropTypes.shape({})),
  measurementUnits: PropTypes.instanceOf(Set).isRequired,
  updateStateParams: PropTypes.func.isRequired,
  zoom: PropTypes.shape({}),
  selectedDataPoint: PropTypes.shape({}),
  highlightAlerts: PropTypes.bool,
  highlightedRevisions: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  timeRange: PropTypes.shape({}).isRequired,
};

GraphsContainer.defaultProps = {
  testData: [],
  changelogData: [],
  zoom: {},
  selectedDataPoint: undefined,
  highlightAlerts: true,
  highlightedRevisions: ['', ''],
};

export default GraphsContainer;
