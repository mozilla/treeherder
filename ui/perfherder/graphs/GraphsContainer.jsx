// disabling due to a new bug with this rule: https://github.com/eslint/eslint/issues/12117
/* eslint-disable no-unused-vars */
import React from 'react';
import { Row, Col } from 'reactstrap';
import PropTypes from 'prop-types';
import {
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
import debounce from 'lodash/debounce';
import last from 'lodash/last';

import { formatNumber } from '../helpers';

import TableView from './TableView';
import GraphTooltip from './GraphTooltip';

const VictoryZoomSelectionContainer = createContainer('zoom', 'selection');

class GraphsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.tooltip = React.createRef();
    this.leftChartPadding = 25;
    this.rightChartPadding = 10;
    this.state = {
      highlights: [],
      scatterPlotData: this.props.testData.flatMap(item =>
        item.visible ? item.data : [],
      ),
      lockTooltip: false,
      externalMutation: undefined,
      width: window.innerWidth,
    };
  }

  componentDidMount() {
    const { zoom, selectedDataPoint } = this.props;

    this.addHighlights();
    if (selectedDataPoint) this.verifySelectedDataPoint();
    window.addEventListener('resize', () =>
      this.setState({ width: window.innerWidth }),
    );
  }

  componentDidUpdate(prevProps) {
    const {
      highlightAlerts,
      highlightedRevisions,
      testData,
      timeRange,
    } = this.props;

    if (
      prevProps.highlightAlerts !== highlightAlerts ||
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

  verifySelectedDataPoint = () => {
    const { selectedDataPoint, testData, updateStateParams } = this.props;

    const dataPointFound = testData.find(item => {
      if (item.signature_id === selectedDataPoint.signature_id) {
        return item.data.find(
          datum => datum.dataPointId === selectedDataPoint.dataPointId,
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
    const scatterPlotData = testData.flatMap(item =>
      item.visible ? item.data : [],
    );
    this.addHighlights();
    this.setState({
      scatterPlotData,
    });

    if (!visibilityChanged) {
      updateStateParams({ zoom: {} });
    }
  };

  addHighlights = () => {
    const { testData, highlightAlerts, highlightedRevisions } = this.props;
    let highlights = [];

    for (const series of testData) {
      if (!series.visible) {
        continue;
      }

      if (highlightAlerts) {
        const dataPoints = series.data.filter(item => item.alertSummary);
        highlights = [...highlights, ...dataPoints];
      }

      for (const rev of highlightedRevisions) {
        if (!rev) {
          continue;
        }
        // in case people are still using 12 character sha
        const dataPoint = series.data.find(
          item => item.revision.indexOf(rev) !== -1,
        );

        if (dataPoint) {
          highlights.push(dataPoint);
        }
      }
    }
    this.setState({ highlights });
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
    const highestTickLength = ticks[ticks.length - 1].toString();
    const newLeftPadding = highestTickLength.length * 8 + 16;
    this.leftChartPadding =
      this.leftChartPadding > newLeftPadding
        ? this.leftChartPadding
        : newLeftPadding;

    return formatNumber(tick);
  };

  setRightPadding = (tick, index, ticks) => {
    const highestTickLength = ticks[ticks.length - 1].toString();
    const newRightPadding = highestTickLength.length / 2;
    this.rightChartPadding =
      this.rightChartPadding > newRightPadding
        ? this.rightChartPadding
        : newRightPadding;
    return this.checkDate(tick);
  };

  checkDate = x => {
    const graphData = this.props.testData.filter(
      item => item.visible === true && item.data.length > 0,
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

  showTooltip = selectedDataPoint => {
    this.setState({
      externalMutation: [
        {
          childName: 'scatter-plot',
          target: 'labels',
          eventKey: 'all',
          mutation: props => {
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

  updateZoom = zoom => {
    const { lockTooltip } = this.state;
    const { updateStateParams } = this.props;

    if (lockTooltip) {
      this.closeTooltip();
    }
    updateStateParams({ zoom });
  };

  render() {
    const { testData, showTable, zoom, highlightedRevisions } = this.props;
    const {
      highlights,
      scatterPlotData,
      lockTooltip,
      externalMutation,
      width,
    } = this.state;

    const yAxisLabel = this.computeYAxisLabel();
    const positionedTick = <VictoryLabel dx={-2} />;
    const positionedLabel = <VictoryLabel dy={24} />;

    const highlightPoints = !!highlights.length;

    const hasHighlightedRevision = point =>
      highlightedRevisions.find(rev => point.revision.indexOf(rev) !== -1);

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
                  width={1350}
                  height={150}
                  style={{ parent: { maxHeight: '150px', maxWidth: '1350px' } }}
                  scale={{ x: 'time', y: 'linear' }}
                  domainPadding={{ y: 30 }}
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
                    tickFormat={x => this.checkDate(x)}
                    style={axisStyle}
                  />
                  {testData.map(item => (
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
                  domainPadding={{ y: 40, x: [10, 10] }}
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
                              target: 'labels',
                              eventKey: 'all',
                              mutation: () => {},
                            },
                            {
                              target: 'labels',
                              mutation: props => this.setTooltip(props, true),
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
                              mutation: props => this.setTooltip(props),
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
                        onMouseDown: evt => evt.stopPropagation(),
                      },
                    },
                  ]}
                >
                  {highlights.length > 0 &&
                    highlights.map(item => (
                      <VictoryLine
                        key={item}
                        style={{
                          data: { stroke: 'gray', strokeWidth: 1 },
                        }}
                        x={() => item.x}
                      />
                    ))}

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
                    size={() => 5}
                    data={scatterPlotData}
                    labels={() => ''}
                    labelComponent={
                      <VictoryTooltip
                        renderInPortal={false}
                        flyoutComponent={
                          <VictoryPortal>
                            <GraphTooltip
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
  zoom: {},
  selectedDataPoint: undefined,
  highlightAlerts: true,
  highlightedRevisions: ['', ''],
};

export default GraphsContainer;
