import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusSquare,
  faMinusSquare,
} from '@fortawesome/free-regular-svg-icons';
import { Badge, Row, Col, Collapse, Card, CardBody } from 'reactstrap';

import { resultColorMap } from './helpers';
import TestFailures from './TestFailures';

export default class Metric extends React.PureComponent {
  constructor(props) {
    super(props);

    const { result } = this.props;

    this.state = {
      detailsShowing: result !== 'pass',
    };
  }

  toggleDetails = () => {
    this.setState(prevState => ({ detailsShowing: !prevState.detailsShowing }));
  };

  render() {
    const { detailsShowing } = this.state;
    const {
      result,
      name,
      value,
      details,
      failures,
      repo,
      revision,
    } = this.props;
    const resultColor = resultColorMap[result];
    const expandIcon = detailsShowing ? faMinusSquare : faPlusSquare;

    return (
      <td>
        <Row>
          <div className={`bg-${resultColor} pr-2 mr-2`} />
          <Col>
            <Row className="justify-content-between">
              <div onClick={this.toggleDetails} className="btn">
                <span className="metric-name align-top font-weight-bold">
                  {name}
                </span>
                <span className="btn">
                  <FontAwesomeIcon icon={expandIcon} />
                </span>
              </div>
              <span>
                Confidence:
                <Badge color={resultColor} className="ml-1">
                  {value}
                </Badge>
              </span>
            </Row>
            <Collapse isOpen={detailsShowing}>
              <Card>
                <CardBody>
                  {name === 'Tests' && (
                    <TestFailures
                      failures={failures}
                      repo={repo}
                      revision={revision}
                    />
                  )}
                  {details &&
                    details.map(detail => (
                      <div key={detail} className="ml-3">
                        {detail}
                      </div>
                    ))}
                </CardBody>
              </Card>
            </Collapse>
          </Col>
        </Row>
      </td>
    );
  }
}

Metric.propTypes = {
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  result: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  details: PropTypes.array,
  failures: PropTypes.object,
};

Metric.defaultProps = {
  details: null,
  failures: null,
};
