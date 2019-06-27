import React from 'react';
import { Row } from 'reactstrap';

const GraphsContainer = () => (
  <React.Fragment>
    <Row>
      <div id="overview-plot" />
    </Row>
    <Row>
      <div id="graph" />
    </Row>
  </React.Fragment>
);

export default GraphsContainer;
