import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusSquare,
  faMinusSquare,
} from '@fortawesome/free-regular-svg-icons';
import { Button, Badge, Row, Col, Collapse, Card, CardBody } from 'reactstrap';

import { resultColorMap } from './helpers';

export default class Metric extends React.PureComponent {
  constructor(props) {
    super(props);

    const { result } = this.props;

    this.state = {
      detailsShowing: !['pass', 'none'].includes(result),
    };
  }

  toggleDetails = () => {
    this.setState(prevState => ({ detailsShowing: !prevState.detailsShowing }));
  };

  render() {
    const { detailsShowing } = this.state;
    const { result, name, children } = this.props;
    const resultColor = resultColorMap[result];
    const expandIcon = detailsShowing ? faMinusSquare : faPlusSquare;
    const expandTitle = detailsShowing ? 'Minus sign' : 'Plus sign';

    return (
      <td>
        <Row className="flex-nowrap">
          <div className={`bg-${resultColor} pr-2 mr-2`} />
          <Col>
            <Row className="justify-content-between">
              <Button
                onClick={this.toggleDetails}
                outline
                className="border-0"
                aria-expanded={detailsShowing}
              >
                <span className="metric-name align-top font-weight-bold">
                  {name}
                </span>
                <span className="btn">
                  <FontAwesomeIcon icon={expandIcon} title={expandTitle} />
                </span>
              </Button>
              <span>
                <Badge color={resultColor} className="ml-1 text-uppercase">
                  {result}
                </Badge>
              </span>
            </Row>
            <Collapse isOpen={detailsShowing}>
              <Card>
                <CardBody>{children}</CardBody>
              </Card>
            </Collapse>
          </Col>
        </Row>
      </td>
    );
  }
}

Metric.propTypes = {
  result: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  children: PropTypes.object.isRequired,
};
