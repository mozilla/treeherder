import React from 'react';
import { Row, Button, Col } from 'reactstrap';
import PropTypes from 'prop-types';

import Graph from './Graph';

export default class GraphsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showGraphTwo: false,
    };
  }

  toggleGraph = () => {
    this.setState(prevState => ({ showGraphTwo: !prevState.showGraphTwo }));
  };

  render() {
    const { graphOneData, graphTwoData, children } = this.props;
    const { showGraphTwo } = this.state;

    return (
      <React.Fragment>
        <Row className="pt-5">
          <Graph graphData={graphOneData} title="Failure Count per Push" />
        </Row>
        <Row>
          <Col xs="12" className="mx-auto pb-5">
            <Button
              color="secondary"
              onClick={this.toggleGraph}
              className="d-inline-block mr-3"
            >
              {`${showGraphTwo ? 'less' : 'more'} graphs`}
            </Button>
            {children}
          </Col>
        </Row>
        {showGraphTwo && (
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
      </React.Fragment>
    );
  }
}

GraphsContainer.propTypes = {
  graphOneData: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.shape({ Date: PropTypes.string }),
      value: PropTypes.number,
    }),
  ),
  graphTwoData: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.shape({ Date: PropTypes.string }),
        value: PropTypes.number,
      }),
    ),
    PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.shape({ Date: PropTypes.string }),
        value: PropTypes.number,
      }),
    ),
  ),
  children: PropTypes.object.isRequired,
};

GraphsContainer.defaultProps = {
  graphOneData: null,
  graphTwoData: null,
};
