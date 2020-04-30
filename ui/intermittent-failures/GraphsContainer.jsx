import React from 'react';
import { Row, Button, Col } from 'reactstrap';
import PropTypes from 'prop-types';

import Graph from './Graph';
import GraphAlternateView from './GraphAlternateView';

export default class GraphsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showGraphTwo: false,
      showAlternateView: false,
    };
  }

  toggleGraph = () => {
    this.setState((prevState) => ({ showGraphTwo: !prevState.showGraphTwo }));
  };

  toggleAltViewGraph = () => {
    this.setState((prevState) => ({
      showAlternateView: !prevState.showAlternateView,
    }));
  };

  render() {
    const { graphOneData, graphTwoData, children } = this.props;
    const { showGraphTwo, showAlternateView } = this.state;

    return (
      <React.Fragment>
        <Row className="pt-5">
          {showAlternateView ? (
            <GraphAlternateView
              graphData={graphOneData}
              className="failure-per-count"
              colNum={1}
              title="Failure Count Per Push"
            />
          ) : (
            <Graph graphData={graphOneData} title="Failure Count per Push" />
          )}
        </Row>
        <Row>
          <Col xs="12" className="mx-auto pb-5">
            <Button onClick={this.toggleAltViewGraph} className="mr-3">
              {showAlternateView ? 'Show graph view' : 'Show table view'}
            </Button>
            <Button
              color="secondary"
              onClick={this.toggleGraph}
              className="d-inline-block mr-3"
            >
              {`${showGraphTwo ? 'less' : 'more'} ${
                showAlternateView ? 'tables' : 'graphs'
              }`}
            </Button>
            {children}
          </Col>
        </Row>
        {showGraphTwo && !showAlternateView && (
          <Row className="pt-5">
            <Graph
              graphData={graphTwoData}
              title="Failure Count vs Push Count"
              legendData={[
                {
                  name: 'Failure Count',
                  symbol: { fill: 'blue' },
                },
                {
                  name: 'Push Count',
                  symbol: { fill: 'green' },
                },
              ]}
            />
          </Row>
        )}
        {showGraphTwo && showAlternateView && (
          <GraphAlternateView
            graphData={graphTwoData}
            className="failure-and-count"
            title="Failure Count vs Push Count"
          />
        )}
      </React.Fragment>
    );
  }
}

GraphsContainer.propTypes = {
  graphOneData: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.arrayOf(PropTypes.shape({})),
      color: PropTypes.string,
    }),
  ),
  graphTwoData: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.arrayOf(PropTypes.shape({})),
      color: PropTypes.string,
    }),
    PropTypes.shape({
      data: PropTypes.arrayOf(PropTypes.shape({})),
      color: PropTypes.string,
    }),
  ),
  children: PropTypes.element.isRequired,
};

GraphsContainer.defaultProps = {
  graphOneData: null,
  graphTwoData: null,
};
