import React from 'react';
import PropTypes from 'prop-types';
import { VictoryChart, VictoryLine, VictoryLegend } from 'victory';
import { Col } from 'react-bootstrap';

const Graph = ({ graphData = null, title = '', legendData = [] }) => (
  <Col
    className="mx-auto pb-3"
    style={{ maxHeight: '300px', maxWidth: '700px' }}
  >
    <VictoryChart
      width={700}
      height={300}
      scale={{ x: 'time', y: 'linear' }}
      domainPadding={{ y: 30 }}
    >
      {(title || legendData.length > 0) && (
        <VictoryLegend
          x={230}
          y={0}
          title={title}
          centerTitle
          orientation="horizontal"
          gutter={20}
          style={{ title: { fontSize: 16, fontFamily: 'Helvetica Neue' } }}
          data={legendData}
        />
      )}
      {graphData &&
        graphData.length > 0 &&
        graphData.map((item) => (
          <VictoryLine
            key={item}
            data={item.data}
            style={{
              data: { stroke: item.color },
            }}
          />
        ))}
    </VictoryChart>
  </Col>
);

Graph.propTypes = {
  graphData: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.arrayOf(PropTypes.shape({})),
      color: PropTypes.string,
    }),
  ),
  title: PropTypes.string,
  legendData: PropTypes.arrayOf(PropTypes.shape({})),
};

export default Graph;
