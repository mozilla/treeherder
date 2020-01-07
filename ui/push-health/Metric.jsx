import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinusSquare } from '@fortawesome/free-regular-svg-icons';
import { Button, Badge, Row, Col, Collapse, Card, CardBody } from 'reactstrap';

import { resultColorMap } from './helpers';

export default class Metric extends React.PureComponent {
  render() {
    const { result, name, expanded, children, toggleExpanded } = this.props;
    const resultColor = resultColorMap[result];

    return (
      <Collapse isOpen={expanded} className="w-100 mt-2">
        <Row className="flex-nowrap">
          <Col className={`bg-${resultColor} pr-2 mr-2 flex-grow-0`} />
          <Col>
            <Row className="justify-content-between">
              <Button
                onClick={() => toggleExpanded(name)}
                outline
                className="border-0"
                aria-expanded={expanded}
              >
                <span className="metric-name align-top font-weight-bold">
                  {name}
                </span>
                <span>
                  <Badge
                    color={resultColor}
                    className="ml-1 mt-1 align-middle text-uppercase"
                  >
                    {result}
                  </Badge>
                </span>
                <span className="btn">
                  <FontAwesomeIcon
                    icon={faMinusSquare}
                    title="Click to collapse"
                  />
                </span>
              </Button>
            </Row>
            <Card>
              <CardBody>{children}</CardBody>
            </Card>
          </Col>
        </Row>
      </Collapse>
    );
  }
}

Metric.propTypes = {
  result: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  children: PropTypes.object.isRequired,
  toggleExpanded: PropTypes.func.isRequired,
  expanded: PropTypes.bool,
};

Metric.defaultProps = {
  expanded: true,
};
