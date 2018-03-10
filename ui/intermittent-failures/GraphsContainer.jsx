import React from 'react';
import { Row, Button, Col } from 'reactstrap';
import PropTypes from 'prop-types';

import Graph from './Graph';
import DateOptions from './DateOptions';
import DateRangePicker from './DateRangePicker';
import { graphOneSpecs, graphTwoSpecs } from './constants';

export default class GraphsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showGraphTwo: false,
    };
    this.toggleGraph = this.toggleGraph.bind(this);
  }

  toggleGraph() {
    this.setState({ showGraphTwo: !this.state.showGraphTwo });
  }

  render() {

    const { graphOneData, graphTwoData, dateOptions, name, graphName, tree, bugId, tableApi, graphApi } = this.props;
    const { showGraphTwo } = this.state;

    return (
      <React.Fragment>
        <Row className="pt-5">
          <Graph specs={graphOneSpecs} data={graphOneData} />
        </Row>
        <Row>
          <Col xs="12" className="mx-auto pb-5">
            <Button color="secondary" onClick={this.toggleGraph} className="d-inline-block mr-3">
              {`${showGraphTwo ? "less" : "more"} graphs`}</Button>
            {dateOptions ?
              <DateOptions
                name={name}
                graphName={graphName}
                tree={tree}
                bugId={bugId}
                tableApi={tableApi}
                graphApi={graphApi}
              /> : <DateRangePicker
                tree={tree}
                tableApi={tableApi}
                graphApi={graphApi}
                name={name}
                graphName={graphName}
                bugId={bugId}
              />}
          </Col>
        </Row>
        {showGraphTwo &&
        <Row className="pt-5">
          <Graph
            specs={graphTwoSpecs}
            data={graphTwoData}
          />
        </Row>}
      </React.Fragment>
    );
  }
}

GraphsContainer.propTypes = {
  graphOneData: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.shape({ Date: PropTypes.string }),
      value: PropTypes.number
    })
  ),
  graphTwoData: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.shape({ Date: PropTypes.string }),
        value: PropTypes.number
      })
    ), PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.shape({ Date: PropTypes.string }),
        value: PropTypes.number
      })
    )
  ),
  dateOptions: PropTypes.bool,
  tree: PropTypes.string.isRequired,
  bugId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  name: PropTypes.string.isRequired,
  tableApi: PropTypes.string.isRequired,
  graphApi: PropTypes.string.isRequired,
  graphName: PropTypes.string.isRequired
};

GraphsContainer.defaultProps = {
  bugId: null,
  graphOneData: null,
  graphTwoData: null,
  dateOptions: false
};
