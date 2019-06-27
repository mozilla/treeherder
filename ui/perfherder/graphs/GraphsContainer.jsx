import React from 'react';
import PropTypes from 'prop-types';
import { Row } from 'reactstrap';

class GraphsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {}

  render() {
    return (
      <React.Fragment>
        <Row>
          <div id="overview-plot" />
        </Row>
        <Row>
          <div id="graph" />
        </Row>
      </React.Fragment>
    );
  }
}

GraphsContainer.propTypes = {
  timeRange: PropTypes.shape({}).isRequired,
  $stateParams: PropTypes.shape({
    zoom: PropTypes.string,
    highlightRevisions: PropTypes.string,
    select: null,
    series: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]),
    highlightAlerts: PropTypes.string,
    highlightedRevisions: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]),
  }),
};

GraphsContainer.defaultProps = {
  $stateParams: undefined,
};

export default GraphsContainer;
